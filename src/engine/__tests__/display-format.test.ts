import { describe, expect, it } from 'vitest';
import {
  formatAcres,
  formatInterestDecimal,
  formatInterestDual,
  formatInterestPercent,
} from '../display-format';

describe('formatInterestDecimal', () => {
  it('renders at 9 decimal places', () => {
    expect(formatInterestDecimal('0.5')).toBe('0.500000000');
    expect(formatInterestDecimal('0.333333333')).toBe('0.333333333');
  });

  it('coerces empty/garbage to zero', () => {
    expect(formatInterestDecimal('')).toBe('0.000000000');
    expect(formatInterestDecimal('not a number')).toBe('0.000000000');
  });
});

describe('formatInterestDual', () => {
  it('shows decimal and simplified fraction', () => {
    expect(formatInterestDual('0.5')).toBe('0.500000000 | 1/2');
    expect(formatInterestDual('0.375')).toBe('0.375000000 | 3/8');
  });
});

describe('formatInterestPercent', () => {
  it('renders a 2dp percent gloss', () => {
    expect(formatInterestPercent('0.5')).toBe('50.00%');
    expect(formatInterestPercent('0.125')).toBe('12.50%');
    expect(formatInterestPercent('0')).toBe('0.00%');
  });
});

describe('formatAcres', () => {
  it('renders a dash for the empty/zero case', () => {
    expect(formatAcres('')).toBe('—');
    expect(formatAcres('0')).toBe('—');
  });

  it('renders whole acres without trailing zeros', () => {
    expect(formatAcres('640')).toBe('640');
  });

  it('renders fractional acres at 3dp', () => {
    expect(formatAcres('123.456789')).toBe('123.457');
    expect(formatAcres('40.5')).toBe('40.500');
  });
});
