import { describe, expect, it } from 'vitest';
import { parseRrcFixedWidthRecords } from '../rrc-fixed-width';

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
});
