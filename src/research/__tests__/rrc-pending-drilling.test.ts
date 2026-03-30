import { describe, expect, it } from 'vitest';
import {
  PENDING_DRILLING_FILE_SPECS,
  decodePendingDrillingImports,
  detectPendingDrillingFileKind,
  type PendingDrillingSupportedFileKind,
} from '../rrc-pending-drilling';

function buildDelimitedRow(
  fileKind: PendingDrillingSupportedFileKind,
  values: Record<string, string>
) {
  return PENDING_DRILLING_FILE_SPECS[fileKind].columns
    .map((column) => values[column] ?? '')
    .join('}');
}

describe('rrc-pending-drilling', () => {
  it('detects the supported core file kinds from official file names', () => {
    expect(
      detectPendingDrillingFileKind(
        'dp_drilling_permit_pending_20260329110000.txt'
      )
    ).toBe('drillingPermit');
    expect(
      detectPendingDrillingFileKind('dp_wellbore_pending_20260329110000.txt')
    ).toBe('wellbore');
    expect(
      detectPendingDrillingFileKind('dp_latlongs_pending_20260329110000.txt')
    ).toBe('latlong');
    expect(
      detectPendingDrillingFileKind('pendingdrillingpermits.pdf')
    ).toBeNull();
  });

  it('joins permit, wellbore, and lat/long rows into a readable preview', () => {
    const permitHeader = PENDING_DRILLING_FILE_SPECS.drillingPermit.columns.join('}');
    const wellboreHeader = PENDING_DRILLING_FILE_SPECS.wellbore.columns.join('}');
    const latlongHeader = PENDING_DRILLING_FILE_SPECS.latlong.columns.join('}');
    const permitRow = buildDelimitedRow('drillingPermit', {
      UNIVERSAL_DOC_NO: 'DOC-100',
      STATUS_NUMBER: '2026-0001',
      SUBMIT_DATE: '20260329',
      PERMIT_TYPE_CODE: 'N',
      OPERATOR_NO: '999999',
      OPERATOR_NAME: 'Ferrari Land LLC',
      DISTRICT_NO: '08',
      COUNTY_CODE: '123',
      SURVEY_NAME: 'J THOMAS',
      LEASE_NAME: 'SPRINGHILL',
      WELL_NO: '1H',
      TOTAL_DEPTH: '11200',
      FILING_PURPOSE_CODE: 'D',
      STATUS_CODE: 'PEND',
    });
    const wellboreRow = buildDelimitedRow('wellbore', {
      UNIVERSAL_DOC_NO: 'DOC-100',
      WELLBORE_ID: 'WB-1',
      DISTRICT_NO: '08',
      COUNTY_CODE: '123',
      SURVEY_NAME: 'J THOMAS',
      LEASE_NAME: 'SPRINGHILL',
      WELL_NO: '1H',
      API_SEQ_NO: '4212301234',
      WB_NEAREST_TOWN: 'Midland',
      WB_NEAREST_TOWN_DISTANCE: '12.5',
      WB_TOTAL_DEPTH: '11200',
    });
    const surfaceRow = buildDelimitedRow('latlong', {
      API_SEQUENCE_NUMBER: '4212301234',
      LATITUDE: '31.123456',
      LONGITUDE: '-102.123456',
      LOCATION_TYPE: 'Surface',
    });
    const bottomRow = buildDelimitedRow('latlong', {
      API_SEQUENCE_NUMBER: '4212301234',
      LATITUDE: '31.223456',
      LONGITUDE: '-102.223456',
      LOCATION_TYPE: 'Bottom',
    });

    const decoded = decodePendingDrillingImports([
      {
        importId: 'permit-1',
        fileName: 'dp_drilling_permit_pending_20260329110000.txt',
        text: [permitHeader, permitRow].join('\n'),
      },
      {
        importId: 'wellbore-1',
        fileName: 'dp_wellbore_pending_20260329110000.txt',
        text: [wellboreHeader, wellboreRow].join('\n'),
      },
      {
        importId: 'lat-1',
        fileName: 'dp_latlongs_pending_20260329110000.txt',
        text: [latlongHeader, surfaceRow, bottomRow].join('\n'),
      },
    ]);

    expect(decoded.missingCoreFiles).toEqual([]);
    expect(decoded.totals).toEqual({
      permitCount: 1,
      wellboreCount: 1,
      coordinateCount: 2,
    });
    expect(decoded.warnings).toEqual([]);
    expect(decoded.parsedFiles.map((file) => file.recordCount)).toEqual([1, 1, 2]);
    expect(decoded.permits).toHaveLength(1);
    expect(decoded.permits[0]).toMatchObject({
      universalDocNo: 'DOC-100',
      operatorName: 'Ferrari Land LLC',
      leaseName: 'SPRINGHILL',
      wellNo: '1H',
      districtNo: '08',
      statusCode: 'PEND',
    });
    expect(decoded.permits[0]?.wellbores).toHaveLength(1);
    expect(decoded.permits[0]?.wellbores[0]).toMatchObject({
      apiSequenceNumber: '4212301234',
      nearestTown: 'Midland',
      countyCode: '123',
    });
    expect(decoded.permits[0]?.wellbores[0]?.coordinates).toEqual([
      {
        locationType: 'Surface',
        latitude: '31.123456',
        longitude: '-102.123456',
      },
      {
        locationType: 'Bottom',
        latitude: '31.223456',
        longitude: '-102.223456',
      },
    ]);
  });

  it('keeps partial imports readable and warns when core files are missing', () => {
    const decoded = decodePendingDrillingImports([
      {
        importId: 'manual-1',
        fileName: 'pendingdrillingpermits.pdf',
        text: '',
      },
      {
        importId: 'lat-1',
        fileName: 'dp_latlongs_pending_20260329110000.txt',
        text: buildDelimitedRow('latlong', {
          API_SEQUENCE_NUMBER: '4212301234',
          LATITUDE: '31.123456',
          LONGITUDE: '-102.123456',
          LOCATION_TYPE: 'Surface',
        }),
      },
    ]);

    expect(decoded.parsedFiles[0]).toMatchObject({
      fileKind: null,
      label: 'Staged only',
      recordCount: 0,
    });
    expect(decoded.missingCoreFiles).toEqual(['drillingPermit', 'wellbore']);
    expect(decoded.totals.permitCount).toBe(0);
    expect(decoded.warnings).toContain(
      'No permit rows are available yet. Import a dp_drilling_permit_pending file to build the joined permit preview.'
    );
    expect(decoded.warnings).toContain(
      '1 lat/long rows did not find a matching wellbore row.'
    );
  });

  it('pads malformed short rows instead of crashing the decoder', () => {
    const decoded = decodePendingDrillingImports([
      {
        importId: 'permit-short',
        fileName: 'dp_drilling_permit_pending_20260329110000.txt',
        text: 'DOC-200}2026-0002',
      },
    ]);

    expect(decoded.parsedFiles[0]?.recordCount).toBe(1);
    expect(decoded.warnings[0]).toContain('had 2 fields; expected 47');
    expect(decoded.permits[0]).toMatchObject({
      universalDocNo: 'DOC-200',
      statusNumber: '2026-0002',
    });
  });
});
