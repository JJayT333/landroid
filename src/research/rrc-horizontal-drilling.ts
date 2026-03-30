import {
  parseRrcFixedWidthRows,
  type ParsedRrcFixedWidthRow,
  type RrcFixedWidthFieldSpec,
} from './rrc-fixed-width';

export const HORIZONTAL_DRILLING_DATASET_ID = 'horizontal-drilling-permits';

type HorizontalDrillingFieldName =
  | 'permitNumber'
  | 'permitSequence'
  | 'districtNo'
  | 'countyName'
  | 'apiCounty'
  | 'apiUniqueNumber'
  | 'operatorNumber'
  | 'operatorName'
  | 'leaseName'
  | 'issuedDate'
  | 'totalDepth'
  | 'section'
  | 'block'
  | 'abstract'
  | 'survey'
  | 'wellNumber'
  | 'fieldName'
  | 'validatedFieldName'
  | 'validatedWellDate'
  | 'validatedOperatorName'
  | 'oilOrGas'
  | 'validatedLeaseNumber'
  | 'validatedLeaseName'
  | 'validatedWellNumber'
  | 'offScheduleFlag'
  | 'totalPermittedFields'
  | 'totalValidatedFields';

const HORIZONTAL_DRILLING_FIELDS: readonly RrcFixedWidthFieldSpec<HorizontalDrillingFieldName>[] = [
  { name: 'permitNumber', start: 1, end: 7 },
  { name: 'permitSequence', start: 8, end: 9 },
  { name: 'districtNo', start: 10, end: 11 },
  { name: 'countyName', start: 12, end: 24 },
  { name: 'apiCounty', start: 25, end: 27 },
  { name: 'apiUniqueNumber', start: 28, end: 32 },
  { name: 'operatorNumber', start: 33, end: 38 },
  { name: 'operatorName', start: 39, end: 70 },
  { name: 'leaseName', start: 71, end: 102 },
  { name: 'issuedDate', start: 103, end: 110 },
  { name: 'totalDepth', start: 111, end: 115 },
  { name: 'section', start: 116, end: 123 },
  { name: 'block', start: 124, end: 133 },
  { name: 'abstract', start: 134, end: 139 },
  { name: 'survey', start: 140, end: 194 },
  { name: 'wellNumber', start: 195, end: 200 },
  { name: 'fieldName', start: 201, end: 232 },
  { name: 'validatedFieldName', start: 233, end: 264 },
  { name: 'validatedWellDate', start: 265, end: 272 },
  { name: 'validatedOperatorName', start: 273, end: 304 },
  { name: 'oilOrGas', start: 305, end: 305 },
  { name: 'validatedLeaseNumber', start: 306, end: 311 },
  { name: 'validatedLeaseName', start: 312, end: 343 },
  { name: 'validatedWellNumber', start: 344, end: 349 },
  { name: 'offScheduleFlag', start: 350, end: 350 },
  { name: 'totalPermittedFields', start: 351, end: 352 },
  { name: 'totalValidatedFields', start: 353, end: 354 },
] as const;

type HorizontalDrillingParsedRow = ParsedRrcFixedWidthRow<HorizontalDrillingFieldName>;

export interface HorizontalDrillingImportSource {
  importId?: string | null;
  fileName: string;
  text: string;
}

export interface HorizontalDrillingPermitPreview {
  permitKey: string;
  permitNumber: string;
  permitSequence: string;
  districtNo: string;
  countyName: string;
  apiNumber: string;
  operatorNumber: string;
  operatorName: string;
  leaseName: string;
  issuedDate: string;
  totalDepth: string;
  section: string;
  block: string;
  abstract: string;
  survey: string;
  wellNumber: string;
  fieldName: string;
  validatedFieldName: string;
  validatedWellDate: string;
  validatedOperatorName: string;
  oilOrGas: string;
  validatedLeaseNumber: string;
  validatedLeaseName: string;
  validatedWellNumber: string;
  offSchedule: boolean;
  totalPermittedFields: string;
  totalValidatedFields: string;
}

export interface HorizontalDrillingParsedFileSummary {
  importId: string | null;
  fileName: string;
  label: string;
  recognized: boolean;
  recordCount: number;
  warnings: string[];
}

export interface HorizontalDrillingDecodeResult {
  parsedFiles: HorizontalDrillingParsedFileSummary[];
  permits: HorizontalDrillingPermitPreview[];
  warnings: string[];
  totals: {
    permitCount: number;
    gasCount: number;
    oilCount: number;
    offScheduleCount: number;
    recognizedFileCount: number;
  };
}

function cleanValue(value: string) {
  return value.trim();
}

function buildApiNumber(row: HorizontalDrillingParsedRow) {
  const county = cleanValue(row.values.apiCounty);
  const unique = cleanValue(row.values.apiUniqueNumber);
  if (!county && !unique) return '';
  return `${county}-${unique}`;
}

