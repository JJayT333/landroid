/**
 * Lease-coverage calculator for the unified title-math engine.
 *
 * Faithful port of the pure coverage math from
 * `src/components/deskmap/deskmap-coverage.ts`: the lease-scope index, owner-node
 * lease resolution, first-effective-wins allocation with warn-only clipping, and
 * the per-tract coverage summary. UI-only helpers (pickPrimaryLease,
 * toDeskMapPrimaryLeaseSummary, canOwnerNodeHoldLease) stay in the component.
 *
 * Emission goes through `emitRate` (= Decimal.toString()), preserving the raw
 * full-precision residue the desk-map layer has always produced; string and
 * literal pass-throughs ('0', 'malformed', node.fraction) are preserved verbatim.
 *
 * Depth severance is not modeled; this allocator assumes depthRange 'all_depths'
 * on every node and lease (the Phase 8 attachment point).
 */
import type Decimal from 'decimal.js';

import { isLeaseNode } from '../../components/deskmap/deskmap-lease-node';
import { d } from '../../engine/decimal';
import { isNpriNode, type OwnershipNode } from '../../types/node';
import { isInactiveLeaseStatus, isTexasMathLease, type Lease } from '../../types/owner';
import { parseStrictInterestString } from '../../utils/interest-string';
import { emitRate } from '../precision/emit';

export interface DeskMapCoverageSummary {
  currentOwnership: string;
  linkedOwnership: string;
  leasedOwnership: string;
  missingOwnership: string;
  unlinkedOwnership: string;
  unleasedOwnership: string;
  currentOwnerCount: number;
  linkedOwnerCount: number;
  leasedOwnerCount: number;
  currentOwnershipContributors: Array<{
    nodeId: string;
    grantee: string;
    fraction: string;
  }>;
  leaseOverlaps: Array<{
    ownerNodeId: string;
    ownerGrantee: string;
    overlap: LeaseCoverageOverlap;
  }>;
}

export interface LeaseCoverageAllocation {
  lease: Lease;
  allocatedFraction: string;
}

export interface LeaseCoverageOverlap {
  leaseId: string;
  leaseName: string;
  lessee: string;
  requestedFraction: string;
  allocatedFraction: string;
  clippedFraction: string;
}

export interface LeaseCoverageResult {
  allocations: LeaseCoverageAllocation[];
  overlaps: LeaseCoverageOverlap[];
}

export interface LeaseScopeIndex {
  linkedLeaseIds: Set<string>;
  linkedLeaseIdsByParentNodeId: Map<string, Set<string>>;
}

function asLeaseText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function isLeaseActive(lease: Lease): boolean {
  return !isInactiveLeaseStatus(lease.status) && isTexasMathLease(lease);
}

function compareLeaseAllocationOrder(left: Lease, right: Lease): number {
  return (
    `${asLeaseText(left.effectiveDate) || '9999-12-31'}|${left.createdAt}|${left.updatedAt}|${left.id}`
  ).localeCompare(
    `${asLeaseText(right.effectiveDate) || '9999-12-31'}|${right.createdAt}|${right.updatedAt}|${right.id}`
  );
}

export function getActiveLeases(leases: Lease[]): Lease[] {
  return leases.filter(isLeaseActive);
}

export function buildLeaseScopeIndex(nodes: OwnershipNode[]): LeaseScopeIndex {
  const linkedLeaseIds = new Set<string>();
  const linkedLeaseIdsByParentNodeId = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (!isLeaseNode(node) || !node.parentId || !node.linkedLeaseId) {
      continue;
    }

    linkedLeaseIds.add(node.linkedLeaseId);
    const branchLeaseIds = linkedLeaseIdsByParentNodeId.get(node.parentId) ?? new Set<string>();
    branchLeaseIds.add(node.linkedLeaseId);
    linkedLeaseIdsByParentNodeId.set(node.parentId, branchLeaseIds);
  }

  return { linkedLeaseIds, linkedLeaseIdsByParentNodeId };
}

export function getLeasesForOwnerNode(
  ownerLeases: Lease[],
  ownerNode: Pick<OwnershipNode, 'id'>,
  leaseScopeIndex: LeaseScopeIndex
): Lease[] {
  const branchLinkedLeaseIds =
    leaseScopeIndex.linkedLeaseIdsByParentNodeId.get(ownerNode.id) ?? new Set<string>();
  const unscopedOwnerLeases = ownerLeases.filter(
    (lease) => !leaseScopeIndex.linkedLeaseIds.has(lease.id)
  );
  const branchLeases = ownerLeases.filter((lease) => branchLinkedLeaseIds.has(lease.id));

  return [...unscopedOwnerLeases, ...branchLeases];
}

