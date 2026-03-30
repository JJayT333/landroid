export interface RrcFixedWidthFieldSpec<Name extends string = string> {
  name: Name;
  start: number;
  end: number;
  trim?: boolean;
}

export interface RrcFixedWidthRecordSpec<
  RecordId extends string = string,
  FieldName extends string = string,
> {
  id: RecordId;
  label: string;
  fields: readonly RrcFixedWidthFieldSpec<FieldName>[];
}

export interface ParsedRrcFixedWidthRecord<
  RecordId extends string = string,
  FieldName extends string = string,
> {
  id: RecordId;
  label: string;
  lineNumber: number;
  rawLine: string;
  values: Record<FieldName, string>;
}

export interface ParseRrcFixedWidthResult<
  RecordId extends string = string,
  FieldName extends string = string,
> {
  records: ParsedRrcFixedWidthRecord<RecordId, FieldName>[];
  warnings: string[];
  unknownRecordCounts: Record<string, number>;
  totalLineCount: number;
}

export interface ParsedRrcFixedWidthRow<FieldName extends string = string> {
  lineNumber: number;
  rawLine: string;
  values: Record<FieldName, string>;
}

export interface ParseRrcFixedWidthRowsResult<FieldName extends string = string> {
  rows: ParsedRrcFixedWidthRow<FieldName>[];
  warnings: string[];
  totalLineCount: number;
}

function maxFieldEnd(fields: readonly RrcFixedWidthFieldSpec[]) {
  return fields.reduce((longest, field) => Math.max(longest, field.end), 0);
}

function sliceFixedWidthValue(
  line: string,
  field: RrcFixedWidthFieldSpec
) {
  const value = line.slice(field.start - 1, field.end);
  return field.trim === false ? value : value.trim();
}

export function parseRrcFixedWidthRecords<
  RecordId extends string,
  FieldName extends string,
>(
  text: string,
  fileName: string,
  recordSpecs: readonly RrcFixedWidthRecordSpec<RecordId, FieldName>[]
): ParseRrcFixedWidthResult<RecordId, FieldName> {
  const specById = new Map(recordSpecs.map((recordSpec) => [recordSpec.id, recordSpec]));
  const records: ParsedRrcFixedWidthRecord<RecordId, FieldName>[] = [];
  const warnings: string[] = [];
  const unknownRecordCounts = new Map<string, number>();

  const lines = text.replace(/^\uFEFF/, '').split(/\n/);
  let totalLineCount = 0;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim().length === 0) {
      return;
    }

    totalLineCount += 1;

    const recordId = line.slice(0, 2).trim();
    const spec = specById.get(recordId as RecordId);

    if (!spec) {
      unknownRecordCounts.set(recordId || '(blank)', (unknownRecordCounts.get(recordId || '(blank)') ?? 0) + 1);
      return;
    }

    const expectedLength = maxFieldEnd(spec.fields);
    let normalizedLine = line;

    if (line.length < expectedLength) {
      warnings.push(
        `${fileName} line ${lineIndex + 1} was ${line.length} characters long; expected at least ${expectedLength} for record ${recordId}. Missing columns were padded as blank.`
      );
      normalizedLine = line.padEnd(expectedLength, ' ');
    }

    const values = {} as Record<FieldName, string>;
    spec.fields.forEach((field) => {
      values[field.name] = sliceFixedWidthValue(normalizedLine, field) as Record<FieldName, string>[FieldName];
    });

    records.push({
      id: spec.id,
      label: spec.label,
      lineNumber: lineIndex + 1,
      rawLine: normalizedLine,
      values,
    });
  });

  return {
    records,
    warnings,
    unknownRecordCounts: Object.fromEntries(unknownRecordCounts),
    totalLineCount,
  };
}

export function parseRrcFixedWidthRows<FieldName extends string>(
  text: string,
  fileName: string,
  fields: readonly RrcFixedWidthFieldSpec<FieldName>[]
): ParseRrcFixedWidthRowsResult<FieldName> {
  const rows: ParsedRrcFixedWidthRow<FieldName>[] = [];
  const warnings: string[] = [];
  const expectedLength = maxFieldEnd(fields);

  const lines = text.replace(/^\uFEFF/, '').split(/\n/);
  let totalLineCount = 0;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim().length === 0) {
      return;
    }

    totalLineCount += 1;
    let normalizedLine = line;

    if (line.length < expectedLength) {
      warnings.push(
        `${fileName} line ${lineIndex + 1} was ${line.length} characters long; expected at least ${expectedLength}. Missing columns were padded as blank.`
      );
      normalizedLine = line.padEnd(expectedLength, ' ');
    }

    const values = {} as Record<FieldName, string>;
    fields.forEach((field) => {
      values[field.name] = sliceFixedWidthValue(normalizedLine, field) as Record<
        FieldName,
        string
      >[FieldName];
    });

    rows.push({
      lineNumber: lineIndex + 1,
      rawLine: normalizedLine,
      values,
    });
  });

  return {
    rows,
    warnings,
    totalLineCount,
  };
}
