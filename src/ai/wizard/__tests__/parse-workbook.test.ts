import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWorkbook, renderWorkbookForPrompt } from '../parse-workbook';

function loadFixture(name: string): ArrayBuffer {
  const buf = readFileSync(
    resolve(__dirname, '../../../../tests/fixtures/ai-wizard/elmore-unit', name)
  );
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('parseWorkbook — Elmore #1 Unit fixtures', () => {
  it('parses the NRI status workbook into named sheets', () => {
    const parsed = parseWorkbook(
      'Status_Elmore_Unit_NRI.xlsx',
      loadFixture('Status_Elmore_Unit_NRI.xlsx')
    );
    expect(parsed.fileName).toBe('Status_Elmore_Unit_NRI.xlsx');
    expect(parsed.sheets.length).toBeGreaterThan(0);
    for (const sheet of parsed.sheets) {
      expect(sheet.name).toBeTruthy();
      expect(sheet.rawRowCount).toBeGreaterThan(0);
      expect(sheet.rawColCount).toBeGreaterThan(0);
    }
  });

  it('parses the runsheet workbook and caps sampled rows', () => {
    const parsed = parseWorkbook(
      'DOTO_Runsheet_Elmore_Unit.xlsx',
      loadFixture('DOTO_Runsheet_Elmore_Unit.xlsx')
    );
    expect(parsed.sheets.length).toBeGreaterThan(0);
    for (const sheet of parsed.sheets) {
      expect(sheet.rows.length).toBeLessThanOrEqual(150);
      for (const row of sheet.rows) {
        expect(row.length).toBeLessThanOrEqual(20);
      }
    }
  });

  it('renders a compact prompt block with sheet headers and row data', () => {
    const parsed = parseWorkbook(
      'Status_Elmore_Unit_NRI.xlsx',
      loadFixture('Status_Elmore_Unit_NRI.xlsx')
    );
    const rendered = renderWorkbookForPrompt(parsed);
    expect(rendered).toContain('# Workbook: Status_Elmore_Unit_NRI.xlsx');
    expect(rendered).toContain('## Sheet:');
    expect(rendered).toMatch(/row \d+: [A-Z]="/);
  });
});
