import Decimal from 'decimal.js';
import { clampUnit, d, serialize } from '../engine/decimal';

export function parseInterestString(
  value: string | number | null | undefined
): Decimal {
  if (value === undefined || value === null) {
    return d(0);
  }

  const raw = String(value).trim();
  if (raw.length === 0) {
    return d(0);
  }

  const parts = raw.split('/').map((part) => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    const numerator = d(parts[0]);
    const denominator = d(parts[1]);
    if (!denominator.isZero()) {
      return clampUnit(numerator.div(denominator));
    }
  }

  return clampUnit(d(raw));
}

/**
 * Strict parser for leasehold form inputs (lease royalty rate, leased interest,
 * ORRI burden, WI assignment fraction). Unlike `parseInterestString` which
 * silently coerces malformed input to 0 for display callers, this returns
 * `null` on anything that isn't a well-formed fraction or decimal so the
 * caller can surface a form error instead of quietly saving a zero.
 *
 * Distinct semantics versus `parseInterestString`:
 *   - `null` / `undefined` / empty / whitespace-only  → `Decimal(0)` (not an error;
 *     "no value entered yet" is a legal state for optional fields).
 *   - Well-formed "a/b" fractions and decimal strings → `clampUnit(value)`.
 *   - Anything else (`"abc"`, `"1//8"`, `"1/2/3"`, `"/8"`, `"1/"`, `"1/0"`) → `null`.
 *
 * Matches the audit finding #4 recommendation: keep the lenient parser for
 * display paths, add a strict parser for form-save paths. Wire this through
 * lease / ORRI / WI-assignment save handlers with inline form-error surfacing.
 */
export function parseStrictInterestString(
  value: string | number | null | undefined
): Decimal | null {
  if (value === undefined || value === null) {
    return d(0);
  }

  const raw = String(value).trim();
  if (raw.length === 0) {
    return d(0);
  }

  const parts = raw.split('/').map((part) => part.trim());
  if (parts.length === 1) {
    try {
      return clampUnit(new Decimal(raw));
    } catch {
      return null;
    }
  }
  if (parts.length === 2) {
    if (!parts[0] || !parts[1]) {
      return null;
    }
    let numerator: Decimal;
    let denominator: Decimal;
    try {
      numerator = new Decimal(parts[0]);
      denominator = new Decimal(parts[1]);
    } catch {
      return null;
    }
    if (denominator.isZero()) {
      return null;
    }
    return clampUnit(numerator.div(denominator));
  }

  // Multi-slash garbage such as "1/2/3" or "1//8".
  return null;
}

export function normalizeInterestString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return serialize(parseInterestString(trimmed));
}
