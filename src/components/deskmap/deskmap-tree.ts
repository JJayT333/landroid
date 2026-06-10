import { isNpriNode, type OwnershipNode } from '../../types/node';
import { isLeaseNode } from './deskmap-lease-node';

export interface VisibleDeskMapNodesOptions {
  hideNpris: boolean;
}

/**
 * Render-time Desk Map card filter. Display only: callers must keep feeding
 * the unfiltered node list to coverage math, warning dots, and search.
 *
 * Hides each NPRI node together with its whole subtree. The math engine only
 * lets NPRI nodes parent further NPRI splits (`executeConveyance` rejects
 * cross-class children), but attached related docs also hang under NPRI
 * parents, so subtree removal keeps them from being orphan-promoted to
 * top-level roots by `buildDeskMapTree`.
 */
export function visibleDeskMapNodes(
  nodes: OwnershipNode[],
  { hideNpris }: VisibleDeskMapNodesOptions
): OwnershipNode[] {
  if (!hideNpris) return nodes;

  const hiddenIds = new Set<string>();
  for (const node of nodes) {
    if (isNpriNode(node)) hiddenIds.add(node.id);
  }
  if (hiddenIds.size === 0) return nodes;

  const childIdsOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId || node.parentId === 'unlinked') continue;
    const childIds = childIdsOf.get(node.parentId) ?? [];
    childIds.push(node.id);
    childIdsOf.set(node.parentId, childIds);
  }

  const stack = [...hiddenIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const childId of childIdsOf.get(id) ?? []) {
      if (!hiddenIds.has(childId)) {
        hiddenIds.add(childId);
        stack.push(childId);
      }
    }
  }

  return nodes.filter((node) => !hiddenIds.has(node.id));
}

export interface DeskMapTreeNode {
  node: OwnershipNode;
  children: DeskMapTreeNode[];
  relatedDocs: OwnershipNode[];
}

export function buildDeskMapTree(nodes: OwnershipNode[]): DeskMapTreeNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childrenOf = new Map<string, OwnershipNode[]>();
  const relatedOf = new Map<string, OwnershipNode[]>();

  for (const node of nodes) {
    if (!node.parentId || node.parentId === 'unlinked') continue;

    if (node.type === 'related' && !isLeaseNode(node)) {
      if (!relatedOf.has(node.parentId)) relatedOf.set(node.parentId, []);
      relatedOf.get(node.parentId)!.push(node);
      continue;
    }

    if (!childrenOf.has(node.parentId)) childrenOf.set(node.parentId, []);
    childrenOf.get(node.parentId)!.push(node);
  }

  function build(node: OwnershipNode): DeskMapTreeNode {
    return {
      node,
      children: (childrenOf.get(node.id) ?? []).map(build),
      relatedDocs: relatedOf.get(node.id) ?? [],
    };
  }

  return nodes
    .filter(
      (node) =>
        node.type !== 'related' &&
        (!node.parentId || node.parentId === 'unlinked' || !nodeIds.has(node.parentId))
    )
    .map(build);
}
