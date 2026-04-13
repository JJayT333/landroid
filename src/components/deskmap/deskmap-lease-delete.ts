import type { OwnershipNode } from '../../types/node';
import { isLeaseNode } from './deskmap-lease-node';

export interface DeskMapLeaseDeletionPlan {
  leaseId: string | null;
  removeOwnerLeaseRecord: boolean;
}

export function planDeskMapLeaseDeletion(
  nodes: OwnershipNode[],
  nodeId: string
): DeskMapLeaseDeletionPlan {
  const node = nodes.find((candidate) => candidate.id === nodeId) ?? null;
  if (!node || !isLeaseNode(node) || !node.linkedLeaseId) {
    return {
      leaseId: null,
      removeOwnerLeaseRecord: false,
    };
  }

  const otherLinkedLeaseNodeExists = nodes.some(
    (candidate) =>
      candidate.id !== node.id &&
      isLeaseNode(candidate) &&
      candidate.linkedLeaseId === node.linkedLeaseId
  );

  return {
    leaseId: node.linkedLeaseId,
    removeOwnerLeaseRecord: !otherLinkedLeaseNodeExists,
  };
}
