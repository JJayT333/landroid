import { describe, expect, it } from 'vitest';
import {
  normalizeInterestString,
  parseInterestString,
  parseStrictInterestString,
} from '../interest-string';

describe('parseInterestString', () => {
  describe('fraction forms', () => {
    it('parses standard royalty fractions', () => {
      expect(parseInterestString('1/8').toString()).toBe('0.125');
      expect(parseInterestString('3/16').toString()).toBe('0.1875');
      expect(parseInterestString('1/4').toString()).toBe('0.25');
      expect(parseInterestString('1/2').toString()).toBe('0.5');
    });

    it('parses small-denominator ORRI fractions', () => {
      expect(parseInterestString('1/80').toString()).toBe('0.0125');
      expect(parseInterestString('1/64').toString()).toBe('0.015625');
      expect(parseInterestString('1/32').toString()).toBe('0.03125');
      expect(parseInterestString('1/16').toString()).toBe('0.0625');
    });

    it('parses repeating decimals at configured precision', () => {
      // Decimal.js is configured for 40-digit precision; we don't pin the exact
      // string representation but we do pin that the numeric value is correct.
      expect(parseInterestString('1/3').toNumber()).toBeCloseTo(1 / 3, 15);
      expect(parseInterestString('2/3').toNumber()).toBeCloseTo(2 / 3, 15);
      // And that it carries more than 15 digits of precision under the hood.
      expect(parseInterestString('1/3').toString().length).toBeGreaterThan(20);
    });

    it('parses equivalent fractions consistently', () => {
      expect(parseInterestString('2/16').toString()).toBe(
        parseInterestString('1/8').toString()
      );
      expect(parseInterestString('4/32').toString()).toBe(
        parseInterestString('1/8').toString()
      );
    });

    it('trims whitespace inside fractions', () => {
      expect(parseInterestString(' 1 / 8 ').toString()).toBe('0.125');
      expect(parseInterestString('  3/16').toString()).toBe('0.1875');
    });
  });

  describe('decimal forms', () => {
    it('parses decimal strings', () => {
      expect(parseInterestString('0.125').toString()).toBe('0.125');
      expect(parseInterestString('0.5').toString()).toBe('0.5');
      expect(parseInterestString('1').toString()).toBe('1');
      expect(parseInterestString('0').toString()).toBe('0');
    });

    it('parses numeric values', () => {
      expect(parseInterestString(0.125).toString()).toBe('0.125');
      expect(parseInterestString(1).toString()).toBe('1');
      expect(parseInterestString(0).toString()).toBe('0');
    });
  });

  describe('nullish and empty', () => {
    it('returns 0 for nullish input', () => {
      expect(parseInterestString(null).toString()).toBe('0');
      expect(parseInterestString(undefined).toString()).toBe('0');
    });

    it('returns 0 for empty or whitespace-only strings', () => {
      expect(parseInterestString('').toString()).toBe('0');
      expect(parseInterestString('   ').toString()).toBe('0');
    });
  });

  describe('degenerate fraction forms', () => {
    it('treats zero denominator as invalid and falls through to 0', () => {
      // '1/0' has two parts but denominator is 0; the function falls through
      // to clampUnit(d(raw)), and raw 'N/0' is not a valid Decimal → d() returns 0.
      expect(parseInterestString('1/0').toString()).toBe('0');
    });

    it('returns 0 for fractions with missing numerator or denominator', () => {
      expect(parseInterestString('/8').toString()).toBe('0');
      expect(parseInterestString('1/').toString()).toBe('0');
    });

    it('returns 0 for multi-slash garbage', () => {
      // '1/2/3' splits into 3 parts, fails the length===2 check,
      // then raw '1/2/3' is not a valid Decimal → 0.
      expect(parseInterestString('1/2/3').toString()).toBe('0');
    });

    it('returns 0 for non-numeric input', () => {
      expect(parseInterestString('abc').toString()).toBe('0');
      expect(parseInterestString('not a number').toString()).toBe('0');
    });
  });

  describe('clamping to [0, 1]', () => {
    it('clamps values greater than 1 to 1', () => {
      // '5/4' is a valid fraction that evaluates to 1.25, which clampUnit floors to 1.
      expect(parseInterestString('5/4').toString()).toBe('1');
      expect(parseInterestString('2').toString()).toBe('1');
      expect(parseInterestString('10/10').toString()).toBe('1');
    });

    it('clamps negative values to 0', () => {
      expect(parseInterestString('-0.5').toString()).toBe('0');
      expect(parseInterestString('-1/8').toString()).toBe('0');
    });

    it('leaves zero and boundary values alone', () => {
      expect(parseInterestString('1').toString()).toBe('1');
      expect(parseInterestString('0').toString()).toBe('0');
      expect(parseInterestString('1/1').toString()).toBe('1');
    });
  });
});

describe('normalizeInterestString', () => {
  it('serializes fractions to fixed-precision decimal strings', () => {
    expect(normalizeInterestString('1/8')).toBe('0.125000000');
    expect(normalizeInterestString('3/16')).toBe('0.187500000');
    expect(normalizeInterestString('1/80')).toBe('0.012500000');
  });

  it('passes through well-formed decimals', () => {
    expect(normalizeInterestString('0.125')).toBe('0.125000000');
    expect(normalizeInterestString('0.5')).toBe('0.500000000');
  });

  it('returns an empty string for whitespace-only input', () => {
    // Distinct from parseInterestString, which returns 0 for ''.
    expect(normalizeInterestString('')).toBe('');
    expect(normalizeInterestString('   ')).toBe('');
  });

  it('normalizes clamped input', () => {
    // '-1/8' clamps to 0 inside parseInterestString, then serializes as '0.000000000'.
    expect(normalizeInterestString('-1/8')).toBe('0.000000000');
    // '5/4' clamps to 1.
    expect(normalizeInterestString('5/4')).toBe('1.000000000');
  });
});

