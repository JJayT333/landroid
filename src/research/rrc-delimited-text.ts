export interface RrcDelimitedTextPreview {
  columns: string[];
  rows: string[][];
  totalRowCount: number;
  hasHeaderRow: boolean;
  truncated: boolean;
}

function trimTrailingEmptyValues(values: string[], expectedCount?: number) {
  const next = [...values];
  while (
    next.length > (expectedCount ?? 0) &&
    next[next.length - 1]?.trim() === ''
  ) {
    next.pop();
  }
  return next;
}

export function cleanRrcDelimitedValue(value: string) {
  const trimmed = value.replace(/\r$/, '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function splitRrcDelimitedLine(line: string, expectedCount?: number) {
  return trimTrailingEmptyValues(line.split('}'), expectedCount).map(cleanRrcDelimitedValue);
}

function normalizeHeaderValue(value: string) {
  return cleanRrcDelimitedValue(value).replace(/\s+/g, '_').toUpperCase();
}

export function matchesKnownColumns(values: string[], columns: readonly string[]) {
  if (values.length !== columns.length) return false;
  return values.every(
    (value, index) => normalizeHeaderValue(value) === normalizeHeaderValue(columns[index] ?? '')
  );
}

function looksLikeHeaderRow(values: string[]) {
  const nonEmptyValues = values.filter((value) => value.length > 0);
  if (nonEmptyValues.length < 2) return false;

  const headerLikeCount = nonEmptyValues.filter((value) =>
    /^[A-Z0-9_]+$/.test(normalizeHeaderValue(value))
  ).length;

  return headerLikeCount / nonEmptyValues.length >= 0.8;
}

export function parseKnownRrcDelimitedRecords<const TColumns extends readonly string[]>(
  text: string,
  columns: TColumns,
  fileName: string
): {
  rows: Array<Record<TColumns[number], string>>;
  warnings: string[];
  hasHeaderRow: boolean;
} {
  const rows: Array<Record<TColumns[number], string>> = [];
  const warnings: string[] = [];
  const expectedCount = columns.length;
  const lines = text.replace(/^\uFEFF/, '').split(/\n/);
  let hasHeaderRow = false;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim().length === 0) {
      return;
    }

    let values = splitRrcDelimitedLine(line, expectedCount);
    if (!hasHeaderRow && matchesKnownColumns(values, columns)) {
      hasHeaderRow = true;
      return;
    }

    if (values.length < expectedCount) {
      warnings.push(
        `${fileName} line ${lineIndex + 1} had ${values.length} fields; expected ${expectedCount}. Missing fields were padded as blank.`
      );
      values = [...values, ...Array(expectedCount - values.length).fill('')];
    } else if (values.length > expectedCount) {
      warnings.push(
        `${fileName} line ${lineIndex + 1} had ${values.length} fields; expected ${expectedCount}. Extra fields were ignored.`
      );
      values = values.slice(0, expectedCount);
    }

    const row = {} as Record<TColumns[number], string>;
    (columns as readonly TColumns[number][]).forEach((column, columnIndex) => {
      row[column] = values[columnIndex] ?? '';
    });
    rows.push(row);
  });

  return { rows, warnings, hasHeaderRow };
}

export function buildRrcDelimitedTextPreview(
  text: string,
  {
    knownColumns,
    maxRows = 25,
  }: {
    knownColumns?: readonly string[];
    maxRows?: number;
  } = {}
): RrcDelimitedTextPreview | null {
  const parsedLines = text
    .replace(/^\uFEFF/, '')
    .split(/\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0 && line.includes('}'))
    .map(splitRrcDelimitedLine)
    .filter((values) => values.length > 1);

  if (parsedLines.length === 0) {
    return null;
  }

  const firstRow = parsedLines[0] ?? [];
  let columns: string[] = [];
  let dataRows = parsedLines;
  let hasHeaderRow = false;

  if (knownColumns && matchesKnownColumns(firstRow, knownColumns)) {
    columns = [...knownColumns];
    dataRows = parsedLines.slice(1);
    hasHeaderRow = true;
  } else if (looksLikeHeaderRow(firstRow)) {
    columns = firstRow;
    dataRows = parsedLines.slice(1);
    hasHeaderRow = true;
  } else if (knownColumns && knownColumns.length > 1) {
    columns = [...knownColumns];
  } else {
    return null;
  }

  const normalizedRows = dataRows
    .map((row) => {
      if (row.length < columns.length) {
        return [...row, ...Array(columns.length - row.length).fill('')];
      }
      if (row.length > columns.length) {
        return row.slice(0, columns.length);
      }
      return row;
    })
    .filter((row) => row.some((value) => value.length > 0));

  return {
    columns,
    rows: normalizedRows.slice(0, maxRows),
    totalRowCount: normalizedRows.length,
    hasHeaderRow,
    truncated: normalizedRows.length > maxRows,
  };
}
