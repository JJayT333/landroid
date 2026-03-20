/**
 * Decimal.js configuration for LANDroid.
 *
 * All ownership fractions use exactly 9 decimal places.
 * This module is the single source of truth for precision config.
 */
import Decimal from 'decimal.js';

// Configure globally: 20 significant digits, ROUND_HALF_UP, 9 decimal display
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Standard display precision for ownership fractions. */
export const DISPLAY_PRECISION = 9;

/** Parse any value into a Decimal, defaulting to zero on bad input. */
export function d(value: string | number | Decimal | undefined | null): Decimal {
  if (value instanceof Decimal) return value;
  if (value === undefined || value === null || value === '') return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

/** Clamp a Decimal to [0, ∞). Returns zero for negative near-zero values. */
export function clamp(value: Decimal): Decimal {
  if (value.isNaN() || !value.isFinite()) return new Decimal(0);
  if (value.isNegative()) return new Decimal(0);
  return value;
}

/** Clamp to [0, 1] interval for interest percentages. */
export function clampUnit(value: Decimal): Decimal {
  if (value.isNaN() || !value.isFinite()) return new Decimal(0);
  if (value.isNegative()) return new Decimal(0);
  if (value.greaterThan(1)) return new Decimal(1);
  return value;
}

/** Serialize a Decimal to a fixed 9-decimal string for storage. */
export function serialize(value: Decimal): string {
  return clamp(value).toFixed(DISPLAY_PRECISION);
}

/** Format for display: "0.500000000" */
export function display(value: Decimal | string): string {
  return d(value).toFixed(DISPLAY_PRECISION);
}

export { Decimal };
