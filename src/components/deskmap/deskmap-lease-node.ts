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
}: {
  id: string;
  parentNode: OwnershipNode;
  lease: Lease;
  existingNode?: OwnershipNode | null;
}): OwnershipNode {
  const base = existingNode
    ? { ...existingNode }
    : createBlankNode(id, parentNode.id);

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
  };
}
