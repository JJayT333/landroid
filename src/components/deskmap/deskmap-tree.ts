import type { OwnershipNode } from '../../types/node';
import { isLeaseNode } from './deskmap-lease-node';

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
