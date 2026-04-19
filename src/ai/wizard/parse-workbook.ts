/**
 * Deterministic xlsx/csv parsing for the AI wizard.
 *
 * Produces a compact, AI-friendly representation of a workbook: sheet names,
 * dimensions, and sampled rows. Cells are coerced to strings so the AI sees
 * exactly what the user sees. No interpretation happens here — that's the
 * AI's job.
 */
import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  /** 2D array of string cells. Trailing empty rows trimmed. */
  rows: string[][];
  /** Full dimensions before any sampling. */
  rawRowCount: number;
  rawColCount: number;
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheet[];
}

const MAX_SAMPLE_ROWS = 150;
const MAX_SAMPLE_COLS = 20;

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  return String(value).trim();
}

function trimTrailingEmpty(rows: string[][]): string[][] {
  let last = rows.length;
  while (last > 0 && rows[last - 1].every((c) => c === '')) last--;
  return rows.slice(0, last);
}

/** Parse an ArrayBuffer as xlsx/csv and sample each sheet. */
export function parseWorkbook(
  fileName: string,
  buffer: ArrayBuffer
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
    const rawRowCount = range.e.r - range.s.r + 1;
    const rawColCount = range.e.c - range.s.c + 1;
    const aoa = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: true,
    }) as unknown[][];

    const trimmed = trimTrailingEmpty(
      aoa.map((row) =>
        row.slice(0, MAX_SAMPLE_COLS).map(cellToString)
      )
    );
    const sampled = trimmed.slice(0, MAX_SAMPLE_ROWS);

    return {
      name,
      rows: sampled,
      rawRowCount,
      rawColCount,
    };
  });

  return { fileName, sheets };
}

/** Render a parsed workbook as a compact text block for the AI prompt. */
export function renderWorkbookForPrompt(parsed: ParsedWorkbook): string {
  const parts: string[] = [];
  parts.push(`# Workbook: ${parsed.fileName}`);
  for (const sheet of parsed.sheets) {
    parts.push(`\n## Sheet: ${sheet.name}`);
    parts.push(
      `(full size: ${sheet.rawRowCount} rows x ${sheet.rawColCount} cols; showing first ${sheet.rows.length})`
    );
    if (sheet.rows.length === 0) {
      parts.push('(empty)');
      continue;
    }
    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      // Keep each row short: label columns by letter.
      const cells = row
        .map((c, idx) => {
          if (!c) return '';
          const colLetter = XLSX.utils.encode_col(idx);
          return `${colLetter}="${c.replace(/\s+/g, ' ').slice(0, 60)}"`;
        })
        .filter(Boolean)
        .join(' | ');
      if (cells) parts.push(`row ${i + 1}: ${cells}`);
    }
    // Explicit truncation marker so the AI knows more rows exist and can tell
    // the user rather than silently processing a partial workbook.
    if (sheet.rawRowCount > sheet.rows.length) {
      parts.push(
        `[TRUNCATED: ${sheet.rawRowCount - sheet.rows.length} more row(s) not shown — tell the user before assuming you've seen the whole sheet.]`
      );
    }
  }
  return parts.join('\n');
}
