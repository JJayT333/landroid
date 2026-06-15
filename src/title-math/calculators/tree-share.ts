/**
 * Relative / live ownership-share math for the unified title-math engine.
 *
 * Faithful port of the share derivation from `src/engine/tree-layout.ts`
 * (computeRelativeShare / computeLiveOwnershipFractions). This is the pure math
 * the canvas overlay recomputes so a printed chart can never disagree with the
 * workspace after a title edit; layout/positioning (ELK, subtree widths,
 * React-Flow node/edge shapes) stays in tree-layout.ts. Emission routes through
 * `emitNodeFraction` (= serialize), so output is byte-identical.
 */
import { d } from '../../engine/decimal';
import type { OwnershipNode } from '../../types/node';
import { emitNodeFraction } from '../precision/emit';

export interface LiveOwnershipFractions {
  grantFraction: string;
  remainingFraction: string;
  relativeShare: string;
}

export function computeRelativeShare(
  node: OwnershipNode,
  parentInitialFraction: string | null
): string {
  if (!parentInitialFraction) return node.initialFraction; // root: relative = absolute
  const parentDec = d(parentInitialFraction);
  if (parentDec.isZero()) return emitNodeFraction(d(0));
  const nodeDec = d(node.initialFraction);
  return emitNodeFraction(nodeDec.div(parentDec));
}

/**
 * Map each ownership node id to its current fraction fields, using the SAME
 * relative-share computation the importer uses. Parent linkage is resolved
 * within the given node set; a node whose parent is absent is treated as a root.
 */
export function computeLiveOwnershipFractions(
  nodes: OwnershipNode[]
): Map<string, LiveOwnershipFractions> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const result = new Map<string, LiveOwnershipFractions>();
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) ?? null : null;
    result.set(node.id, {
      grantFraction: node.initialFraction,
      remainingFraction: node.fraction,
      relativeShare: computeRelativeShare(node, parent ? parent.initialFraction : null),
    });
  }
  return result;
}
