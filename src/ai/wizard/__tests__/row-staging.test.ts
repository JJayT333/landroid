import { describe, expect, it } from 'vitest';
import { normalizeOwnershipNode } from '../../../types/node';
import type { ParsedWorkbook } from '../parse-workbook';
import {
  buildImportNodeId,
  buildStagedImportRows,
  inferTractInfoFromSheetName,
  parseImportFraction,
  stagedRowToNodeForm,
  suggestParentForRow,
} from '../row-staging';

function workbook(rows: string[][]): ParsedWorkbook {
  return {
    fileName: 'runsheet.xlsx',
    sheets: [
      {
        name: 'Title',
        allRows: rows,
        rows,
        rawRowCount: rows.length,
        rawColCount: Math.max(...rows.map((row) => row.length)),
      },
    ],
  };
}

describe('row staging', () => {
  it('maps common runsheet headers into editable node drafts', () => {
    const result = buildStagedImportRows(
      workbook([
        ['Grantor', 'Grantee', 'Instrument', 'Doc #', 'Interest', 'Legal Description'],
        ['Alpha Land', 'Beta Minerals', 'Mineral Deed', '1234', '1/2', 'Blackacre'],
      ])
    );

    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      grantor: 'Alpha Land',
      grantee: 'Beta Minerals',
      instrument: 'Mineral Deed',
      docNo: '1234',
      fractionInput: '1/2',
      landDesc: 'Blackacre',
      interestClass: 'mineral',
    });
    expect(parseImportFraction(result.rows[0].fractionInput)).toEqual({
      ok: true,
      value: '0.500000000',
    });
  });

  it('does not mistake helper header text containing "to" for the grantee column', () => {
    const result = buildStagedImportRows(
      workbook([
        [
          'Documents Hyperlinked to TORS_Documents Folder',
          'Instrument',
          'Instrument No. San Jacinto',
          'File Date',
          'Inst. Date',
          'Grantor',
          'Grantee',
          'Land Desc.',
          'Remarks',
          'Decimal Mineral Ownership per DOTO',
        ],
        [
          '1',
          'Mineral Deed',
          '2013000463',
          '1/30/13',
          '11/27/12',
          'Lewis R. Tyra',
          'LCT Revocable Trust',
          'All minerals',
          '',
          '0.25',
        ],
      ])
    );

    expect(result.rows[0]).toMatchObject({
      grantor: 'Lewis R. Tyra',
      grantee: 'LCT Revocable Trust',
      instrument: 'Mineral Deed',
      docNo: '2013000463',
      fileDate: '1/30/13',
      date: '11/27/12',
      fractionInput: '0.25',
    });
  });

  it('converts Elmore-style DOTO ownership rows into owner node drafts with inherited context', () => {
    const result = buildStagedImportRows(
      workbook([
        [
          'Documents Hyperlinked to TORS_Documents Folder',
          'Instrument',
          'Order by Date',
          'Image Path',
          'Vol',
          'Page',
          'Instrument No. San Jacinto',
          'File Date',
          'Inst. Date',
          'Grantor',
          'Grantee',
          'Land Desc.',
          'Remarks',
          'Decimal Mineral Ownership per 6/4/2009 DOTO',
        ],
        [
          '1',
          'DOTO',
          '1',
          'TORS_Documents\\DOTO.pdf',
          '',
          '',
          'DOTO_ElmoreC-1_Unit',
          '6/4/09',
          '4/3/09',
          'John G. Gaston, Attorney',
          'Famcor Oil, Inc.',
          'Unit Tr. 1',
          'Ownership listed below for examination convenience',
          '',
        ],
        [
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          'Elmore Family Partners, Ltd.',
          'Exh. B, Pg. 38',
          '',
          '17/84 MI',
          '0.20238095',
        ],
      ])
    );

    expect(result.rows[1]).toMatchObject({
      grantor: 'John G. Gaston, Attorney',
      grantee: 'Elmore Family Partners, Ltd.',
      instrument: 'DOTO',
      docNo: 'DOTO_ElmoreC-1_Unit',
      fileDate: '6/4/09',
      date: '4/3/09',
      landDesc: 'Unit Tr. 1',
      fractionInput: '0.20238095',
      remarks: '17/84 MI | Source exhibit: Exh. B, Pg. 38',
    });
  });

  it('uses full sheet rows for staging even when AI prompt rows are sampled', () => {
    const fullRows = [
      ['Grantor', 'Grantee', 'Interest'],
      ['A', 'B', '1/4'],
      ['B', 'C', '1/8'],
    ];
    const result = buildStagedImportRows({
      fileName: 'runsheet.xlsx',
      sheets: [
        {
          name: 'Title',
          allRows: fullRows,
          rows: fullRows.slice(0, 2),
          rawRowCount: fullRows.length,
          rawColCount: 3,
        },
      ],
    });

    expect(result.rows.map((row) => row.grantee)).toEqual(['B', 'C']);
  });

  it('suggests a parent when the row grantor matches an existing grantee', () => {
    const result = buildStagedImportRows(
      workbook([
        ['Grantor', 'Grantee', 'Interest'],
        ['Beta Minerals LLC', 'Charlie Trust', '25%'],
      ])
    );
    const parent = normalizeOwnershipNode({
      id: 'node-beta',
      grantee: 'Beta Minerals',
      fraction: '1',
      initialFraction: '1',
    });

    const suggestion = suggestParentForRow(result.rows[0], [parent]);

    expect(suggestion).toMatchObject({
      nodeId: 'node-beta',
      confidence: 'high',
      reason: 'grantor matches an existing grantee',
    });
  });

  it('keeps node creation metadata deterministic and collision-safe', () => {
    const [row] = buildStagedImportRows(
      workbook([
        ['Grantor', 'Grantee', 'Interest'],
        ['A', 'Beta Minerals', '0.25'],
      ])
    ).rows;
    const first = buildImportNodeId(row, new Set());
    const second = buildImportNodeId(row, new Set([first]));
    const parsed = parseImportFraction(row.fractionInput);

    expect(first).toBe('import-beta-minerals-r2');
    expect(second).toBe('import-beta-minerals-r2-2');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(stagedRowToNodeForm(row, parsed.value)).toMatchObject({
        grantee: 'Beta Minerals',
        conveyanceMode: 'fixed',
        splitBasis: 'whole',
        manualAmount: '0.250000000',
      });
    }
  });

  it('parses common title interest expressions when the decimal column is missing', () => {
    expect(parseImportFraction('1/2 x 25/420 MI')).toEqual({
      ok: true,
      value: '0.0297619047619047619047619',
    });
    expect(parseImportFraction('17/84 - 1/8 MI')).toEqual({
      ok: true,
      value: '0.077380952380952380952381',
    });
    expect(parseImportFraction('80% x 25/420 MI')).toEqual({
      ok: true,
      value: '0.047619047619047619047619',
    });
  });

  it('infers tract code and acreage from workbook tab names', () => {
    expect(inferTractInfoFromSheetName('Tract 2 - 106.19 ac.')).toEqual({
      code: 'T2',
      name: 'Tract 2 - 106.19 ac.',
      grossAcres: '106.19',
    });
  });
});
