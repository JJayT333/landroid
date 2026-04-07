import { isLeaseNode } from '../deskmap/deskmap-lease-node';
import type { DeskMap, OwnershipNode } from '../../types/node';

export interface OwnerLeaseDeskMapTarget {
  parentNodeId: string;
  parentNodeLabel: string;
  deskMapId: string;
  deskMapName: string;
  leaseNodeId: string | null;
}

export function getOwnerLeaseDeskMapTargets(params: {
  ownerId: string;
  leaseId: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
}): OwnerLeaseDeskMapTarget[] {
  const { ownerId, leaseId, nodes, deskMaps } = params;
  const deskMapByNodeId = new Map<string, { id: string; name: string }>();

  deskMaps.forEach((deskMap) => {
    deskMap.nodeIds.forEach((nodeId) => {
      if (!deskMapByNodeId.has(nodeId)) {
        deskMapByNodeId.set(nodeId, {
          id: deskMap.id,
          name: deskMap.name,
        });
      }
    });
  });

  const leaseNodeIdByParentId = new Map<string, string>();
  nodes.forEach((node) => {
    if (
      isLeaseNode(node)
      && node.linkedLeaseId === leaseId
      && node.parentId
      && !leaseNodeIdByParentId.has(node.parentId)
    ) {
      leaseNodeIdByParentId.set(node.parentId, node.id);
    }
  });

  return nodes
    .filter(
      (node) =>
        node.type !== 'related'
        && node.linkedOwnerId === ownerId
        && deskMapByNodeId.has(node.id)
    )
    .map((node) => {
      const deskMap = deskMapByNodeId.get(node.id)!;
      return {
        parentNodeId: node.id,
        parentNodeLabel: node.grantee || node.instrument || node.id,
        deskMapId: deskMap.id,
        deskMapName: deskMap.name,
        leaseNodeId: leaseNodeIdByParentId.get(node.id) ?? null,
      };
    })
    .sort((left, right) => {
      if (left.leaseNodeId && !right.leaseNodeId) return -1;
      if (!left.leaseNodeId && right.leaseNodeId) return 1;
      const deskMapCompare = left.deskMapName.localeCompare(right.deskMapName);
      if (deskMapCompare !== 0) {
        return deskMapCompare;
      }
      return left.parentNodeLabel.localeCompare(right.parentNodeLabel);
    });
}
