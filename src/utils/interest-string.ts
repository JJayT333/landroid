import { clampUnit, d, serialize, type Decimal } from '../engine/decimal';

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

export function normalizeInterestString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  return serialize(parseInterestString(trimmed));
}
