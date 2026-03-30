import {
  parseRrcFixedWidthRecords,
  type ParsedRrcFixedWidthRecord,
  type RrcFixedWidthRecordSpec,
} from './rrc-fixed-width';

export const DRILLING_PERMIT_MASTER_DATASET_IDS = [
  'drilling-permit-master',
  'drilling-permit-master-trailer',
] as const;

type DrillingPermitMasterRecordId = '01' | '02' | '14' | '15';
type DrillingPermitMasterFieldName =
  | 'recordId'
  | 'statusNumber'
  | 'statusSequenceNumber'
  | 'countyCode'
  | 'leaseName'
  | 'districtNo'
  | 'operatorNumber'
  | 'applicationReceivedDate'
  | 'operatorName'
  | 'statusCode'
  | 'permitNumber'
  | 'issueDate'
  | 'wellNumber'
  | 'permitSequenceNumber'
  | 'totalDepth'
  | 'applicationTypeCode'
  | 'surfaceSection'
  | 'surfaceBlock'
  | 'surfaceSurvey'
  | 'surfaceAbstract'
  | 'surfaceAcres'
  | 'nearestCity'
  | 'longitude'
  | 'latitude';

const DRILLING_PERMIT_MASTER_RECORD_SPECS: readonly RrcFixedWidthRecordSpec<
  DrillingPermitMasterRecordId,
  DrillingPermitMasterFieldName
>[] = [
  {
    id: '01',
    label: 'Status root',
    fields: [
      { name: 'recordId', start: 1, end: 2 },
      { name: 'statusNumber', start: 3, end: 9 },
      { name: 'statusSequenceNumber', start: 10, end: 11 },
      { name: 'countyCode', start: 12, end: 14 },
      { name: 'leaseName', start: 15, end: 46 },
      { name: 'districtNo', start: 47, end: 48 },
      { name: 'operatorNumber', start: 49, end: 54 },
      { name: 'applicationReceivedDate', start: 59, end: 66 },
      { name: 'operatorName', start: 67, end: 98 },
      { name: 'statusCode', start: 101, end: 101 },
      { name: 'permitNumber', start: 113, end: 119 },
      { name: 'issueDate', start: 120, end: 127 },
      { name: 'wellNumber', start: 157, end: 162 },
    ],
  },
  {
    id: '02',
    label: 'Permit record',
    fields: [
      { name: 'recordId', start: 1, end: 2 },
      { name: 'permitNumber', start: 3, end: 9 },
      { name: 'permitSequenceNumber', start: 10, end: 11 },
      { name: 'countyCode', start: 12, end: 14 },
      { name: 'leaseName', start: 15, end: 46 },
      { name: 'districtNo', start: 47, end: 48 },
      { name: 'wellNumber', start: 49, end: 54 },
      { name: 'totalDepth', start: 55, end: 59 },
      { name: 'operatorNumber', start: 60, end: 65 },
      { name: 'applicationTypeCode', start: 66, end: 67 },
      { name: 'applicationReceivedDate', start: 122, end: 129 },
      { name: 'issueDate', start: 130, end: 137 },
      { name: 'surfaceSection', start: 244, end: 251 },
      { name: 'surfaceBlock', start: 252, end: 261 },
      { name: 'surfaceSurvey', start: 262, end: 316 },
      { name: 'surfaceAbstract', start: 317, end: 322 },
      { name: 'surfaceAcres', start: 326, end: 333 },
      { name: 'nearestCity', start: 346, end: 358 },
    ],
  },
  {
    id: '14',
    label: 'Surface coordinates',
    fields: [
      { name: 'recordId', start: 1, end: 2 },
      { name: 'longitude', start: 3, end: 14 },
      { name: 'latitude', start: 15, end: 26 },
    ],
  },
  {
    id: '15',
    label: 'Bottom-hole coordinates',
    fields: [
      { name: 'recordId', start: 1, end: 2 },
      { name: 'longitude', start: 3, end: 14 },
      { name: 'latitude', start: 15, end: 26 },
    ],
  },
] as const;

type DrillingPermitMasterParsedRecord = ParsedRrcFixedWidthRecord<
  DrillingPermitMasterRecordId,
  DrillingPermitMasterFieldName
>;

type DrillingPermitMasterWorkingPermit = Omit<
  DrillingPermitMasterPermitPreview,
  'coordinates'
> & {
  coordinates: DrillingPermitMasterCoordinate[];
};

export interface DrillingPermitMasterImportSource {
  importId?: string | null;
  fileName: string;
  text: string;
}

