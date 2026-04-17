import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import type { OwnershipNode } from '../types/node';

export type NodeEditorRoute =
  | { kind: 'node'; nodeId: string }
  | { kind: 'lease'; parentNodeId: string; leaseId?: string | null };

export function resolveNodeEditorRoute(
  node: OwnershipNode | null
): NodeEditorRoute | null {
  if (!node) {
    return null;
  }

  if (isLeaseNode(node) && node.parentId) {
    return {
      kind: 'lease',
      parentNodeId: node.parentId,
      leaseId: node.linkedLeaseId ?? null,
    };
  }

  return {
    kind: 'node',
    nodeId: node.id,
  };
}
