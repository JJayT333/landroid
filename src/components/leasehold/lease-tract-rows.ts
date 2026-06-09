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
import { DEFAULT_LEASE_STATUS, type Lease } from '../../types/owner';
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

/**
 * Editable per-tract row in the lease editor. One per tract where this lessor
 * holds present minerals; `checked` materializes a lease slice + lessee node on
 * that tract's desk map on save. Math-relevant scalars (royalty, dates, term)
 * come from the shared LPR; the per-tract fields below stay on the slice.
 */
export interface TractDraft {
  mineralNodeId: string;
  deskMapId: string;
  deskMapName: string;
  ownerLabel: string;
  checked: boolean;
  leaseName: string;
  leasedInterest: string;
  grossAcres: string;
  status: string;
  docNo: string;
  existingLeaseId: string | null;
  existingLeaseNodeId: string | null;
}

/**
 * Seed the editable per-tract rows when the editor opens. Rows come from
 * {@link buildLeaseTractRows}; the originating tract is always present and
 * pre-checked. The originating tract keeps the prop-derived existing slice so
 * editing an existing (even pre-LPR standalone) lease updates it instead of
 * duplicating.
 */
export function seedTractDrafts(params: {
  parentNode: OwnershipNode;
  ownerId: string;
  deskMaps: LeaseTractRowDeskMap[];
  nodes: OwnershipNode[];
  leases: Lease[];
  leasePurchaseReportId: string | null;
  activeDeskMapId: string | null;
  originatingExistingLease: Lease | null;
  originatingExistingNodeId: string | null;
}): TractDraft[] {
  const rows = buildLeaseTractRows({
    deskMaps: params.deskMaps,
    nodes: params.nodes,
    leases: params.leases,
    ownerId: params.ownerId,
    leasePurchaseReportId: params.leasePurchaseReportId,
  });
  const leaseById = new Map(params.leases.map((lease) => [lease.id, lease]));
  const rowByNode = new Map(rows.map((row) => [row.mineralNodeId, row]));

  const originatingDeskMap = params.deskMaps.find((deskMap) =>
    deskMap.nodeIds.includes(params.parentNode.id)
  );
  const originatingRow = rowByNode.get(params.parentNode.id) ?? {
    mineralNodeId: params.parentNode.id,
    deskMapId: originatingDeskMap?.id ?? params.activeDeskMapId ?? '',
    deskMapName: originatingDeskMap?.name || originatingDeskMap?.code || 'Tract',
    ownerLabel: params.parentNode.grantee || 'Unnamed owner',
    defaultLessorInterest: params.parentNode.fraction,
    existingLeaseId: null as string | null,
    existingLeaseNodeId: null as string | null,
  };

  const orderedRows = [
    originatingRow,
    ...rows.filter((row) => row.mineralNodeId !== params.parentNode.id),
  ];

  return orderedRows.map((row) => {
    const isOriginating = row.mineralNodeId === params.parentNode.id;
    const existingLeaseId = isOriginating
      ? params.originatingExistingLease?.id ?? row.existingLeaseId
      : row.existingLeaseId;
    const existingLeaseNodeId = isOriginating
      ? params.originatingExistingNodeId ?? row.existingLeaseNodeId
      : row.existingLeaseNodeId;
    const existing = existingLeaseId
      ? leaseById.get(existingLeaseId) ?? null
      : null;
    const hasOwnerLabel = row.ownerLabel && row.ownerLabel !== 'Unnamed owner';

    return {
      mineralNodeId: row.mineralNodeId,
      deskMapId: row.deskMapId,
      deskMapName: row.deskMapName,
      ownerLabel: row.ownerLabel,
      checked: isOriginating ? true : existingLeaseId !== null,
      leaseName: existing?.leaseName ?? (hasOwnerLabel ? `${row.ownerLabel} Lease` : ''),
      leasedInterest: existing?.leasedInterest ?? row.defaultLessorInterest,
      grossAcres: existing?.grossAcres ?? '',
      status: existing?.status ?? DEFAULT_LEASE_STATUS,
      docNo: existing?.docNo ?? '',
      existingLeaseId,
      existingLeaseNodeId,
    };
  });
}

export interface TractReconcilePlan {
  /** Checked tracts with no slice yet — create one slice + lessee node. */
  create: TractDraft[];
  /** Checked tracts already covered — update the slice + lessee node. */
  update: TractDraft[];
  /** Unchecked tracts that were covered — delete the slice + lessee node. */
  remove: TractDraft[];
}

/**
 * Pure reconcile decision: split the editor's per-tract rows into create,
 * update, and remove sets. Keyed by tract (one row per mineral node), so a tract
 * can never be both created and updated — no duplicate slice per owner/tract.
 */
export function planTractReconcile(
  tractDrafts: readonly TractDraft[]
): TractReconcilePlan {
  const create: TractDraft[] = [];
  const update: TractDraft[] = [];
  const remove: TractDraft[] = [];
  for (const tract of tractDrafts) {
    if (tract.checked) {
      (tract.existingLeaseId ? update : create).push(tract);
    } else if (tract.existingLeaseId) {
      remove.push(tract);
    }
  }
  return { create, update, remove };
}