export interface DrillingPermitMasterCoordinate {
  locationType: 'Surface' | 'Bottom Hole';
  latitude: string;
  longitude: string;
}

export interface DrillingPermitMasterPermitPreview {
  permitKey: string;
  statusNumber: string;
  statusSequenceNumber: string;
  permitNumber: string;
  permitSequenceNumber: string;
  operatorName: string;
  operatorNumber: string;
  leaseName: string;
  wellNumber: string;
  districtNo: string;
  countyCode: string;
  statusCode: string;
  applicationReceivedDate: string;
  issueDate: string;
  totalDepth: string;
  applicationTypeCode: string;
  surfaceSection: string;
  surfaceBlock: string;
  surfaceSurvey: string;
  surfaceAbstract: string;
  surfaceAcres: string;
  nearestCity: string;
  coordinates: DrillingPermitMasterCoordinate[];
}

export interface DrillingPermitMasterParsedFileSummary {
  importId: string | null;
  fileName: string;
  label: string;
  recognized: boolean;
  recordCount: number;
  counts: {
    statusRoot: number;
    permit: number;
    surfaceLocation: number;
    bottomHole: number;
  };
  warnings: string[];
  ignoredRecordTypes: string[];
}

export interface DrillingPermitMasterDecodeResult {
  parsedFiles: DrillingPermitMasterParsedFileSummary[];
  permits: DrillingPermitMasterPermitPreview[];
  warnings: string[];
  totals: {
    permitCount: number;
    surfaceLocationCount: number;
    bottomHoleCount: number;
    recognizedFileCount: number;
  };
}

function cleanRecordValue(value: string) {
  return value.trim();
}

function parseCompactCoordinate(
  value: string,
  kind: 'latitude' | 'longitude'
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed) && trimmed.includes('.')) {
    return kind === 'longitude' && !trimmed.startsWith('-')
      ? `-${trimmed}`
      : trimmed;
  }

  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 0) return trimmed;

  const padded = digits.padStart(12, '0').slice(-12);
  const whole = String(Number(padded.slice(0, 5)));
  const decimal = padded.slice(5);
  const formatted = `${whole}.${decimal}`;

  return kind === 'longitude' && !formatted.startsWith('-')
    ? `-${formatted}`
    : formatted;
}

function parseImpliedDecimal(value: string, scale: number) {
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length === 0) return '';
  const padded = digits.padStart(scale + 1, '0');
  const whole = String(Number(padded.slice(0, padded.length - scale)));
  const decimal = padded.slice(-scale);
  if (Number(decimal) === 0) {
    return whole;
  }
  return `${whole}.${decimal.replace(/0+$/, '')}`;
}

function coordinateRank(locationType: DrillingPermitMasterCoordinate['locationType']) {
  if (locationType === 'Surface') return 0;
  return 1;
}

function buildPermitKey(
  permitNumber: string,
  permitSequenceNumber: string,
  statusNumber: string,
  statusSequenceNumber: string
) {
  const normalizedPermitNumber = permitNumber || statusNumber || 'unknown';
  const normalizedPermitSequence =
    permitSequenceNumber || statusSequenceNumber || '00';
  return `${normalizedPermitNumber}-${normalizedPermitSequence}`;
}

function sortCoordinates(coordinates: DrillingPermitMasterCoordinate[]) {
  return [...coordinates].sort((left, right) => {
    const rankDifference = coordinateRank(left.locationType) - coordinateRank(right.locationType);
    if (rankDifference !== 0) return rankDifference;
    return `${left.latitude}|${left.longitude}`.localeCompare(
      `${right.latitude}|${right.longitude}`
    );
  });
}

