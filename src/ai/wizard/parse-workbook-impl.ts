/**
 * Pure xlsx/csv parsing logic — shared between the main thread (tests,
 * server-side use) and the wizard's Web Worker.
 *
 * Audit L-2 / H2-full: the actual xlsx invocation lives here so the
 * known-vulnerable parser can be isolated in a Worker by callers that
 * want main-thread protection. The hard caps for buffer size, sheet
 * count, and per-sheet cell count remain in place.
 */
import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  /** Full 2D array of string cells. Trailing empty rows trimmed. */
  allRows: string[][];
  /** Sampled rows used for AI prompts. Trailing empty rows trimmed. */
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

/**
 * Audit H2 partial: hard guards around the xlsx parser.
 *
 *   - `MAX_PARSE_BYTES` — 10 MB buffer cap. The UI file-size limit is 15 MB,
 *     but the parser is the known-vulnerable surface so we narrow harder here.
 *   - `MAX_SHEETS` — reject workbooks with an implausible sheet count
 *     (defense against zip-bomb / parser resource exhaustion).
 *   - `MAX_CELLS_PER_SHEET` — sheet-level cell-count ceiling from the sheet's
 *     declared `!ref` range. A sheet advertising a billion-cell range is
 *     rejected *before* we call `sheet_to_json`, which is where memory blows
 *     up.
 */
export const MAX_PARSE_BYTES = 10 * 1024 * 1024;
export const MAX_SHEETS = 50;
export const MAX_CELLS_PER_SHEET = 500_000;

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
export function parseWorkbookSync(
  fileName: string,
  buffer: ArrayBuffer
): ParsedWorkbook {
  if (buffer.byteLength > MAX_PARSE_BYTES) {
    throw new Error(
      `Workbook too large to parse safely (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB; limit ${(MAX_PARSE_BYTES / (1024 * 1024)).toFixed(0)} MB). Save as CSV and try again.`
    );
  }
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new Error(
      `Workbook has ${workbook.SheetNames.length} sheets; limit is ${MAX_SHEETS}. Split the file and import one section at a time.`
    );
  }
  const sheets: ParsedSheet[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
    const rawRowCount = range.e.r - range.s.r + 1;
    const rawColCount = range.e.c - range.s.c + 1;
    const cellCount = rawRowCount * rawColCount;
    if (cellCount > MAX_CELLS_PER_SHEET) {
      throw new Error(
        `Sheet "${name}" declares ${cellCount.toLocaleString()} cells; limit is ${MAX_CELLS_PER_SHEET.toLocaleString()}. Refuse to parse.`
      );
    }
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
      allRows: trimmed,
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
