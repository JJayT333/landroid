/**
 * Single source of truth for formatting derived numbers for display.
 *
 * Centralizes the precision policy (deep audit §3) so views and components stop
 * hand-rolling `.toFixed()` and drifting apart. Derived interest decimals render
 * at DISPLAY_PRECISION (9dp); acreage renders at 3dp (industry-normal, ~43 sq ft)
 * with a dash for the empty/zero case.
 *
 * NOTE: the §3 "9dp + percent gloss" variant of formatInterestPercent is
 * intentionally deferred. formatInterestPercent preserves the established 2dp
 * percent presentation until the operator confirms a new format — this module is
 * a consolidation, not a behavior change.
 */
import type { Decimal } from 'decimal.js';
import { d, display } from './decimal';
import { dualDisplay } from './fraction-display';

type Numeric = string | number | Decimal;

/** Derived interest decimal at full display precision: "0.500000000". */
export function formatInterestDecimal(value: Numeric): string {
  return display(d(value));
}

/** Dual decimal | fraction display: "0.500000000 | 1/2". */
export function formatInterestDual(value: Numeric): string {
  return dualDisplay(d(value));
}

/** Interest as a 2dp percent gloss: "50.00%". */
export function formatInterestPercent(value: Numeric): string {
  return `${d(value).times(100).toFixed(2)}%`;
}

/**
 * Acreage at 3dp, or a dash for the empty/zero case. Whole-acre values render
 * without trailing zeros ("640" rather than "640.000").
 */
export function formatAcres(value: Numeric): string {
  const acres = d(value);
  if (!acres.greaterThan(0)) {
    return '—';
  }
  return acres.decimalPlaces() === 0 ? acres.toFixed(0) : acres.toFixed(3);
}