function mergePermitPreview(
  existing: DrillingPermitMasterPermitPreview | undefined,
  next: DrillingPermitMasterWorkingPermit
) {
  if (!existing) {
    return {
      ...next,
      coordinates: sortCoordinates(next.coordinates),
    };
  }

  const mergedCoordinates = new Map<string, DrillingPermitMasterCoordinate>();
  [...existing.coordinates, ...next.coordinates].forEach((coordinate) => {
    mergedCoordinates.set(
      `${coordinate.locationType}|${coordinate.latitude}|${coordinate.longitude}`,
      coordinate
    );
  });

  return {
    ...existing,
    statusNumber: existing.statusNumber || next.statusNumber,
    statusSequenceNumber:
      existing.statusSequenceNumber || next.statusSequenceNumber,
    permitNumber: existing.permitNumber || next.permitNumber,
    permitSequenceNumber:
      existing.permitSequenceNumber || next.permitSequenceNumber,
    operatorName: existing.operatorName || next.operatorName,
    operatorNumber: existing.operatorNumber || next.operatorNumber,
    leaseName: existing.leaseName || next.leaseName,
    wellNumber: existing.wellNumber || next.wellNumber,
    districtNo: existing.districtNo || next.districtNo,
    countyCode: existing.countyCode || next.countyCode,
    statusCode: existing.statusCode || next.statusCode,
    applicationReceivedDate:
      existing.applicationReceivedDate || next.applicationReceivedDate,
    issueDate: existing.issueDate || next.issueDate,
    totalDepth: existing.totalDepth || next.totalDepth,
    applicationTypeCode:
      existing.applicationTypeCode || next.applicationTypeCode,
    surfaceSection: existing.surfaceSection || next.surfaceSection,
    surfaceBlock: existing.surfaceBlock || next.surfaceBlock,
    surfaceSurvey: existing.surfaceSurvey || next.surfaceSurvey,
    surfaceAbstract: existing.surfaceAbstract || next.surfaceAbstract,
    surfaceAcres: existing.surfaceAcres || next.surfaceAcres,
    nearestCity: existing.nearestCity || next.nearestCity,
    coordinates: sortCoordinates([...mergedCoordinates.values()]),
  };
}

function buildWorkingPermit(
  activeRoot: DrillingPermitMasterParsedRecord | null,
  permitRecord: DrillingPermitMasterParsedRecord
): DrillingPermitMasterWorkingPermit {
  const statusNumber = cleanRecordValue(activeRoot?.values.statusNumber ?? '');
  const statusSequenceNumber = cleanRecordValue(
    activeRoot?.values.statusSequenceNumber ?? ''
  );
  const permitNumber = cleanRecordValue(permitRecord.values.permitNumber);
  const permitSequenceNumber = cleanRecordValue(
    permitRecord.values.permitSequenceNumber
  );

  return {
    permitKey: buildPermitKey(
      permitNumber,
      permitSequenceNumber,
      statusNumber,
      statusSequenceNumber
    ),
    statusNumber,
    statusSequenceNumber,
    permitNumber,
    permitSequenceNumber,
    operatorName: cleanRecordValue(activeRoot?.values.operatorName ?? ''),
    operatorNumber:
      cleanRecordValue(permitRecord.values.operatorNumber) ||
      cleanRecordValue(activeRoot?.values.operatorNumber ?? ''),
    leaseName:
      cleanRecordValue(permitRecord.values.leaseName) ||
      cleanRecordValue(activeRoot?.values.leaseName ?? ''),
    wellNumber:
      cleanRecordValue(permitRecord.values.wellNumber) ||
      cleanRecordValue(activeRoot?.values.wellNumber ?? ''),
    districtNo:
      cleanRecordValue(permitRecord.values.districtNo) ||
      cleanRecordValue(activeRoot?.values.districtNo ?? ''),
    countyCode:
      cleanRecordValue(permitRecord.values.countyCode) ||
      cleanRecordValue(activeRoot?.values.countyCode ?? ''),
    statusCode: cleanRecordValue(activeRoot?.values.statusCode ?? ''),
    applicationReceivedDate:
      cleanRecordValue(permitRecord.values.applicationReceivedDate) ||
      cleanRecordValue(activeRoot?.values.applicationReceivedDate ?? ''),
    issueDate:
      cleanRecordValue(permitRecord.values.issueDate) ||
      cleanRecordValue(activeRoot?.values.issueDate ?? ''),
    totalDepth: cleanRecordValue(permitRecord.values.totalDepth),
    applicationTypeCode: cleanRecordValue(permitRecord.values.applicationTypeCode),
    surfaceSection: cleanRecordValue(permitRecord.values.surfaceSection),
    surfaceBlock: cleanRecordValue(permitRecord.values.surfaceBlock),
    surfaceSurvey: cleanRecordValue(permitRecord.values.surfaceSurvey),
    surfaceAbstract: cleanRecordValue(permitRecord.values.surfaceAbstract),
    surfaceAcres: parseImpliedDecimal(permitRecord.values.surfaceAcres, 2),
    nearestCity: cleanRecordValue(permitRecord.values.nearestCity),
    coordinates: [],
  };
}

function buildCoordinate(
  record: DrillingPermitMasterParsedRecord
): DrillingPermitMasterCoordinate {
  return {
    locationType: record.id === '14' ? 'Surface' : 'Bottom Hole',
    latitude: parseCompactCoordinate(record.values.latitude, 'latitude'),
    longitude: parseCompactCoordinate(record.values.longitude, 'longitude'),
  };
}

