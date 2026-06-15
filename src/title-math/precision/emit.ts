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
 *
 * Stage B (deliberate quantization): `emitRate` now rounds to 9 decimal places
 * -- the same display precision the ownership-graph `serialize` firewall already
 * applied -- so leasehold/coverage rates no longer leak the full 40-digit
 * arithmetic residue into the UI and the transfer-order sheet. This is applied
 * ONLY to value-safe FINAL outputs (display rates, summed unit totals,
 * transfer-order terminals). Intermediates that are re-read and then MULTIPLIED
 * or DIVIDED downstream (chiefly the cross-module `allocatedFraction` that
 * leasehold re-parses and multiplies through the royalty/NPRI/WI stack) must
 * stay full precision -- they route through `emitRawRate` instead. Quantizing a
 * re-read-and-multiplied intermediate would compound the rounding and shift the
 * final result past 9dp (a real `value` divergence), so the choke point exposes
 * both disciplines explicitly.
 */
import type { Decimal } from 'decimal.js';

import { serialize } from '../../engine/decimal';

/** The deliberate display precision for the rate path (matches `serialize`'s <=9dp firewall). */
const RATE_DISPLAY_DECIMAL_PLACES = 9;

/** Quantized emission for ownership-graph node fractions (the serialize firewall). */
export function emitNodeFraction(value: Decimal): string {
  return serialize(value);
}

/**
 * Quantized emission for FINAL leasehold/coverage rates and totals (9dp). Use
 * only for values that are not re-read and then multiplied/divided downstream;
 * additive re-sums of quantized values stay byte-class (agree at 9dp).
 */
export function emitRate(value: Decimal): string {
  return value.toDecimalPlaces(RATE_DISPLAY_DECIMAL_PLACES).toString();
}

/**
 * Raw full-precision emission (the historical `.toString()` discipline). Use for
 * intermediates that are re-parsed via `d(...)` and then multiplied or divided
 * downstream -- quantizing those would compound rounding into a `value`
 * divergence. The canonical case is coverage's `allocatedFraction`, which
 * leasehold re-reads and multiplies through the entire burden stack.
 */
export function emitRawRate(value: Decimal): string {
  return value.toString();
}

/** Audit scale-factor emission, matching the historical `.toFixed(12)`. */
export function emitScaleFactor(value: Decimal): string {
  return value.toFixed(12);
}
