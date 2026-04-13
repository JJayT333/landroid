import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import { planDeskMapLeaseDeletion } from '../deskmap-lease-delete';

function leaseNode(id: string, leaseId: string) {
  return {
    ...createBlankNode(id, 'owner-node'),
    type: 'related' as const,
    relatedKind: 'lease' as const,
    linkedLeaseId: leaseId,
  };
}

describe('planDeskMapLeaseDeletion', () => {
  it('removes the owner lease record when deleting the only linked lease card', () => {
    expect(planDeskMapLeaseDeletion([leaseNode('lease-node', 'lease-1')], 'lease-node')).toEqual({
      leaseId: 'lease-1',
      removeOwnerLeaseRecord: true,
    });
  });

  it('keeps the owner lease record when another Desk Map card still uses it', () => {
    expect(
      planDeskMapLeaseDeletion(
        [leaseNode('lease-node-a', 'lease-1'), leaseNode('lease-node-b', 'lease-1')],
        'lease-node-a'
      )
    ).toEqual({
      leaseId: 'lease-1',
      removeOwnerLeaseRecord: false,
    });
  });

  it('treats ordinary title cards as node-only deletions', () => {
    expect(planDeskMapLeaseDeletion([createBlankNode('owner-node')], 'owner-node')).toEqual({
      leaseId: null,
      removeOwnerLeaseRecord: false,
    });
  });
});
