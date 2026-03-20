/**
 * Convert a decimal value to a simplified fraction string.
 *
 * Uses continued fraction expansion for fast, exact rational approximation.
 * Handles edge cases like 1/420, repeating decimals, and very small fractions.
 */
import { Decimal } from 'decimal.js';
import { d, DISPLAY_PRECISION } from './decimal';

/**
 * Find the best rational approximation p/q using continued fractions.
 *
 * Given x in (0,1), computes [0; a1, a2, ...] and tracks convergents.
 * Finds 1/420 in ~2 steps. Much faster than Stern-Brocot for large denominators.
 */
function bestRational(x: number, maxDenom: number): [number, number] {
  if (x <= 0) return [0, 1];
  if (x >= 1 - 1e-10) return [1, 1];

  // Convergent state: h/k tracks the best rational approximation
  // h_{-1} = 1, k_{-1} = 0
  // h_0 = a_0 = 0 (since x < 1), k_0 = 1
  let h2 = 1, k2 = 0; // h_{n-2}, k_{n-2}
  let h1 = 0, k1 = 1; // h_{n-1}, k_{n-1}

  let bestP = 0, bestQ = 1;
  let bestErr = x; // error of 0/1

  // x = 0 + 1/val, so val = 1/x
  let val = 1 / x;

  for (let i = 0; i < 50; i++) {
    const a = Math.floor(val);

    // Next convergent: h_n = a * h_{n-1} + h_{n-2}
    const h = a * h1 + h2;
    const k = a * k1 + k2;

    if (k > maxDenom) {
      // Semi-convergent: find largest m < a where m*k1 + k2 <= maxDenom
      const m = Math.floor((maxDenom - k2) / k1);
      if (m >= 1) {
        const sh = m * h1 + h2;
        const sk = m * k1 + k2;
        const err = Math.abs(x - sh / sk);
        if (err < bestErr) {
          bestP = sh;
          bestQ = sk;
        }
      }
      break;
    }

    const err = Math.abs(x - h / k);
    if (err < bestErr) {
      bestErr = err;
      bestP = h;
      bestQ = k;
    }

    if (bestErr < 1e-10) break;

    // Shift
    h2 = h1; h1 = h;
    k2 = k1; k1 = k;

    const remainder = val - a;
    if (Math.abs(remainder) < 1e-12) break;
    val = 1 / remainder;
    if (val > 1e12) break;
  }

  return [bestP, bestQ];
}

/**
 * Convert a decimal to its best simplified fraction string.
 *
 * @param value  The decimal value (string, number, or Decimal)
 * @param maxDenominator  Upper bound on denominator (default 1,000,000)
 * @returns  e.g. "1/2", "3/8", "1/420", "0/1"
 */
export function formatAsFraction(
  value: string | number | Decimal,
  maxDenominator = 1_000_000
): string {
  const dec = d(value);
  if (dec.isNaN() || !dec.isFinite() || dec.lessThanOrEqualTo(0)) return '0/1';

  const num = dec.toNumber();
  const whole = Math.floor(num);
  const fractional = num - whole;

  if (fractional < 1e-10) return `${whole}/1`;

  const [fp, fq] = bestRational(fractional, maxDenominator);

  if (fq <= 0 || fp <= 0) {
    if (whole > 0) return `${whole}/1`;
    return '0/1';
  }

  const numerator = fp + whole * fq;
  return `${numerator}/${fq}`;
}

/**
 * Dual display string: "0.500000000 | 1/2"
 */
export function dualDisplay(value: string | number | Decimal): string {
  const dec = d(value);
  return `${dec.toFixed(DISPLAY_PRECISION)} | ${formatAsFraction(dec)}`;
}
