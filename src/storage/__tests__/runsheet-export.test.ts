import { describe, expect, it } from 'vitest';
import { createBlankNode, type OwnershipNode } from '../../types/node';
import {
  buildRunsheetDownloadName,
  buildRunsheetWorkbook,
} from '../runsheet-export';

function buildNode(
  id: string,
  fields: Partial<OwnershipNode> = {}
): OwnershipNode {
  return {
    ...createBlankNode(id),
    instrument: 'Warranty Deed',
    hasDoc: true,
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
  it('builds a workbook matching the leasehold runsheet structure', async () => {
    const workbook = await buildRunsheetWorkbook([
      buildNode('node-1'),
      buildNode('node-2', {
        instrument: 'Oil & Gas Lease',
        docNo: '20260002',
        landDesc: 'Tract 2',
      }),
    ]);

    expect(workbook.SheetNames).toEqual(['Leasehold']);

    const sheet = workbook.Sheets.Leasehold;
    expect(sheet.A1?.v).toBe('Documents Hyperlinked to TORS_Documents Folder');
    expect(sheet.B1?.v).toBe('Instrument');
    expect(sheet.G1?.v).toBe('Instrument No.\nSan Jacinto');

    expect(sheet.A2?.f).toBe('HYPERLINK(D2,C2)');
    expect(sheet.A2?.v).toBe(1);
    expect(sheet.B2?.v).toBe('Warranty Deed');
    expect(sheet.C2?.v).toBe(1);
    expect(sheet.D2?.f).toBe('CONCATENATE("TORS_Documents\\",G2,".pdf")');
    expect(sheet.D2?.v).toBe('TORS_Documents\\20260001.pdf');
    expect(sheet.G2?.v).toBe('20260001');
    expect(sheet.H2?.v).toBe('2026-03-26');
    expect(sheet.I2?.v).toBe('2026-03-25');
    expect(sheet.L2?.v).toBe('Tract 1');
    expect(sheet.M2?.v).toBe('Test remarks');

    expect(sheet.A3?.v).toBe(2);
    expect(sheet.B3?.v).toBe('Oil & Gas Lease');
    expect(sheet.D3?.v).toBe('TORS_Documents\\20260002.pdf');
    expect(sheet.G3?.v).toBe('20260002');
    expect(sheet.L3?.v).toBe('Tract 2');

    expect(sheet['!autofilter']).toEqual({ ref: 'A1:M3' });
    expect(sheet['!cols']).toHaveLength(13);
  });

  it('does not create document hyperlinks for blank doc numbers or missing PDFs', async () => {
    const workbook = await buildRunsheetWorkbook([
      buildNode('node-no-doc-no', { docNo: '' }),
      buildNode('node-no-pdf', { hasDoc: false }),
    ]);

    const sheet = workbook.Sheets.Leasehold;
    expect(sheet.A2?.f).toBeUndefined();
    expect(sheet.A2?.v).toBe(1);
    expect(sheet.D2?.f).toBeUndefined();
    expect(sheet.D2?.v).toBe('');

    expect(sheet.A3?.f).toBeUndefined();
    expect(sheet.A3?.v).toBe(2);
    expect(sheet.D3?.f).toBeUndefined();
    expect(sheet.D3?.v).toBe('');
  });

  it('sanitizes the download name and includes the tract label when present', () => {
    expect(buildRunsheetDownloadName('Demo / Project', 'Tract: 1')).toBe(
      'Demo _ Project-Tract_ 1-runsheet.xlsx'
    );
    expect(buildRunsheetDownloadName('', null)).toBe('workspace-runsheet.xlsx');
  });
});
