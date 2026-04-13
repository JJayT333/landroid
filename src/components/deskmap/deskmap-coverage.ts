import { d } from '../../engine/decimal';
import { isNpriNode, type OwnershipNode } from '../../types/node';
import { isInactiveLeaseStatus, type Lease } from '../../types/owner';
import { parseInterestString } from '../../utils/interest-string';
import { isLeaseNode } from './deskmap-lease-node';

export interface DeskMapPrimaryLeaseSummary {
  id: string;
  leaseName: string;
  lessee: string;
  royaltyRate: string;
  leasedInterest: string;
  effectiveDate: string;
  expirationDate: string;
  status: string;
  docNo: string;
  notes: string;
}

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
}

export interface LeaseCoverageAllocation {
  lease: Lease;
  allocatedFraction: string;
}

/**
 * Warning-only signal emitted when two or more active leases for the same owner
 * try to claim more of the owner's interest than the owner holds. The later
 * lease (in effective-date order) is silently clipped by `allocateLeaseCoverage`
 * today, which is why a separate warning is surfaced here rather than a
 * blocking error — the user may have a chain-of-title issue or a top-lease
 * scenario that LANDroid should flag for human review, not quietly resolve.
 * Matches the existing warning-only over-assignment convention.
 */
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

export function isLeaseActive(lease: Lease) {
  return !isInactiveLeaseStatus(lease.status);
}

function compareLeaseAllocationOrder(left: Lease, right: Lease) {
  return (
    `${asLeaseText(left.effectiveDate) || '9999-12-31'}|${left.createdAt}|${left.updatedAt}|${left.id}`
  ).localeCompare(
    `${asLeaseText(right.effectiveDate) || '9999-12-31'}|${right.createdAt}|${right.updatedAt}|${right.id}`
  );
}

export function getActiveLeases(leases: Lease[]) {
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
    const requestedFraction = leasedInterestText.length > 0
      ? parseInterestString(leasedInterestText)
      : ownerFraction;

    // If earlier leases already exhausted the owner's share, any subsequent
    // lease is fully clipped: requested > 0, allocated = 0, clipped = requested.
    if (!remainingFraction.greaterThan(0)) {
      if (requestedFraction.greaterThan(0)) {
        overlaps.push({
          leaseId: lease.id,
          leaseName: asLeaseText(lease.leaseName),
          lessee: asLeaseText(lease.lessee),
          requestedFraction: requestedFraction.toString(),
          allocatedFraction: '0',
          clippedFraction: requestedFraction.toString(),
        });
      }
      continue;
    }

    const allocatedFraction = requestedFraction.greaterThan(remainingFraction)
      ? remainingFraction
      : requestedFraction;

    // Partial clip: the lease wanted more than the owner had remaining.
    // Record the clipped amount as an overlap warning before writing the
    // allocation. A lease that requests exactly the remaining fraction is NOT
    // an overlap.
    if (requestedFraction.greaterThan(remainingFraction)) {
      const clipped = requestedFraction.minus(remainingFraction);
      overlaps.push({
        leaseId: lease.id,
        leaseName: asLeaseText(lease.leaseName),
        lessee: asLeaseText(lease.lessee),
        requestedFraction: requestedFraction.toString(),
        allocatedFraction: allocatedFraction.toString(),
        clippedFraction: clipped.toString(),
      });
    }

    if (!allocatedFraction.greaterThan(0)) {
      continue;
    }

    allocations.push({
      lease,
      allocatedFraction: allocatedFraction.toString(),
    });
    remainingFraction = remainingFraction.minus(allocatedFraction);
  }

  return { allocations, overlaps };
}

export function pickPrimaryLease(leases: Lease[]): Lease | null {
  const activeLeases = getActiveLeases(leases);
  if (activeLeases.length === 0) return null;

  return [...activeLeases].sort((left, right) =>
    `${right.updatedAt}|${right.createdAt}|${right.id}`.localeCompare(
      `${left.updatedAt}|${left.createdAt}|${left.id}`
    )
  )[0] ?? null;
}

export function toDeskMapPrimaryLeaseSummary(
  lease: Lease | null
): DeskMapPrimaryLeaseSummary | null {
  if (!lease) return null;
  return {
    id: lease.id,
    leaseName: asLeaseText(lease.leaseName),
    lessee: asLeaseText(lease.lessee),
    royaltyRate: asLeaseText(lease.royaltyRate),
    leasedInterest: asLeaseText(lease.leasedInterest),
    effectiveDate: asLeaseText(lease.effectiveDate),
    expirationDate: asLeaseText(lease.expirationDate),
    status: asLeaseText(lease.status),
    docNo: asLeaseText(lease.docNo),
    notes: asLeaseText(lease.notes),
  };
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
      // Overlap warnings are discarded here — the desk-map coverage summary
      // does not surface them today. The leasehold summary (`leasehold-summary.ts`)
      // is the canonical consumer of per-owner overlap warnings and bubbles them
      // up to the tract and unit level for the leasehold deck UI.
      const { allocations } = allocateLeaseCoverage(ownerLeases, remaining.toString());

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
    currentOwnership: currentOwnership.toString(),
    linkedOwnership: linkedOwnership.toString(),
    leasedOwnership: leasedOwnership.toString(),
    missingOwnership: missingOwnership.toString(),
    unlinkedOwnership: unlinkedOwnership.toString(),
    unleasedOwnership: unleasedOwnership.toString(),
    currentOwnerCount,
    linkedOwnerCount,
    leasedOwnerCount,
  };
}
