import { describe, expect, it } from 'vitest';
import { decodeDrillingPermitMasterImports } from '../rrc-drilling-permit-master';

function buildFixedWidthLine(
  recordId: string,
  width: number,
  values: Array<[start: number, value: string]>
) {
  const chars = Array(width).fill(' ');
  recordId.split('').forEach((character, index) => {
    chars[index] = character;
  });

  values.forEach(([start, value]) => {
    value.split('').forEach((character, index) => {
      const position = start - 1 + index;
      if (position >= 0 && position < chars.length) {
        chars[position] = character;
      }
    });
  });

  return chars.join('');
}

describe('rrc-drilling-permit-master', () => {
  it('joins fixed-width root, permit, and coordinate records into a readable preview', () => {
    const root = buildFixedWidthLine('01', 186, [
      [3, '3200001'],
      [10, '99'],
      [12, '135'],
      [15, 'RAVEN FOREST A'.padEnd(32, ' ')],
      [47, '08'],
      [49, '123456'],
      [59, '20260330'],
      [67, 'Ferrari Land LLC'.padEnd(32, ' ')],
      [101, 'A'],
      [113, '3200001'],
      [120, '20260401'],
      [157, '1H'.padEnd(6, ' ')],
    ]);
    const permit = buildFixedWidthLine('02', 358, [
      [3, '3200001'],
      [10, '99'],
      [12, '135'],
      [15, 'RAVEN FOREST A'.padEnd(32, ' ')],
      [47, '08'],
      [49, '1H'.padEnd(6, ' ')],
      [55, '11200'],
      [60, '123456'],
      [66, 'NW'],
      [122, '20260330'],
      [130, '20260401'],
      [244, '12'.padEnd(8, ' ')],
      [252, 'B'.padEnd(10, ' ')],
      [262, 'J THOMAS'.padEnd(55, ' ')],
      [317, '000123'],
      [326, '00012550'],
      [346, 'Midland'.padEnd(13, ' ')],
    ]);
    const surface = buildFixedWidthLine('14', 26, [
      [3, '001021234567'],
      [15, '000311234567'],
    ]);
    const bottom = buildFixedWidthLine('15', 26, [
      [3, '001022234567'],
      [15, '000312234567'],
    ]);

    const decoded = decodeDrillingPermitMasterImports([
      {
        importId: 'master-1',
        fileName: 'drilling-permit-master.asc',
        text: [root, permit, surface, bottom].join('\n'),
      },
    ]);

    expect(decoded.warnings).toEqual([]);
    expect(decoded.totals).toEqual({
      permitCount: 1,
      surfaceLocationCount: 1,
      bottomHoleCount: 1,
      recognizedFileCount: 1,
    });
    expect(decoded.parsedFiles[0]).toMatchObject({
      label: 'Core permit records',
      recordCount: 4,
      counts: {
        statusRoot: 1,
        permit: 1,
        surfaceLocation: 1,
        bottomHole: 1,
      },
    });
    expect(decoded.permits[0]).toMatchObject({
      permitNumber: '3200001',
      statusNumber: '3200001',
      operatorName: 'Ferrari Land LLC',
      leaseName: 'RAVEN FOREST A',
      districtNo: '08',
      countyCode: '135',
      totalDepth: '11200',
      nearestCity: 'Midland',
      surfaceAcres: '125.5',
    });
    expect(decoded.permits[0]?.coordinates).toEqual([
      {
        locationType: 'Surface',
        latitude: '31.1234567',
        longitude: '-102.1234567',
      },
      {
        locationType: 'Bottom Hole',
        latitude: '31.2234567',
        longitude: '-102.2234567',
      },
    ]);
  });

  it('keeps companion-only files staged without pretending they are decoded', () => {
    const decoded = decodeDrillingPermitMasterImports([
      {
        importId: 'segments-only',
        fileName: 'drilling-permit-companion.asc',
        text: '03' + '0'.repeat(80),
      },
    ]);

    expect(decoded.parsedFiles[0]).toMatchObject({
      label: 'Companion segments only',
      recognized: false,
      recordCount: 0,
      ignoredRecordTypes: ['03 (1)'],
    });
    expect(decoded.warnings).toContain(
      'No permit master rows are available yet. Import an ASCII drilling-permit master file to build the fixed-width permit preview.'
    );
  });
});
