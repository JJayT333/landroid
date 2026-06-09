/**
 * Pure helper for the multi-tract lease editor. Given a lessor (owner) and a
 * Lease Purchase Report, it lists that lessor's present mineral-owner presence
 * across the unit's desk maps — one row per tract where the owner holds
 * minerals. A lease overlays the present owner (it is not a conveyance), so each
 * row is a candidate tract the LPR can cover. Rows already covered by this LPR
 * carry the existing slice/node ids so save can reconcile (create/update/delete)
 * instead of duplicating. Kept pure and React-free so it is unit-testable
 * (mirrors `lease-add-targets.ts`).
 */
import type { OwnershipNode } from '../../types/node';
import type { Lease } from '../../types/owner';
import { isLeaseNode } from '../deskmap/deskmap-lease-node';
import { isPresentMineralOwner } from './lease-add-targets';

export interface LeaseTractRow {
  /** Present mineral-owner node this tract row attaches under. */
  mineralNodeId: string;
  deskMapId: string;
  deskMapName: string;
  /** Present mineral owner label (node grantee). */
  ownerLabel: string;
  /** Tract's mineral node fraction — the per-row lessor-interest default. */
  defaultLessorInterest: string;
  /** Slice already covering this tract for the LPR, or null. */
  existingLeaseId: string | null;
  /** Lessee node already on this tract for the LPR, or null. */
  existingLeaseNodeId: string | null;
}

export interface LeaseTractRowDeskMap {
  id: string;
  name?: string;
  code?: string;
  nodeIds: string[];
}

/**
 * One row per tract where `ownerId` holds present minerals. `existing*` ids are
 * populated when a lessee node under that tract links a slice belonging to
 * `leasePurchaseReportId`. Returns [] when `ownerId` is blank (the owner is not
 * linked yet); the caller handles the originating tract in that case.
 */
export function buildLeaseTractRows(params: {
  deskMaps: LeaseTractRowDeskMap[];
  nodes: OwnershipNode[];
  leases: Lease[];
  ownerId: string;
  leasePurchaseReportId: string | null;
}): LeaseTractRow[] {
  if (!params.ownerId) return [];

  const nodeById = new Map(params.nodes.map((node) => [node.id, node]));
  const leaseById = new Map(params.leases.map((lease) => [lease.id, lease]));

  // Lessee nodes for this LPR, indexed by the mineral node they burden.
  const leaseNodeByParentId = new Map<string, OwnershipNode>();
  if (params.leasePurchaseReportId) {
    for (const node of params.nodes) {
      if (!isLeaseNode(node) || !node.parentId || !node.linkedLeaseId) continue;
      const lease = leaseById.get(node.linkedLeaseId);
      if (!lease || lease.leasePurchaseReportId !== params.leasePurchaseReportId) {
        continue;
      }
      leaseNodeByParentId.set(node.parentId, node);
    }
  }

  const seen = new Set<string>();
  const rows: LeaseTractRow[] = [];
  for (const deskMap of params.deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      if (seen.has(nodeId)) continue;
      const node = nodeById.get(nodeId);
      if (!node || !isPresentMineralOwner(node)) continue;
      if (node.linkedOwnerId !== params.ownerId) continue;
      seen.add(nodeId);

      const leaseNode = leaseNodeByParentId.get(node.id) ?? null;
      rows.push({
        mineralNodeId: node.id,
        deskMapId: deskMap.id,
        deskMapName: deskMap.name || deskMap.code || 'Tract',
        ownerLabel: node.grantee || 'Unnamed owner',
        defaultLessorInterest: node.fraction,
        existingLeaseId: leaseNode?.linkedLeaseId ?? null,
        existingLeaseNodeId: leaseNode?.id ?? null,
      });
    }
  }

  return rows.sort((left, right) =>
    left.deskMapName.localeCompare(right.deskMapName)
    || left.ownerLabel.localeCompare(right.ownerLabel)
  );
}
