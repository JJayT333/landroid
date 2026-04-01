import { d } from '../../engine/decimal';
import { isNpriNode, type OwnershipNode } from '../../types/node';
import type { Lease } from '../../types/owner';
import { parseInterestString } from '../../utils/interest-string';

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

const INACTIVE_LEASE_STATUSES = new Set([
  'expired',
  'released',
  'terminated',
  'inactive',
  'dead',
]);

function asLeaseText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function isLeaseActive(lease: Lease) {
  const normalizedStatus = asLeaseText(lease.status).trim().toLowerCase();
  if (normalizedStatus.length === 0) return true;
  return !INACTIVE_LEASE_STATUSES.has(normalizedStatus);
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

export function allocateLeaseCoverage(
  leases: Lease[],
  ownerFractionInput: string
): LeaseCoverageAllocation[] {
  const ownerFraction = d(ownerFractionInput);
  if (!ownerFraction.greaterThan(0)) {
    return [];
  }

  const activeLeases = [...getActiveLeases(leases)].sort(compareLeaseAllocationOrder);
  const allocations: LeaseCoverageAllocation[] = [];
  let remainingFraction = ownerFraction;

  for (const lease of activeLeases) {
    if (!remainingFraction.greaterThan(0)) {
      break;
    }

    const leasedInterestText = asLeaseText(lease.leasedInterest).trim();
    const requestedFraction = leasedInterestText.length > 0
      ? parseInterestString(leasedInterestText)
      : ownerFraction;
    const allocatedFraction = requestedFraction.greaterThan(remainingFraction)
      ? remainingFraction
      : requestedFraction;

    if (!allocatedFraction.greaterThan(0)) {
      continue;
    }

    allocations.push({
      lease,
      allocatedFraction: allocatedFraction.toString(),
    });
    remainingFraction = remainingFraction.minus(allocatedFraction);
  }

  return allocations;
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
  activeLeasesByOwnerId: Map<string, Lease[]>
): DeskMapCoverageSummary {
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

      const ownerLeases = activeLeasesByOwnerId.get(node.linkedOwnerId) ?? [];
      const allocations = allocateLeaseCoverage(ownerLeases, remaining.toString());

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
