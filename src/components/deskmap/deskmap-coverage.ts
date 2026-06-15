// Compatibility shim + UI helpers.
//
// The lease-coverage math (the lease-scope index, owner-node lease resolution,
// first-effective-wins allocation, and the per-tract coverage summary) now lives
// in the unified title-math engine; it is re-exported here so existing consumers
// keep their import path. Implementation: src/title-math/calculators/coverage.ts.
// The view-only helpers below (primary-lease selection / formatting and the
// lease-eligibility predicate) are not title math and remain here.
import { getActiveLeases } from '../../title-math/calculators/coverage';
import { isNpriNode, type OwnershipNode } from '../../types/node';
import type { Lease } from '../../types/owner';

export {
  allocateLeaseCoverage,
  buildLeaseScopeIndex,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
  getLeasesForOwnerNode,
  isLeaseActive,
} from '../../title-math/calculators/coverage';
export type {
  DeskMapCoverageSummary,
  LeaseCoverageAllocation,
  LeaseCoverageOverlap,
  LeaseCoverageResult,
  LeaseScopeIndex,
} from '../../title-math/calculators/coverage';

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

function asLeaseText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Mineral-only lease gate: Texas leasehold math only consumes leases attached
 * under a mineral-class owner node. NPRI royalty streams and any future
 * non-mineral interest class are never lessors. This predicate is the single
 * source of truth shared by the AttachLeaseModal and by DeskMapView's per-node
 * lease summary builder.
 */
export function canOwnerNodeHoldLease<
  T extends Pick<OwnershipNode, 'type' | 'interestClass' | 'linkedOwnerId'>,
>(node: T): node is T & { linkedOwnerId: string; interestClass: 'mineral' } {
  if (node.type === 'related') return false;
  if (!node.linkedOwnerId) return false;
  if (isNpriNode(node)) return false;
  return node.interestClass === 'mineral';
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
