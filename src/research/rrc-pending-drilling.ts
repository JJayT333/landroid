import { parseKnownRrcDelimitedRecords } from './rrc-delimited-text';

export const PENDING_DRILLING_DATASET_ID = 'drilling-permits-pending';

export type PendingDrillingSupportedFileKind =
  | 'drillingPermit'
  | 'wellbore'
  | 'latlong';

type PendingDrillingFileSpec = {
  fileStem: string;
  label: string;
  columns: readonly string[];
};

export const PENDING_DRILLING_FILE_SPECS: Record<
  PendingDrillingSupportedFileKind,
  PendingDrillingFileSpec
> = {
  drillingPermit: {
    fileStem: 'dp_drilling_permit_pending_',
    label: 'Permit records',
    columns: [
      'UNIVERSAL_DOC_NO',
      'STATUS_NUMBER',
      'STATUS_SEQ_NO',
      'SUBMIT_DATE',
      'PERMIT_TYPE_CODE',
      'AMEND_PERMIT_FLAG',
      'OPERATOR_NO',
      'OPERATOR_NAME',
      'DUP_OPERATOR_NAME_FLAG',
      'W1_CONDITION_CODE',
      'W1_CONDITION_NO',
      'DUP_W1_CONDITION_CODE_FLAG',
      'BLANKET_AUTH_FIELD_NO',
      'BLANKET_AUTH_RESERVOIR_NO',
      'DISTRICT_NO',
      'COUNTY_CODE',
      'SURVEY_NAME',
      'LEASE_NAME',
      'WELL_NO',
      'PERMIT_HB_WAIVER_FLAG',
      'NEW_DRILL_DEPTH',
      'TOTAL_DEPTH',
      'FIELD_ACRES',
      'RULE_37_FLAG',
      'RULE_38_FLAG',
      'EXCEPTION_HB_2304_FLAG',
      'RULE_37_CASE_NO',
      'RULE_38_CASE_NO',
      'CASE_NO',
      'HEARING_DATE',
      'RULE_37_DISTANCE_1',
      'RULE_37_DISTANCE_2',
      'RULE_38_DISTANCE',
      'FILING_PURPOSE_CODE',
      'DRILLER_ORIG_CUTTING_FLAG',
      'OLD_WELL_NO',
      'OLD_COMPLETION_NO',
      'SIDETRACK_WELL_NO',
      'OLD_TOTAL_DEPTH',
      'OLD_FIELD_NO',
      'OLD_FIELD_NO_2',
      'OLD_COUNTY_CODE',
      'ORIGINAL_WELL_FLAG',
      'REENTER_WELL_FLAG',
      'STATUS_CODE',
      'PREV_STATUS_CODE',
      'STATUS_DATE',
    ],
  },
  wellbore: {
    fileStem: 'dp_wellbore_pending_',
    label: 'Wellbore records',
    columns: [
      'UNIVERSAL_DOC_NO',
      'WELLBORE_ID',
      'WB_HB_WAIVER_FLAG',
      'WB_RULE_37_FLAG',
      'WB_RULE_38_FLAG',
      'WB_CASE_NO',
      'WB_HEARING_DATE',
      'WB_RULE_37_DISTANCE_1',
      'WB_RULE_37_DISTANCE_2',
      'WB_RULE_38_DISTANCE',
      'MULTI_BORE_HB1305_FLAG',
      'DISTRICT_NO',
      'COUNTY_CODE',
      'SURVEY_NAME',
      'LEASE_NAME',
      'WELL_NO',
      'API_SEQ_NO',
      'SIDETRACK_FLAG',
      'WB_NEAREST_TOWN',
      'WB_NEAREST_TOWN_DISTANCE',
      'WB_WELL_NO',
      'WB_FIELD_NO',
      'WB_FLD_RESERVOIR_NO',
      'WB_NUM_ACRES',
      'WB_DRILL_DEPTH',
      'WB_TOTAL_DEPTH',
      'WB_GAS_UNIT_NO',
      'WB_NUMBER_COMPLETIONS',
      'WB_PERCENT_ALLOCATION',
      'WB_PRODUCING_STATUS',
      'SURFACE_LOCATION_CODE',
      'WB_HB2259_FLAG',
      'WB_PSID',
      'WB_PERMIT_TYPE_FLAG',
      'WB_GAS_FIELDS_FLAG',
      'WB_OIL_FIELDS_FLAG',
      'WB_ASSIGNED_TO_FLAG',
      'WB_PENDING_DOC_NO',
      'WB_PENDING_DOC_SEQ_NO',
    ],
  },
  latlong: {
    fileStem: 'dp_latlongs_pending_',
    label: 'Lat/long records',
    columns: ['API_SEQUENCE_NUMBER', 'LATITUDE', 'LONGITUDE', 'LOCATION_TYPE'],
  },
};

