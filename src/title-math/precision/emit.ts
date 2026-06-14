/**
 * The single Decimal -> string emission choke point for the unified title-math
 * engine.
 *
 * The pre-rewrite code had three distinct, scattered emission disciplines:
 *   - node/engine fractions via `serialize()` (quantizes: toFixed(9) when <=9 dp,
 *     else toSignificantDigits(24)) -- a rounding firewall;
 *   - leasehold/coverage rates via raw `Decimal.toString()` (full 40-digit
 *     residue, no firewall);
 *   - operation scale factors via `Decimal.toFixed(12)`.
 *
 * Routing every emission through this module keeps the disciplines explicit and
 * auditable, and makes an eventual deliberate quantization of the rate path a
 * one-line change here rather than a scatter edit across 85 call sites.
 */
import type { Decimal } from 'decimal.js';

import { serialize } from '../../engine/decimal';

/** Quantized emission for ownership-graph node fractions (the serialize firewall). */
export function emitNodeFraction(value: Decimal): string {
  return serialize(value);
}

/** Raw full-precision emission, matching the leasehold/coverage `.toString()` discipline. */
export function emitRate(value: Decimal): string {
  return value.toString();
}

/** Audit scale-factor emission, matching the historical `.toFixed(12)`. */
export function emitScaleFactor(value: Decimal): string {
  return value.toFixed(12);
}