function summarizeIgnoredRecordTypes(
  unknownRecordCounts: Record<string, number>
) {
  return Object.entries(unknownRecordCounts)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([recordId, count]) => `${recordId} (${count})`);
}

export function decodeDrillingPermitMasterImports(
  imports: DrillingPermitMasterImportSource[]
): DrillingPermitMasterDecodeResult {
  const parsedFiles: DrillingPermitMasterParsedFileSummary[] = [];
  const warnings: string[] = [];
  const permitsByKey = new Map<string, DrillingPermitMasterPermitPreview>();

  let orphanCoordinateCount = 0;
  let mergedPermitCount = 0;
  let surfaceLocationCount = 0;
  let bottomHoleCount = 0;

  imports.forEach((source) => {
    const text = source.text.replace(/^\uFEFF/, '');
    if (text.trim().length === 0) {
      parsedFiles.push({
        importId: source.importId ?? null,
        fileName: source.fileName,
        label: 'Staged only',
        recognized: false,
        recordCount: 0,
        counts: {
          statusRoot: 0,
          permit: 0,
          surfaceLocation: 0,
          bottomHole: 0,
        },
        warnings: [],
        ignoredRecordTypes: [],
      });
      return;
    }

    const parsed = parseRrcFixedWidthRecords(
      text,
      source.fileName,
      DRILLING_PERMIT_MASTER_RECORD_SPECS
    );
    const ignoredRecordTypes = summarizeIgnoredRecordTypes(parsed.unknownRecordCounts);
    const fileWarnings = [...parsed.warnings];

    const counts = {
      statusRoot: parsed.records.filter((record) => record.id === '01').length,
      permit: parsed.records.filter((record) => record.id === '02').length,
      surfaceLocation: parsed.records.filter((record) => record.id === '14').length,
      bottomHole: parsed.records.filter((record) => record.id === '15').length,
    };

    if (ignoredRecordTypes.length > 0) {
      fileWarnings.push(
        `${source.fileName} included companion segment types the current decoder does not use yet: ${ignoredRecordTypes.join(', ')}.`
      );
    }

    const recognized = parsed.records.length > 0;
    parsedFiles.push({
      importId: source.importId ?? null,
      fileName: source.fileName,
      label: recognized
        ? 'Core permit records'
        : ignoredRecordTypes.length > 0
          ? 'Companion segments only'
          : 'Staged only',
      recognized,
      recordCount: parsed.records.length,
      counts,
      warnings: fileWarnings,
      ignoredRecordTypes,
    });

    let activeRoot: DrillingPermitMasterParsedRecord | null = null;
    let activePermit: DrillingPermitMasterWorkingPermit | null = null;

    const finalizeActivePermit = () => {
      if (!activePermit) return;
      const existing = permitsByKey.get(activePermit.permitKey);
      if (existing) {
        mergedPermitCount += 1;
      }
      permitsByKey.set(
        activePermit.permitKey,
        mergePermitPreview(existing, activePermit)
      );
      activePermit = null;
    };

    parsed.records.forEach((record) => {
      if (record.id === '01') {
        finalizeActivePermit();
        activeRoot = record;
        return;
      }

      if (record.id === '02') {
        finalizeActivePermit();
        activePermit = buildWorkingPermit(activeRoot, record);
        return;
      }

      if (!activePermit) {
        orphanCoordinateCount += 1;
        return;
      }

      const coordinate = buildCoordinate(record);
      if (coordinate.locationType === 'Surface') {
        surfaceLocationCount += 1;
      } else {
        bottomHoleCount += 1;
      }
      activePermit.coordinates.push(coordinate);
    });

    finalizeActivePermit();
  });

  if (mergedPermitCount > 0) {
    warnings.push(
      `${mergedPermitCount} duplicate permit previews were merged across the imported master files.`
    );
  }

  if (orphanCoordinateCount > 0) {
    warnings.push(
      `${orphanCoordinateCount} coordinate records did not find a current permit segment while decoding.`
    );
  }

  const permits = [...permitsByKey.values()].sort((left, right) =>
    `${left.permitNumber}|${left.leaseName}|${left.wellNumber}`.localeCompare(
      `${right.permitNumber}|${right.leaseName}|${right.wellNumber}`
    )
  );

  if (permits.length === 0) {
    warnings.push(
      'No permit master rows are available yet. Import an ASCII drilling-permit master file to build the fixed-width permit preview.'
    );
  }

  return {
    parsedFiles,
    permits,
    warnings,
    totals: {
      permitCount: permits.length,
      surfaceLocationCount,
      bottomHoleCount,
      recognizedFileCount: parsedFiles.filter((parsedFile) => parsedFile.recognized).length,
    },
  };
}
