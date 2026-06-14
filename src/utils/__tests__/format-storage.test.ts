import { describe, expect, it } from 'vitest';
import { formatBytes, formatTimestamp } from '../format-storage';

describe('format-storage (DEF-STOR-01)', () => {
  it('formats bytes across unit scales', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2 * 1024)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    // >=10 in a unit drops the decimal.
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });

  it('formats timestamps and guards bad input', () => {
    expect(formatTimestamp(null)).toBe('never');
    expect(formatTimestamp('not-a-date')).toBe('never');
    expect(formatTimestamp('2026-06-14T12:00:00.000Z')).not.toBe('never');
  });
});
