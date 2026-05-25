import { describe, expect, it } from 'vitest';
import {
  parseRrcFixedWidthRecords,
  parseRrcFixedWidthRows,
} from '../rrc-fixed-width';

describe('rrc-fixed-width', () => {
  it('parses known record ids and pads short lines safely', () => {
    const parsed = parseRrcFixedWidthRecords(
      ['01ABC', '99ignored'].join('\n'),
      'sample.asc',
      [
        {
          id: '01',
          label: 'Root',
          fields: [
            { name: 'recordId', start: 1, end: 2 },
            { name: 'value', start: 3, end: 8 },
          ],
        },
      ] as const
    );

    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.values.value).toBe('ABC');
    expect(parsed.warnings[0]).toContain('padded as blank');
    expect(parsed.unknownRecordCounts).toEqual({ '99': 1 });
  });

  it('treats field positions as 1-indexed and end-inclusive', () => {
    const parsed = parseRrcFixedWidthRows(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'positions.asc',
      [
        { name: 'first', start: 1, end: 1 },
        { name: 'middle', start: 2, end: 5 },
        { name: 'last', start: 26, end: 26 },
      ] as const
    );

    expect(parsed.rows[0]?.values).toEqual({
      first: 'A',
      middle: 'BCDE',
      last: 'Z',
    });
    expect(parsed.warnings).toEqual([]);
  });

  it('preserves fixed-width spacing when trim is disabled', () => {
    const parsed = parseRrcFixedWidthRows(
      'AA  BB',
      'spacing.asc',
      [
        { name: 'left', start: 1, end: 2 },
        { name: 'spaced', start: 3, end: 6, trim: false },
      ] as const
    );

    expect(parsed.rows[0]?.values).toEqual({
      left: 'AA',
      spaced: '  BB',
    });
  });
});
