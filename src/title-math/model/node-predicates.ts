/**
 * Shared node predicates for the unified title-math engine.
 *
 * `isTitleCountedNode` is the single source of truth for "does this node bear
 * title and count toward ownership totals" -- used by both the coverage
 * allocator and the engine root-total. Before DA-M8 these two layers carried
 * subtly different inclusion rules (coverage did not exclude `parentId ===
 * 'unlinked'` nodes; the root-total did), so a parentId-'unlinked' mineral node
 * could be counted by one and not the other. The shared predicate makes them
 * agree.
 *
 * The parameter is a minimal structural shape (`type: string`) so it accepts
 * both the stored `OwnershipNode` and the engine's internal CalcNode-derived
 * fields without a cast.
 */
import type { InterestClass } from '../../types/node';

/**
 * True when a node bears title and counts toward ownership totals: it is not a
 * related document/lease, not an NPRI burden, and not unlinked.
 */
export function isTitleCountedNode(node: {
  type: string;
  interestClass?: InterestClass | null;
  parentId: string | null;
}): boolean {
  return (
    node.type !== 'related' &&
    (node.interestClass ?? 'mineral') !== 'npri' &&
    node.parentId !== 'unlinked'
  );
}
