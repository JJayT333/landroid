/**
 * Two-tolerance deep diff for captured title-math numbers.
 *
 * The pre-rewrite leasehold/coverage layer emits raw 40-digit Decimal residue
 * (`.toString()`, no quantization), so a genuine re-architecture that changes
 * operation order can shift digits far past the 9-dp display precision without
 * changing any number the user ever sees. A naive string diff would flag those
 * as regressions and bury the real ones.
 *
 * So every numeric-string leaf is classified at two tolerances:
 *   - 'byte'       — strings differ, but agree at 9 decimal places. Intended
 *                    structural residue from re-ordered arithmetic; not a
 *                    user-visible change.
 *   - 'value'      — differ at 9 dp. A real numeric regression.
 * Non-numeric leaves and key/length mismatches are 'structural'.
 *
 * Springhill (the oracle) must produce ZERO divergences of any kind during the
 * faithful-transcription phases. Vulcan Mesa / Raven Forest 'byte' divergences
 * are benign; 'value' / 'structural' there must be investigated.
 *
 * Test/diagnostic-only; never imported by app code.
 */
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import { d } from '../../engine/decimal';

export type DivergenceKind = 'structural' | 'value' | 'byte';

export interface Divergence {
  path: string;
  kind: DivergenceKind;
  a: unknown;
  b: unknown;
}

const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

function isNumericString(value: unknown): value is string {
  return typeof value === 'string' && NUMERIC_STRING.test(value);
}

function nineDp(value: string): string {
  return d(value).toFixed(9);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(a: unknown, b: unknown, path: string, out: Divergence[]): void {
  if (isNumericString(a) && isNumericString(b)) {
    if (a === b) return;
    out.push({ path, kind: nineDp(a) === nineDp(b) ? 'byte' : 'value', a, b });
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push({ path: `${path}.length`, kind: 'structural', a: a.length, b: b.length });
    }
    const shared = Math.min(a.length, b.length);
    for (let i = 0; i < shared; i += 1) {
      walk(a[i], b[i], `${path}[${i}]`, out);
    }
    return;
  }

  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      const hasA = Object.prototype.hasOwnProperty.call(a, key);
      const hasB = Object.prototype.hasOwnProperty.call(b, key);
      if (!hasA) {
        out.push({ path: childPath, kind: 'structural', a: undefined, b: b[key] });
        continue;
      }
      if (!hasB) {
        out.push({ path: childPath, kind: 'structural', a: a[key], b: undefined });
        continue;
      }
      walk(a[key], b[key], childPath, out);
    }
    return;
  }

  if (a !== b) {
    out.push({ path, kind: 'structural', a, b });
  }
}

/**
 * Deep-diff two captures, classifying numeric leaves at two tolerances.
 *
 * Both sides are first normalized through `canonicalJson` so the comparison
 * matches the persisted form: `undefined` object values are dropped (absent and
 * present-undefined become equal) and key order is irrelevant. This is the same
 * normalization the frozen baseline files are written with.
 */
export function diffCaptured(a: unknown, b: unknown): Divergence[] {
  const out: Divergence[] = [];
  walk(JSON.parse(canonicalJson(a)), JSON.parse(canonicalJson(b)), '$', out);
  return out;
}

export interface DivergenceSummary {
  total: number;
  byte: number;
  value: number;
  structural: number;
  /** True when there are no 'value' or 'structural' divergences (oracle-safe). */
  oracleClean: boolean;
}

export function summarizeDivergences(divergences: Divergence[]): DivergenceSummary {
  const byte = divergences.filter((x) => x.kind === 'byte').length;
  const value = divergences.filter((x) => x.kind === 'value').length;
  const structural = divergences.filter((x) => x.kind === 'structural').length;
  return {
    total: divergences.length,
    byte,
    value,
    structural,
    oracleClean: value === 0 && structural === 0,
  };
}
