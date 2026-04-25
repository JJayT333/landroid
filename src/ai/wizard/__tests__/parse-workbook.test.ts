import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
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
      expect(sheet.allRows.length).toBeGreaterThanOrEqual(sheet.rows.length);
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

describe('parseWorkbook — audit H2 partial guards', () => {
  it('rejects buffers larger than the 10 MB parse cap', () => {
    // Allocate 10 MB + 1 byte. No need to populate — the byte-length check runs
    // before we hand the buffer to XLSX.read.
    const oversized = new ArrayBuffer(10 * 1024 * 1024 + 1);
    expect(() => parseWorkbook('huge.xlsx', oversized)).toThrow(
      /too large to parse safely/i
    );
  });

  it('rejects workbooks with more than 50 sheets', () => {
    const workbook = XLSX.utils.book_new();
    for (let i = 0; i < 51; i++) {
      const sheet = XLSX.utils.aoa_to_sheet([['ok']]);
      XLSX.utils.book_append_sheet(workbook, sheet, `s${i}`);
    }
    const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(() => parseWorkbook('many-sheets.xlsx', out)).toThrow(/51 sheets/);
  });

  it('rejects a sheet whose declared range exceeds the cell-count cap', () => {
    // Craft a sheet with just a sentinel cell at a huge address so the declared
    // !ref is enormous (>500k cells) while the actual file stays small.
    const sheet: XLSX.WorkSheet = {
      A1: { t: 's', v: 'start' },
      ZZ10000: { t: 's', v: 'end' },
      '!ref': 'A1:ZZ10000',
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'huge');
    const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(() => parseWorkbook('huge-range.xlsx', out)).toThrow(
      /declares .* cells/i
    );
  });
});