function buildPermitKey(row: HorizontalDrillingParsedRow) {
  const permitNumber = cleanValue(row.values.permitNumber);
  const permitSequence = cleanValue(row.values.permitSequence);
  return `${permitNumber || 'unknown'}-${permitSequence || '00'}`;
}

function toPermitPreview(row: HorizontalDrillingParsedRow): HorizontalDrillingPermitPreview {
  return {
    permitKey: buildPermitKey(row),
    permitNumber: cleanValue(row.values.permitNumber),
    permitSequence: cleanValue(row.values.permitSequence),
    districtNo: cleanValue(row.values.districtNo),
    countyName: cleanValue(row.values.countyName),
    apiNumber: buildApiNumber(row),
    operatorNumber: cleanValue(row.values.operatorNumber),
    operatorName: cleanValue(row.values.operatorName),
    leaseName: cleanValue(row.values.leaseName),
    issuedDate: cleanValue(row.values.issuedDate),
    totalDepth: cleanValue(row.values.totalDepth),
    section: cleanValue(row.values.section),
    block: cleanValue(row.values.block),
    abstract: cleanValue(row.values.abstract),
    survey: cleanValue(row.values.survey),
    wellNumber: cleanValue(row.values.wellNumber),
    fieldName: cleanValue(row.values.fieldName),
    validatedFieldName: cleanValue(row.values.validatedFieldName),
    validatedWellDate: cleanValue(row.values.validatedWellDate),
    validatedOperatorName: cleanValue(row.values.validatedOperatorName),
    oilOrGas: cleanValue(row.values.oilOrGas),
    validatedLeaseNumber: cleanValue(row.values.validatedLeaseNumber),
    validatedLeaseName: cleanValue(row.values.validatedLeaseName),
    validatedWellNumber: cleanValue(row.values.validatedWellNumber),
    offSchedule: cleanValue(row.values.offScheduleFlag).toUpperCase() === 'Y',
    totalPermittedFields: cleanValue(row.values.totalPermittedFields),
    totalValidatedFields: cleanValue(row.values.totalValidatedFields),
  };
}

export function decodeHorizontalDrillingImports(
  imports: HorizontalDrillingImportSource[]
): HorizontalDrillingDecodeResult {
  const parsedFiles: HorizontalDrillingParsedFileSummary[] = [];
  const warnings: string[] = [];
  const permits: HorizontalDrillingPermitPreview[] = [];

  let gasCount = 0;
  let oilCount = 0;
  let offScheduleCount = 0;
  let recognizedFileCount = 0;
  let duplicatePermitCount = 0;
  const seenPermitKeys = new Set<string>();

  imports.forEach((source) => {
    const text = source.text.replace(/^\uFEFF/, '');
    if (text.trim().length === 0) {
      parsedFiles.push({
        importId: source.importId ?? null,
        fileName: source.fileName,
        label: 'Staged only',
        recognized: false,
        recordCount: 0,
        warnings: [],
      });
      return;
    }

    const parsed = parseRrcFixedWidthRows(text, source.fileName, HORIZONTAL_DRILLING_FIELDS);
    const fileWarnings = [...parsed.warnings];

    if (parsed.rows.length > 0) {
      recognizedFileCount += 1;
    }

    parsedFiles.push({
      importId: source.importId ?? null,
      fileName: source.fileName,
      label: parsed.rows.length > 0 ? 'Horizontal permit rows' : 'Staged only',
      recognized: parsed.rows.length > 0,
      recordCount: parsed.rows.length,
      warnings: fileWarnings,
    });

    parsed.rows.forEach((row) => {
      const permit = toPermitPreview(row);
      if (seenPermitKeys.has(permit.permitKey)) {
        duplicatePermitCount += 1;
        return;
      }
      seenPermitKeys.add(permit.permitKey);
      permits.push(permit);

      if (permit.oilOrGas === 'G') {
        gasCount += 1;
      } else if (permit.oilOrGas === 'O') {
        oilCount += 1;
      }
      if (permit.offSchedule) {
        offScheduleCount += 1;
      }
    });
  });

  if (duplicatePermitCount > 0) {
    warnings.push(
      `${duplicatePermitCount} duplicate horizontal permit rows were ignored while building the preview.`
    );
  }

  if (permits.length === 0) {
    warnings.push(
      'No horizontal permit rows are available yet. Import a horizontal drilling permits ASCII file to build the fixed-width preview.'
    );
  }

  permits.sort((left, right) =>
    `${left.permitNumber}|${left.leaseName}|${left.wellNumber}`.localeCompare(
      `${right.permitNumber}|${right.leaseName}|${right.wellNumber}`
    )
  );

  return {
    parsedFiles,
    permits,
    warnings,
    totals: {
      permitCount: permits.length,
      gasCount,
      oilCount,
      offScheduleCount,
      recognizedFileCount,
    },
  };
}
