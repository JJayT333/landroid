/**
 * Missing Link placeholder — the DERIVED indeterminate overlay.
 *
 * A Missing Link is a `type: 'conveyance'` node flagged `provenance: 'placeholder'`
 * that sits IN the main line and parents the next owner. It is modeled as a full
 * pass-through conveyance (`conveyanceMode: 'all'`), so the fraction math runs
 * structurally as a normal 'all' pass-through — the codebase forbids silent-zero
 * and a fabricated indeterminate sentinel, so NOTHING is zeroed here.
 *
 * "Indeterminate" is purely a DISPLAY / PAYOUT overlay layered on top of the
 * unchanged stored fractions: this module derives WHICH nodes sit at or below an
 * `'indeterminate'` placeholder (the default passthrough). Those nodes render
 * "pending" and are held from payout. For an `'assume'` placeholder the numbers
 * compute and show (descendants are NOT in this set), but they stay flagged
 * "subject to unproven link" and are STILL held from payout via the High
 * `'Missing link'` title issue (the existing curative→transfer-order machinery).
 *
 * This is a pure derivation — no store reads, no mutation, no Decimal math.
 */
import type { OwnershipNode } from '../../types/node';
import { isPlaceholderNode, placeholderPassthroughOf } from '../../types/node';

/**
 * The set of node ids AT or BELOW an `'indeterminate'` Missing Link placeholder.
 *
 * A node is in the set when it is an indeterminate placeholder itself, or has an
 * indeterminate placeholder anywhere in its ancestry. `'assume'` placeholders are
 * NOT barriers here: their own id and their descendants stay out of the set so
 * the computed numbers surface (still flagged + held from payout elsewhere).
 *
 * Pure and order-independent: it walks each node's ancestry through the parentId
 * chain, so the result is identical regardless of node array order. Returns an
 * empty set when there are no indeterminate placeholders, so a chain with no
 * Missing Links (the universal case) is unaffected.
 */
export function collectUnprovenIndeterminateNodeIds(
  nodes: ReadonlyArray<OwnershipNode>
): Set<string> {
  const byId = new Map<string, OwnershipNode>();
  for (const node of nodes) byId.set(node.id, node);

  // The placeholders whose passthrough is 'indeterminate' (the default). An
  // 'assume' placeholder is intentionally excluded — it is not a display barrier.
  const indeterminatePlaceholderIds = new Set<string>();
  for (const node of nodes) {
    if (isPlaceholderNode(node) && placeholderPassthroughOf(node) === 'indeterminate') {
      indeterminatePlaceholderIds.add(node.id);
    }
  }
  if (indeterminatePlaceholderIds.size === 0) return new Set();

  const result = new Set<string>();
  // Memoized per-node verdict so the ancestry walk stays O(n) across the graph.
  const verdict = new Map<string, boolean>();

  const isUnproven = (startId: string): boolean => {
    const path: string[] = [];
    let cursor: string | null = startId;
    let answer = false;
    while (cursor != null) {
      const memo = verdict.get(cursor);
      if (memo !== undefined) {
        answer = memo;
        break;
      }
      if (indeterminatePlaceholderIds.has(cursor)) {
        answer = true;
        break;
      }
      if (path.includes(cursor)) {
        // Defensive: a malformed cycle terminates the walk rather than looping.
        break;
      }
      path.push(cursor);
      const parentId: string | null = byId.get(cursor)?.parentId ?? null;
      cursor = parentId;
    }
    // Record the verdict for every node on the path so siblings reuse it.
    for (const id of path) verdict.set(id, answer);
    return answer;
  };

  for (const node of nodes) {
    if (isUnproven(node.id)) result.add(node.id);
  }
  return result;
}
