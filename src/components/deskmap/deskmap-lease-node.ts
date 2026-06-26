import type { Lease } from '../../types/owner';
import { createBlankNode, type OwnershipNode } from '../../types/node';

export function isLeaseNode(
  node: Pick<OwnershipNode, 'type' | 'relatedKind'>
): boolean {
  return node.type === 'related' && node.relatedKind === 'lease';
}

export function buildLeaseNodeRemarks(lease: Lease): string {
  const parts = [
    lease.leaseName ? `Lease: ${lease.leaseName}` : '',
    lease.royaltyRate ? `Royalty: ${lease.royaltyRate}` : '',
    lease.leasedInterest ? `Leased: ${lease.leasedInterest}` : '',
    lease.status ? `Status: ${lease.status}` : '',
    lease.expirationDate ? `Expires ${lease.expirationDate}` : '',
    lease.notes ? `Notes: ${lease.notes}` : '',
  ].filter(Boolean);

  return parts.join(' | ');
}

export function buildLeaseNode({
  id,
  parentNode,
  lease,
  existingNode,
  tractLeasedInterest,
  tractGrossAcres,
}: {
  id: string;
  parentNode: OwnershipNode;
  lease: Lease;
  existingNode?: OwnershipNode | null;
  /**
   * Per-tract leased interest for this lease-node when one instrument fans across
   * tracts. `undefined` leaves any existing node value untouched (the re-sync
   * path); a provided string sets it authoritatively (`''` clears the override).
   */
  tractLeasedInterest?: string;
  /** Per-tract gross acres for this lease-node; same `undefined`/clear semantics. */
  tractGrossAcres?: string;
}): OwnershipNode {
  const base = existingNode
    ? { ...existingNode }
    : createBlankNode(id, parentNode.id);

  // Resolve per-tract fields: a provided param wins (even ''); otherwise keep the
  // existing node's value. Drop the stale copies off `base` so an explicit clear
  // isn't re-introduced by the spread, then re-add below only when non-empty.
  const resolvedLeasedInterest = (
    tractLeasedInterest !== undefined ? tractLeasedInterest : base.leaseTractLeasedInterest ?? ''
  ).trim();
  const resolvedGrossAcres = (
    tractGrossAcres !== undefined ? tractGrossAcres : base.leaseTractGrossAcres ?? ''
  ).trim();
  delete base.leaseTractLeasedInterest;
  delete base.leaseTractGrossAcres;

  return {
    ...base,
    id,
    parentId: parentNode.id,
    type: 'related',
    relatedKind: 'lease',
    instrument: 'Oil & Gas Lease',
    date: lease.effectiveDate || base.date,
    fileDate: base.fileDate || lease.effectiveDate,
    docNo: lease.docNo || base.docNo,
    grantor: parentNode.grantee || base.grantor,
    grantee: lease.lessee || base.grantee,
    landDesc: parentNode.landDesc || base.landDesc,
    remarks: buildLeaseNodeRemarks(lease) || base.remarks,
    fraction: '0',
    initialFraction: '0',
    linkedOwnerId: parentNode.linkedOwnerId ?? lease.ownerId,
    linkedLeaseId: lease.id,
    ...(resolvedLeasedInterest ? { leaseTractLeasedInterest: resolvedLeasedInterest } : {}),
    ...(resolvedGrossAcres ? { leaseTractGrossAcres: resolvedGrossAcres } : {}),
  };
}