describe('parseStrictInterestString', () => {
  describe('accepted input (same numeric answers as parseInterestString)', () => {
    it('parses standard royalty fractions identically', () => {
      expect(parseStrictInterestString('1/8')?.toString()).toBe('0.125');
      expect(parseStrictInterestString('3/16')?.toString()).toBe('0.1875');
      expect(parseStrictInterestString('1/4')?.toString()).toBe('0.25');
      expect(parseStrictInterestString('1/2')?.toString()).toBe('0.5');
    });

    it('parses decimal strings', () => {
      expect(parseStrictInterestString('0.125')?.toString()).toBe('0.125');
      expect(parseStrictInterestString('1')?.toString()).toBe('1');
      expect(parseStrictInterestString('0')?.toString()).toBe('0');
    });

    it('parses numeric values', () => {
      expect(parseStrictInterestString(0.125)?.toString()).toBe('0.125');
      expect(parseStrictInterestString(0)?.toString()).toBe('0');
      expect(parseStrictInterestString(1)?.toString()).toBe('1');
    });

    it('trims whitespace inside fractions', () => {
      expect(parseStrictInterestString(' 1 / 8 ')?.toString()).toBe('0.125');
      expect(parseStrictInterestString('  3/16')?.toString()).toBe('0.1875');
    });

    it('clamps values greater than 1 to 1', () => {
      // Over-1 values are still "well-formed" — the clamp is a math guard, not a parse error.
      expect(parseStrictInterestString('5/4')?.toString()).toBe('1');
      expect(parseStrictInterestString('2')?.toString()).toBe('1');
    });

    it('clamps negative values to 0', () => {
      // Negative values are well-formed; clampUnit floors them at 0 the same as the
      // lenient parser. The strict parser only flags SHAPE errors, not range errors.
      expect(parseStrictInterestString('-0.5')?.toString()).toBe('0');
      expect(parseStrictInterestString('-1/8')?.toString()).toBe('0');
    });
  });

  describe('nullish and empty (treated as "not entered yet", returns Decimal(0))', () => {
    it('returns Decimal(0) for nullish input', () => {
      // Strict parse still treats "nothing to parse" as a legal zero. This lets callers
      // leave optional interest fields blank without triggering a form error.
      expect(parseStrictInterestString(null)?.toString()).toBe('0');
      expect(parseStrictInterestString(undefined)?.toString()).toBe('0');
    });

    it('returns Decimal(0) for empty or whitespace-only strings', () => {
      expect(parseStrictInterestString('')?.toString()).toBe('0');
      expect(parseStrictInterestString('   ')?.toString()).toBe('0');
    });
  });

  describe('malformed input (returns null — caller should block save)', () => {
    it('returns null for non-numeric text', () => {
      expect(parseStrictInterestString('abc')).toBeNull();
      expect(parseStrictInterestString('not a number')).toBeNull();
      expect(parseStrictInterestString('one eighth')).toBeNull();
    });

    it('returns null for zero-denominator fractions', () => {
      // Distinct from the lenient parser, which falls through to d('1/0') = 0.
      expect(parseStrictInterestString('1/0')).toBeNull();
    });

    it('returns null for fractions with missing numerator or denominator', () => {
      expect(parseStrictInterestString('/8')).toBeNull();
      expect(parseStrictInterestString('1/')).toBeNull();
      expect(parseStrictInterestString('/')).toBeNull();
    });

    it('returns null for multi-slash garbage', () => {
      // "1/2/3" and "1//8" are both split into 3+ parts.
      expect(parseStrictInterestString('1/2/3')).toBeNull();
      expect(parseStrictInterestString('1//8')).toBeNull();
    });

    it('returns null for partly-numeric strings', () => {
      expect(parseStrictInterestString('1/8x')).toBeNull();
      expect(parseStrictInterestString('abc/8')).toBeNull();
      expect(parseStrictInterestString('1/abc')).toBeNull();
    });
  });

  describe('contrast with parseInterestString', () => {
    it('strict returns null where lenient returns 0 (malformed shapes)', () => {
      // These are the cases that finding #4 called out as silently masking user typos.
      expect(parseInterestString('abc').toString()).toBe('0');
      expect(parseStrictInterestString('abc')).toBeNull();

      expect(parseInterestString('1/0').toString()).toBe('0');
      expect(parseStrictInterestString('1/0')).toBeNull();

      expect(parseInterestString('1/2/3').toString()).toBe('0');
      expect(parseStrictInterestString('1/2/3')).toBeNull();
    });

    it('strict and lenient agree on legitimate zero ("empty" is not malformed)', () => {
      expect(parseInterestString('').toString()).toBe('0');
      expect(parseStrictInterestString('')?.toString()).toBe('0');

      expect(parseInterestString(null).toString()).toBe('0');
      expect(parseStrictInterestString(null)?.toString()).toBe('0');
    });
  });
});
