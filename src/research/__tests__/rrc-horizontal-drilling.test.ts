import { describe, expect, it } from 'vitest';
import { decodeHorizontalDrillingImports } from '../rrc-horizontal-drilling';

function buildFixedWidthLine(
  width: number,
  values: Array<[start: number, value: string]>
) {
  const chars = Array(width).fill(' ');

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

describe('rrc-horizontal-drilling', () => {
  it('parses the fixed-width horizontal permit layout into a readable preview', () => {
    const row = buildFixedWidthLine(360, [
      [1, '3200001'],
      [8, '99'],
      [10, '08'],
      [12, 'HOWARD'.padEnd(13, ' ')],
      [25, '227'],
      [28, '39522'],
      [33, '741939'],
      [39, 'SABALO OPERATING LLC'.padEnd(32, ' ')],
      [71, 'LISA MARIE 34-27'.padEnd(32, ' ')],
      [103, '20180301'],
      [111, '09000'],
      [116, '34'.padEnd(8, ' ')],
      [124, '27'.padEnd(10, ' ')],
      [134, '001234'],
      [140, 'J THOMAS'.padEnd(55, ' ')],
      [195, '4AH'.padEnd(6, ' ')],
      [201, 'SPRABERRY'.padEnd(32, ' ')],
      [233, 'WOLFCAMP'.padEnd(32, ' ')],
      [265, '20180412'],
      [273, 'SABALO OPERATING LLC'.padEnd(32, ' ')],
      [305, 'G'],
      [306, '123456'],
      [312, 'LISA MARIE'.padEnd(32, ' ')],
      [344, '4AH'.padEnd(6, ' ')],
      [350, 'Y'],
      [351, '03'],
      [353, '02'],
    ]);

    const decoded = decodeHorizontalDrillingImports([
      {
        importId: 'horizontal-1',
        fileName: 'horizontal-drilling-permits.asc',
        text: row,
      },
    ]);

    expect(decoded.warnings).toEqual([]);
    expect(decoded.totals).toEqual({
      permitCount: 1,
      gasCount: 1,
      oilCount: 0,
      offScheduleCount: 1,
      recognizedFileCount: 1,
    });
    expect(decoded.parsedFiles[0]).toMatchObject({
      recognized: true,
      recordCount: 1,
    });
    expect(decoded.permits[0]).toMatchObject({
      permitNumber: '3200001',
      permitSequence: '99',
      countyName: 'HOWARD',
      apiNumber: '227-39522',
      operatorName: 'SABALO OPERATING LLC',
      leaseName: 'LISA MARIE 34-27',
      totalDepth: '09000',
      oilOrGas: 'G',
      offSchedule: true,
      totalPermittedFields: '03',
      totalValidatedFields: '02',
    });
  });

  it('warns cleanly when no horizontal rows are available', () => {
    const decoded = decodeHorizontalDrillingImports([
      {
        importId: 'empty-1',
        fileName: 'empty.asc',
        text: '',
      },
    ]);

    expect(decoded.parsedFiles[0]).toMatchObject({
      recognized: false,
      recordCount: 0,
      label: 'Staged only',
    });
    expect(decoded.warnings).toContain(
      'No horizontal permit rows are available yet. Import a horizontal drilling permits ASCII file to build the fixed-width preview.'
    );
  });
});
