/**
 * Pure helper for the Leasehold view "Add Lease" picker. Given the unit's desk
 * maps and the node set, it lists the present mineral-owner nodes a lease can
 * attach to (a lease overlays the present owner; it is not a conveyance), with a
 * `leased` flag so the picker can surface unleased owners first. Kept pure and
 * dependency-free of React so it is unit-testable (mirrors
 * `components/owners/owner-lease-deskmap.ts`).
 */
import { isNpriNode, type OwnershipNode } from '../../types/node';
import { isLeaseNode } from '../deskmap/deskmap-lease-node';
import { d } from '../../engine/decimal';

export interface LeaseAddTarget {
  nodeId: string;
  deskMapId: string;
  deskMapName: string;
  /** Present mineral owner label (node grantee). */
  label: string;
  /** True when this owner node already has a lessee node attached. */
  leased: boolean;
}

export interface LeaseAddTargetDeskMap {
  id: string;
  name?: string;
  code?: string;
  nodeIds: string[];
}

export function isPresentMineralOwner(node: OwnershipNode): boolean {
  return (
    node.type !== 'related'
    && node.interestClass === 'mineral'
    && !isNpriNode(node)
    && d(node.fraction).greaterThan(0)
  );
}

export function buildLeaseAddTargets(params: {
  deskMaps: LeaseAddTargetDeskMap[];
  nodes: OwnershipNode[];
}): LeaseAddTarget[] {
  const nodeById = new Map(params.nodes.map((node) => [node.id, node]));
  const leasedParentIds = new Set(
    params.nodes
      .filter((node) => isLeaseNode(node) && node.parentId)
      .map((node) => node.parentId as string)
  );

  const seen = new Set<string>();
  const targets: LeaseAddTarget[] = [];
  for (const deskMap of params.deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      if (seen.has(nodeId)) continue;
      const node = nodeById.get(nodeId);
      if (!node || !isPresentMineralOwner(node)) continue;
      seen.add(nodeId);
      targets.push({
        nodeId: node.id,
        deskMapId: deskMap.id,
        deskMapName: deskMap.name || deskMap.code || 'Tract',
        label: node.grantee || 'Unnamed owner',
        leased: leasedParentIds.has(node.id),
      });
    }
  }

  // Unleased owners first (most likely to need a lease), then tract, then label.
  return targets.sort((left, right) => {
    if (left.leased !== right.leased) return left.leased ? 1 : -1;
    return (
      left.deskMapName.localeCompare(right.deskMapName)
      || left.label.localeCompare(right.label)
    );
  });
}
