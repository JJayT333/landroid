/**
 * Depth-range discriminator for records that participate in ownership math.
 *
 * Phase 5 ride-along (`docs/phase-5-document-refactor.md` § Depth-Range Schema Hook).
 * LANDroid does not model depth severance today: every conveyance, lease,
 * NPRI, ORRI, and WI assignment is assumed to cover all depths beneath the
 * burdened acreage. This field exists so Phase 8 (depth-severance feature)
 * has a clean attachment point — same precedent as `LeaseJurisdiction` on
 * `Lease` / `LeaseholdUnit`.
 *
 * Today the union has exactly one member: `'all_depths'`. The object shape
 * `{ topFt; bottomFt }` is deliberately **not** part of the type yet — adding
 * it before the math exists invites two-ways-to-say-the-same-thing ambiguity.
 * Phase 8 expands this union when the real feature lands.
 *
 * Import-time policy (matches Phase 3 leasehold warning pattern):
 * - `.landroid` files carrying a non-`'all_depths'` value are normalized to
 *   `'all_depths'` for math, preserved raw in workspace metadata, and
 *   surfaced as a warning. No data loss, no hard block.
 * - The math layer never receives anything other than `'all_depths'`; the
 *   validator below enforces it.
 *
 * One-line comments at math entry points (`src/engine/math-engine.ts`,
 * `src/components/leasehold/leasehold-summary.ts`,
 * `src/components/deskmap/deskmap-coverage.ts`) remind future readers that
 * the math assumes this field is always `'all_depths'`.
 */
export const DEPTH_RANGE_OPTIONS = ['all_depths'] as const;
export type DepthRange = (typeof DEPTH_RANGE_OPTIONS)[number];

export const DEFAULT_DEPTH_RANGE: DepthRange = 'all_depths';

/**
 * Coerce any input to a valid `DepthRange`. Unknown / future values fall
 * back to the default; callers that need to know an unknown value was
 * present should use {@link isUnsupportedDepthRange} alongside this.
 */
export function normalizeDepthRange(value: unknown): DepthRange {
  if (typeof value === 'string') {
    const candidate = value.trim();
    if ((DEPTH_RANGE_OPTIONS as readonly string[]).includes(candidate)) {
      return candidate as DepthRange;
    }
  }
  return DEFAULT_DEPTH_RANGE;
}

/**
 * Returns `true` when the input is a non-empty string that is not a
 * recognized depth range. Used by import paths to surface a warning
 * ("This file uses depth severance, which is not supported by this build.")
 * without dropping the original value silently.
 */
export function isUnsupportedDepthRange(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (candidate.length === 0) return false;
  return !(DEPTH_RANGE_OPTIONS as readonly string[]).includes(candidate);
}

/**
 * Hard assertion used at math entry points so the math layer never sees a
 * non-`'all_depths'` value, even if a future schema change forgets to
 * normalize on a code path. Throws so the bug is loud, not silent. Math
 * surfaces should normalize first and only assert as a defense-in-depth
 * check.
 */
export function assertAllDepthsForMath(value: DepthRange): void {
  if (value !== 'all_depths') {
    throw new Error(
      `Depth severance is not modeled by this build. Expected 'all_depths', got '${value}'.`
    );
  }
}