type PendingDrillingRow<TColumns extends readonly string[]> = Record<
  TColumns[number],
  string
>;

export interface PendingDrillingImportSource {
  importId?: string | null;
  fileName: string;
  text: string;
}

export interface PendingDrillingCoordinate {
  locationType: string;
  latitude: string;
  longitude: string;
}

export interface PendingDrillingWellborePreview {
  universalDocNo: string;
  wellboreId: string;
  apiSequenceNumber: string;
  districtNo: string;
  countyCode: string;
  surveyName: string;
  leaseName: string;
  wellNo: string;
  nearestTown: string;
  nearestTownDistance: string;
  totalDepth: string;
  coordinates: PendingDrillingCoordinate[];
}

export interface PendingDrillingPermitPreview {
  universalDocNo: string;
  statusNumber: string;
  submitDate: string;
  permitTypeCode: string;
  operatorName: string;
  operatorNumber: string;
  districtNo: string;
  countyCode: string;
  surveyName: string;
  leaseName: string;
  wellNo: string;
  totalDepth: string;
  filingPurposeCode: string;
  statusCode: string;
  wellbores: PendingDrillingWellborePreview[];
}

export interface PendingDrillingParsedFileSummary {
  importId: string | null;
  fileName: string;
  fileKind: PendingDrillingSupportedFileKind | null;
  label: string;
  recordCount: number;
  warnings: string[];
}

export interface PendingDrillingDecodeResult {
  parsedFiles: PendingDrillingParsedFileSummary[];
  permits: PendingDrillingPermitPreview[];
  warnings: string[];
  missingCoreFiles: PendingDrillingSupportedFileKind[];
  totals: {
    permitCount: number;
    wellboreCount: number;
    coordinateCount: number;
  };
}

function normalizeKey(value: string) {
  return value.trim();
}

function normalizeLocationType(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === 'surface') return 'Surface';
  if (lower === 'bottom') return 'Bottom';
  return value.trim() || 'Unknown';
}

function locationRank(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === 'surface') return 0;
  if (lower === 'bottom') return 1;
  return 2;
}

function parseDelimitedRecords<const TColumns extends readonly string[]>(
  text: string,
  columns: TColumns,
  fileName: string
): {
  rows: Array<PendingDrillingRow<TColumns>>;
  warnings: string[];
} {
  const parsed = parseKnownRrcDelimitedRecords(text, columns, fileName);
  return {
    rows: parsed.rows as Array<PendingDrillingRow<TColumns>>,
    warnings: parsed.warnings,
  };
}

export function detectPendingDrillingFileKind(
  fileName: string
): PendingDrillingSupportedFileKind | null {
  const lowerFileName = fileName.toLowerCase();

  for (const [fileKind, spec] of Object.entries(PENDING_DRILLING_FILE_SPECS) as Array<
    [PendingDrillingSupportedFileKind, PendingDrillingFileSpec]
  >) {
    if (lowerFileName.includes(spec.fileStem)) {
      return fileKind;
    }
  }

  return null;
}

export function getPendingDrillingFileLabel(
  fileKind: PendingDrillingSupportedFileKind
) {
  return PENDING_DRILLING_FILE_SPECS[fileKind].label;
}