export function allocateLeaseCoverage(
  leases: Lease[],
  ownerFractionInput: string
): LeaseCoverageResult {
  const ownerFraction = d(ownerFractionInput);
  if (!ownerFraction.greaterThan(0)) {
    return { allocations: [], overlaps: [] };
  }

  const activeLeases = [...getActiveLeases(leases)].sort(compareLeaseAllocationOrder);
  const allocations: LeaseCoverageAllocation[] = [];
  const overlaps: LeaseCoverageOverlap[] = [];
  let remainingFraction = ownerFraction;

  for (const lease of activeLeases) {
    const leasedInterestText = asLeaseText(lease.leasedInterest).trim();
    let requestedFraction: Decimal;
    if (leasedInterestText.length > 0) {
      const parsed = parseStrictInterestString(leasedInterestText);
      if (parsed === null) {
        overlaps.push({
          leaseId: lease.id,
          leaseName: asLeaseText(lease.leaseName),
          lessee: asLeaseText(lease.lessee),
          requestedFraction: leasedInterestText,
          allocatedFraction: '0',
          clippedFraction: 'malformed',
        });
        continue;
      }
      requestedFraction = parsed;
    } else {
      requestedFraction = ownerFraction;
    }

    if (!remainingFraction.greaterThan(0)) {
      if (requestedFraction.greaterThan(0)) {
        overlaps.push({
          leaseId: lease.id,
          leaseName: asLeaseText(lease.leaseName),
          lessee: asLeaseText(lease.lessee),
          requestedFraction: emitRate(requestedFraction),
          allocatedFraction: '0',
          clippedFraction: emitRate(requestedFraction),
        });
      }
      continue;
    }

    const allocatedFraction = requestedFraction.greaterThan(remainingFraction)
      ? remainingFraction
      : requestedFraction;

    if (requestedFraction.greaterThan(remainingFraction)) {
      const clipped = requestedFraction.minus(remainingFraction);
      overlaps.push({
        leaseId: lease.id,
        leaseName: asLeaseText(lease.leaseName),
        lessee: asLeaseText(lease.lessee),
        requestedFraction: emitRate(requestedFraction),
        allocatedFraction: emitRate(allocatedFraction),
        clippedFraction: emitRate(clipped),
      });
    }

    if (!allocatedFraction.greaterThan(0)) {
      continue;
    }

    allocations.push({
      lease,
      allocatedFraction: emitRate(allocatedFraction),
    });
    remainingFraction = remainingFraction.minus(allocatedFraction);
  }

  return { allocations, overlaps };
}

export function calculateDeskMapCoverageSummary(
  nodes: OwnershipNode[],
  activeLeasesByOwnerId: Map<string, Lease[]>,
  leaseScopeNodes: OwnershipNode[] = nodes
): DeskMapCoverageSummary {
  const leaseScopeIndex = buildLeaseScopeIndex(leaseScopeNodes);
  let currentOwnership = d(0);
  let linkedOwnership = d(0);
  let leasedOwnership = d(0);
  let currentOwnerCount = 0;
  let linkedOwnerCount = 0;
  let leasedOwnerCount = 0;
  const leaseOverlaps: DeskMapCoverageSummary['leaseOverlaps'] = [];

  nodes.forEach((node) => {
    if (node.type === 'related' || isNpriNode(node)) return;
    const remaining = d(node.fraction);
    if (!remaining.greaterThan(0)) return;

    currentOwnerCount += 1;
    currentOwnership = currentOwnership.plus(remaining);

    if (node.linkedOwnerId) {
      linkedOwnerCount += 1;
      linkedOwnership = linkedOwnership.plus(remaining);

      const ownerLeases = getLeasesForOwnerNode(
        activeLeasesByOwnerId.get(node.linkedOwnerId) ?? [],
        node,
        leaseScopeIndex
      );
      const { allocations, overlaps } = allocateLeaseCoverage(ownerLeases, remaining.toString());
      for (const overlap of overlaps) {
        leaseOverlaps.push({
          ownerNodeId: node.id,
          ownerGrantee: node.grantee || 'Unknown',
          overlap,
        });
      }

      if (allocations.length > 0) {
        leasedOwnerCount += 1;
        leasedOwnership = leasedOwnership.plus(
          allocations.reduce(
            (sum, allocation) => sum.plus(d(allocation.allocatedFraction)),
            d(0)
          )
        );
      }
    }
  });

  const whole = d(1);
  const missingOwnership = whole.minus(currentOwnership);
  const unlinkedOwnership = whole.minus(linkedOwnership);
  const unleasedOwnership = whole.minus(leasedOwnership);

  return {
    currentOwnership: emitRate(currentOwnership),
    linkedOwnership: emitRate(linkedOwnership),
    leasedOwnership: emitRate(leasedOwnership),
    missingOwnership: emitRate(missingOwnership),
    unlinkedOwnership: emitRate(unlinkedOwnership),
    unleasedOwnership: emitRate(unleasedOwnership),
    currentOwnerCount,
    linkedOwnerCount,
    leasedOwnerCount,
    currentOwnershipContributors: nodes
      .filter((node) => {
        if (node.type === 'related' || isNpriNode(node)) return false;
        return d(node.fraction).greaterThan(0);
      })
      .map((node) => ({
        nodeId: node.id,
        grantee: node.grantee || 'Unknown',
        fraction: node.fraction,
      })),
    leaseOverlaps,
  };
}
