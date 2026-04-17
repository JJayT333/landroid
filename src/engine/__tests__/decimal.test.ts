import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  clamp,
  clampUnit,
  d,
  display,
  DISPLAY_PRECISION,
  serialize,
  STORAGE_PRECISION,
} from '../decimal';

describe('d()', () => {
  describe('accepted input', () => {
    it('parses decimal strings', () => {
      expect(d('0.125').toString()).toBe('0.125');
      expect(d('1').toString()).toBe('1');
      expect(d('0').toString()).toBe('0');
    });

    it('parses numeric values', () => {
      expect(d(0.125).toString()).toBe('0.125');
      expect(d(0).toString()).toBe('0');
      expect(d(1).toString()).toBe('1');
    });

    it('returns the same Decimal instance when given one', () => {
      const input = new Decimal('0.5');
      expect(d(input)).toBe(input);
    });

    it('preserves high-precision input beyond JS number precision', () => {
      // 17-digit input that would lose precision if coerced through Number.
      const raw = '0.12345678901234567';
      expect(d(raw).toString()).toBe('0.12345678901234567');
    });

    it('parses negative values without clamping (d() is a parser, not a clamp)', () => {
      expect(d('-0.5').toString()).toBe('-0.5');
      expect(d(-1).toString()).toBe('-1');
    });
  });

  describe('fallbacks to zero', () => {
    it('returns 0 for nullish input', () => {
      expect(d(null).toString()).toBe('0');
      expect(d(undefined).toString()).toBe('0');
    });

    it('returns 0 for empty string', () => {
      expect(d('').toString()).toBe('0');
    });

    it('returns 0 for unparseable input', () => {
      expect(d('abc').toString()).toBe('0');
      expect(d('not a number').toString()).toBe('0');
    });

    it('returns 0 for whitespace-only strings via the catch clause', () => {
      // d('   ') doesn't take the `=== ''` early-return; it flows into
      // `new Decimal('   ')` which throws DecimalError, and the catch returns 0.
      // Same external observable (→ 0), different code path than empty-string.
      expect(d('   ').toString()).toBe('0');
    });
  });
});

describe('clamp()', () => {
  it('passes through positive values unchanged', () => {
    expect(clamp(new Decimal('0.5')).toString()).toBe('0.5');
    expect(clamp(new Decimal('1')).toString()).toBe('1');
    expect(clamp(new Decimal('1000')).toString()).toBe('1000');
  });

  it('passes through zero unchanged', () => {
    expect(clamp(new Decimal('0')).toString()).toBe('0');
  });

  it('clamps negative values to 0', () => {
    expect(clamp(new Decimal('-0.5')).toString()).toBe('0');
    expect(clamp(new Decimal('-1e-20')).toString()).toBe('0');
    expect(clamp(new Decimal('-999')).toString()).toBe('0');
  });

  it('clamps NaN to 0', () => {
    expect(clamp(new Decimal(NaN)).toString()).toBe('0');
  });

  it('clamps +/- Infinity to 0', () => {
    expect(clamp(new Decimal(Infinity)).toString()).toBe('0');
    expect(clamp(new Decimal(-Infinity)).toString()).toBe('0');
  });

  it('does NOT cap at 1 — clamp is a floor-only helper', () => {
    // clamp keeps its upper range open; clampUnit is the [0,1] version.
    expect(clamp(new Decimal('1.5')).toString()).toBe('1.5');
    expect(clamp(new Decimal('2')).toString()).toBe('2');
  });
});

describe('clampUnit()', () => {
  it('passes through values in [0, 1]', () => {
    expect(clampUnit(new Decimal('0')).toString()).toBe('0');
    expect(clampUnit(new Decimal('0.125')).toString()).toBe('0.125');
    expect(clampUnit(new Decimal('0.5')).toString()).toBe('0.5');
    expect(clampUnit(new Decimal('1')).toString()).toBe('1');
  });

  it('clamps values greater than 1 down to 1', () => {
    expect(clampUnit(new Decimal('1.0000001')).toString()).toBe('1');
    expect(clampUnit(new Decimal('1.5')).toString()).toBe('1');
    expect(clampUnit(new Decimal('100')).toString()).toBe('1');
  });

  it('clamps negative values up to 0', () => {
    expect(clampUnit(new Decimal('-0.0000001')).toString()).toBe('0');
    expect(clampUnit(new Decimal('-0.5')).toString()).toBe('0');
    expect(clampUnit(new Decimal('-999')).toString()).toBe('0');
  });

  it('clamps NaN and Infinity to 0', () => {
    expect(clampUnit(new Decimal(NaN)).toString()).toBe('0');
    expect(clampUnit(new Decimal(Infinity)).toString()).toBe('0');
    expect(clampUnit(new Decimal(-Infinity)).toString()).toBe('0');
  });
});

describe('serialize()', () => {
  it('pads short decimals to DISPLAY_PRECISION', () => {
    expect(DISPLAY_PRECISION).toBe(9);
    expect(serialize(new Decimal('0.125'))).toBe('0.125000000');
    expect(serialize(new Decimal('0.5'))).toBe('0.500000000');
    expect(serialize(new Decimal('1'))).toBe('1.000000000');
    expect(serialize(new Decimal('0'))).toBe('0.000000000');
  });

  it('uses STORAGE_PRECISION significant digits for long decimals', () => {
    expect(STORAGE_PRECISION).toBe(24);
    // 1/3 at 40-digit precision has way more than 9 decimal places, so it
    // switches to significant-digits mode.
    const oneThird = new Decimal(1).div(3);
    const result = serialize(oneThird);
    // Should be truncated to 24 significant digits (implementation detail of
    // Decimal.js: may be shorter, but should never be longer than 24 sig figs).
    const sigFigs = result.replace(/^0\./, '').replace(/0+$/, '').length;
    expect(sigFigs).toBeLessThanOrEqual(STORAGE_PRECISION);
    expect(Number(result)).toBeCloseTo(1 / 3, 15);
  });

  it('serializes negatives as 0 (clamps before formatting)', () => {
    expect(serialize(new Decimal('-0.5'))).toBe('0.000000000');
  });
});

describe('display()', () => {
  it('formats values at DISPLAY_PRECISION', () => {
    expect(display('0.125')).toBe('0.125000000');
    expect(display('1')).toBe('1.000000000');
    expect(display('0')).toBe('0.000000000');
  });

  it('accepts Decimal instances', () => {
    expect(display(new Decimal('0.5'))).toBe('0.500000000');
  });

  it('rounds long decimals to DISPLAY_PRECISION (half-up)', () => {
    // 1/3 → 0.333333333
    expect(display(new Decimal(1).div(3))).toBe('0.333333333');
    // 2/3 → 0.666666667 (half-up)
    expect(display(new Decimal(2).div(3))).toBe('0.666666667');
  });
});