export function decodePendingDrillingImports(
  imports: PendingDrillingImportSource[]
): PendingDrillingDecodeResult {
  const parsedFiles: PendingDrillingParsedFileSummary[] = [];
  const warnings: string[] = [];

  const permitRows: Array<
    PendingDrillingRow<
      typeof PENDING_DRILLING_FILE_SPECS.drillingPermit.columns
    >
  > = [];
  const wellboreRows: Array<
    PendingDrillingRow<typeof PENDING_DRILLING_FILE_SPECS.wellbore.columns>
  > = [];
  const latlongRows: Array<
    PendingDrillingRow<typeof PENDING_DRILLING_FILE_SPECS.latlong.columns>
  > = [];

  imports.forEach((researchImport) => {
    const fileKind = detectPendingDrillingFileKind(researchImport.fileName);
    if (!fileKind) {
      parsedFiles.push({
        importId: researchImport.importId ?? null,
        fileName: researchImport.fileName,
        fileKind: null,
        label: 'Staged only',
        recordCount: 0,
        warnings: [],
      });
      return;
    }

    const spec = PENDING_DRILLING_FILE_SPECS[fileKind];
    const parsed = parseDelimitedRecords(
      researchImport.text,
      spec.columns,
      researchImport.fileName
    );

    parsedFiles.push({
      importId: researchImport.importId ?? null,
      fileName: researchImport.fileName,
      fileKind,
      label: spec.label,
      recordCount: parsed.rows.length,
      warnings: parsed.warnings,
    });
    warnings.push(...parsed.warnings);

    if (fileKind === 'drillingPermit') {
      permitRows.push(...parsed.rows);
      return;
    }
    if (fileKind === 'wellbore') {
      wellboreRows.push(...parsed.rows);
      return;
    }
    latlongRows.push(...parsed.rows);
  });

  const latlongByApi = new Map<string, PendingDrillingCoordinate[]>();
  const seenCoordinateKeys = new Set<string>();
  let duplicateCoordinateCount = 0;

  latlongRows.forEach((row) => {
    const apiSequenceNumber = normalizeKey(row.API_SEQUENCE_NUMBER);
    if (!apiSequenceNumber) {
      warnings.push(
        'One or more lat/long rows were skipped because API_SEQUENCE_NUMBER was blank.'
      );
      return;
    }

    const coordinate: PendingDrillingCoordinate = {
      locationType: normalizeLocationType(row.LOCATION_TYPE),
      latitude: row.LATITUDE,
      longitude: row.LONGITUDE,
    };
    const coordinateKey = [
      apiSequenceNumber,
      coordinate.locationType,
      coordinate.latitude,
      coordinate.longitude,
    ].join('|');

    if (seenCoordinateKeys.has(coordinateKey)) {
      duplicateCoordinateCount += 1;
      return;
    }

    seenCoordinateKeys.add(coordinateKey);
    const existing = latlongByApi.get(apiSequenceNumber) ?? [];
    existing.push(coordinate);
    existing.sort((left, right) => {
      const byLocation = locationRank(left.locationType) - locationRank(right.locationType);
      if (byLocation !== 0) return byLocation;
      return left.locationType.localeCompare(right.locationType);
    });
    latlongByApi.set(apiSequenceNumber, existing);
  });

  if (duplicateCoordinateCount > 0) {
    warnings.push(
      `${duplicateCoordinateCount} duplicate lat/long rows were ignored while building the joined preview.`
    );
  }

  const wellboresByDocument = new Map<string, PendingDrillingWellborePreview[]>();
  const knownWellboreKeys = new Set<string>();
  const wellboreDocumentKeys = new Set<string>();
  let duplicateWellboreCount = 0;
  let wellboresWithoutCoordinates = 0;

  wellboreRows.forEach((row) => {
    const universalDocNo = normalizeKey(row.UNIVERSAL_DOC_NO);
    if (!universalDocNo) {
      warnings.push(
        'One or more wellbore rows were skipped because UNIVERSAL_DOC_NO was blank.'
      );
      return;
    }

    const wellboreKey = [
      universalDocNo,
      normalizeKey(row.WELLBORE_ID),
      normalizeKey(row.API_SEQ_NO),
    ].join('|');
    if (knownWellboreKeys.has(wellboreKey)) {
      duplicateWellboreCount += 1;
      return;
    }

    knownWellboreKeys.add(wellboreKey);
    wellboreDocumentKeys.add(universalDocNo);
    const apiSequenceNumber = normalizeKey(row.API_SEQ_NO);
    const coordinates = apiSequenceNumber
      ? [...(latlongByApi.get(apiSequenceNumber) ?? [])]
      : [];
    if (coordinates.length === 0) {
      wellboresWithoutCoordinates += 1;
    }

    const preview: PendingDrillingWellborePreview = {
      universalDocNo,
      wellboreId: row.WELLBORE_ID,
      apiSequenceNumber,
      districtNo: row.DISTRICT_NO,
      countyCode: row.COUNTY_CODE,
      surveyName: row.SURVEY_NAME,
      leaseName: row.LEASE_NAME,
      wellNo: row.WELL_NO,
      nearestTown: row.WB_NEAREST_TOWN,
      nearestTownDistance: row.WB_NEAREST_TOWN_DISTANCE,
      totalDepth: row.WB_TOTAL_DEPTH,
      coordinates,
    };

    const existing = wellboresByDocument.get(universalDocNo) ?? [];
    existing.push(preview);
    wellboresByDocument.set(universalDocNo, existing);
  });

  if (duplicateWellboreCount > 0) {
    warnings.push(
      `${duplicateWellboreCount} duplicate wellbore rows were ignored while building the joined preview.`
    );
  }
  if (wellboresWithoutCoordinates > 0) {
    warnings.push(
      `${wellboresWithoutCoordinates} wellbore rows did not find matching lat/long coordinates yet.`
    );
  }

  const permits: PendingDrillingPermitPreview[] = [];
  const permitDocumentKeys = new Set<string>();
  const knownPermitKeys = new Set<string>();
  let duplicatePermitCount = 0;

  permitRows.forEach((row, rowIndex) => {
    const universalDocNo = normalizeKey(row.UNIVERSAL_DOC_NO);
    const permitKey = universalDocNo || `missing-doc-${rowIndex + 1}`;
    if (knownPermitKeys.has(permitKey)) {
      duplicatePermitCount += 1;
      return;
    }

    knownPermitKeys.add(permitKey);
    if (universalDocNo) {
      permitDocumentKeys.add(universalDocNo);
    } else {
      warnings.push(
        'One or more permit rows are missing UNIVERSAL_DOC_NO, so linked wellbore data may be incomplete.'
      );
    }

    permits.push({
      universalDocNo,
      statusNumber: row.STATUS_NUMBER,
      submitDate: row.SUBMIT_DATE,
      permitTypeCode: row.PERMIT_TYPE_CODE,
      operatorName: row.OPERATOR_NAME,
      operatorNumber: row.OPERATOR_NO,
      districtNo: row.DISTRICT_NO,
      countyCode: row.COUNTY_CODE,
      surveyName: row.SURVEY_NAME,
      leaseName: row.LEASE_NAME,
      wellNo: row.WELL_NO,
      totalDepth: row.TOTAL_DEPTH,
      filingPurposeCode: row.FILING_PURPOSE_CODE,
      statusCode: row.STATUS_CODE,
      wellbores: wellboresByDocument.get(universalDocNo) ?? [],
    });
  });

  if (duplicatePermitCount > 0) {
    warnings.push(
      `${duplicatePermitCount} duplicate permit rows were ignored while building the joined preview.`
    );
  }

  let orphanWellboreCount = 0;
  wellboreDocumentKeys.forEach((documentKey) => {
    if (!permitDocumentKeys.has(documentKey)) {
      orphanWellboreCount += 1;
    }
  });
  if (orphanWellboreCount > 0) {
    warnings.push(
      `${orphanWellboreCount} wellbore document groups did not find a matching permit row.`
    );
  }

  let orphanCoordinateCount = 0;
  latlongByApi.forEach((coordinates, apiSequenceNumber) => {
    const hasWellbore = wellboreRows.some(
      (row) => normalizeKey(row.API_SEQ_NO) === apiSequenceNumber
    );
    if (!hasWellbore) {
      orphanCoordinateCount += coordinates.length;
    }
  });
  if (orphanCoordinateCount > 0) {
    warnings.push(
      `${orphanCoordinateCount} lat/long rows did not find a matching wellbore row.`
    );
  }

  const missingCoreFiles = (
    Object.keys(PENDING_DRILLING_FILE_SPECS) as PendingDrillingSupportedFileKind[]
  ).filter((fileKind) => !parsedFiles.some((parsedFile) => parsedFile.fileKind === fileKind));

  if (permits.length === 0) {
    warnings.push(
      'No permit rows are available yet. Import a dp_drilling_permit_pending file to build the joined permit preview.'
    );
  }

  return {
    parsedFiles,
    permits,
    warnings: Array.from(new Set(warnings)),
    missingCoreFiles,
    totals: {
      permitCount: permits.length,
      wellboreCount: knownWellboreKeys.size,
      coordinateCount: seenCoordinateKeys.size,
    },
  };
}
