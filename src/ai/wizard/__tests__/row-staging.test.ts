import { describe, expect, it } from 'vitest';
import { normalizeOwnershipNode } from '../../../types/node';
import type { ParsedWorkbook } from '../parse-workbook';
import {
  buildImportNodeId,
  buildStagedImportRows,
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
});
