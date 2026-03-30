import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import { createBlankLease } from '../../../types/owner';
import { buildLeaseNode } from '../deskmap-lease-node';

describe('deskmap-lease-node', () => {
  it('refreshes the node remarks from the shared lease record terms', () => {
    const parentNode = {
      ...createBlankNode('owner-1'),
      grantee: 'Pat Doe',
      linkedOwnerId: 'owner-record-1',
      landDesc: 'Abstract 1, Example County, Texas',
    };
    const lease = createBlankLease('ws-1', 'owner-record-1', {
      id: 'lease-1',
      leaseName: 'Raven Forest Lease',
      lessee: 'Acme Energy',
      royaltyRate: '1/4',
      leasedInterest: '0.5',
      expirationDate: '2030-03-30',
      status: 'Active',
      notes: 'Top lease risk reviewed.',
    });
    const existingNode = {
      ...createBlankNode('lease-node-1', 'owner-1'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      remarks: 'stale remarks should not survive',
    };

    const leaseNode = buildLeaseNode({
      id: 'lease-node-1',
      parentNode,
      lease,
      existingNode,
    });

    expect(leaseNode.remarks).toContain('Lease: Raven Forest Lease');
    expect(leaseNode.remarks).toContain('Royalty: 1/4');
    expect(leaseNode.remarks).toContain('Leased: 0.5');
    expect(leaseNode.remarks).toContain('Status: Active');
    expect(leaseNode.remarks).not.toContain('stale remarks');
  });
});
