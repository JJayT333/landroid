/**
 * Pure helper for lessee name suggestions in lease forms. Collects the
 * distinct, non-empty `lease.lessee` values already used anywhere in the
 * project so the operator can pick an existing lessee instead of retyping it.
 * Dedupes case-insensitively (first-seen casing wins) and sorts
 * alphabetically. Suggestions only — entering a brand-new lessee name is
 * always allowed. Kept pure and dependency-free of React so it is
 * unit-testable (mirrors `lease-add-targets.ts`).
 */
import type { Lease } from '../../types/owner';

export function distinctLesseeNames(leases: Pick<Lease, 'lessee'>[]): string[] {
  const byLowercase = new Map<string, string>();
  for (const lease of leases) {
    const name = lease.lessee.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byLowercase.has(key)) {
      byLowercase.set(key, name);
    }
  }
  return [...byLowercase.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}
