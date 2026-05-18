import { describe, expect, it } from 'vitest';
import { createBlankNode, type OwnershipNode } from '../../types/node';
import {
  buildRunsheetCsv,
  buildRunsheetDownloadName,
  buildRunsheetRows,
  exportRunsheetCsv,
} from '../runsheet-export';

function buildNode(
  id: string,
  fields: Partial<OwnershipNode> = {}
): OwnershipNode {
  return {
    ...createBlankNode(id),
    instrument: 'Warranty Deed',
    attachments: [
      {
        docId: `doc-${id}`,
        attachmentId: `att-${id}`,
        fileName: `${id}.pdf`,
        kind: 'deed',
      },
    ],
    vol: '12',
    page: '34',
    docNo: '20260001',
    fileDate: '2026-03-26',
    date: '2026-03-25',
    grantor: 'Grantor A',
    grantee: 'Grantee B',
    landDesc: 'Tract 1',
    remarks: 'Test remarks',
    initialFraction: '0.5',
    fraction: '0.5',
    ...fields,
  };
}

describe('runsheet-export', () => {
  it('builds CSV rows matching the leasehold runsheet structure', () => {
    const rows = buildRunsheetRows([
      buildNode('node-1'),
      buildNode('node-2', {
        instrument: 'Oil & Gas Lease',
        docNo: '20260002',
        landDesc: 'Tract 2',
      }),
    ]);

    expect(rows[0]).toEqual([
      'Documents Hyperlinked to TORS_Documents Folder',
      'Instrument',
      'Order by Date',
      'Image Path',
      'Vol',
      'Page',
      'Instrument No.\nSan Jacinto',
      'File Date',
      'Inst./Eff. Date',
      'Grantor/Assignor / Lessor',
      'Grantee/Assignee / Lessee',
      'Land Desc.',
      'Remarks',
    ]);

    expect(rows[1][0]).toBe(1);
    expect(rows[1][1]).toBe('Warranty Deed');
    expect(rows[1][2]).toBe(1);
    expect(rows[1][3]).toBe('TORS_Documents\\20260001.pdf');
    expect(rows[1][6]).toBe('20260001');
    expect(rows[1][7]).toBe('2026-03-26');
    expect(rows[1][8]).toBe('2026-03-25');
    expect(rows[1][11]).toBe('Tract 1');
    expect(rows[1][12]).toBe('Test remarks');

    expect(rows[2][0]).toBe(2);
    expect(rows[2][1]).toBe('Oil & Gas Lease');
    expect(rows[2][3]).toBe('TORS_Documents\\20260002.pdf');
    expect(rows[2][6]).toBe('20260002');
    expect(rows[2][11]).toBe('Tract 2');
  });

  it('does not create document paths for blank doc numbers or missing PDFs', () => {
    const rows = buildRunsheetRows([
      buildNode('node-no-doc-no', { docNo: '' }),
      buildNode('node-no-pdf', { attachments: [] }),
    ]);

    expect(rows[1][0]).toBe(1);
    expect(rows[1][3]).toBe('');
    expect(rows[2][0]).toBe(2);
    expect(rows[2][3]).toBe('');
  });

  it('escapes CSV values and emits a CSV blob', async () => {
    const csv = buildRunsheetCsv([
      buildNode('node-1', {
        remarks: 'Needs "curative", then review',
      }),
    ]);
    expect(csv).toContain('"Instrument No.\nSan Jacinto"');
    expect(csv).toContain('"Needs ""curative"", then review"');

    const blob = exportRunsheetCsv([buildNode('node-1')]);
    expect(blob.type).toBe('text/csv;charset=utf-8');
    await expect(blob.text()).resolves.toMatch(/^Documents Hyperlinked/);
  });

  it('sanitizes the download name and includes the tract label when present', () => {
    expect(buildRunsheetDownloadName('Demo / Project', 'Tract: 1')).toBe(
      'Demo _ Project-Tract_ 1-runsheet.csv'
    );
    expect(buildRunsheetDownloadName('', null)).toBe('workspace-runsheet.csv');
  });
});
