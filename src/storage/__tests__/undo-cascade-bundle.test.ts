/**
 * Pure tests for the owner-cleanup planner shared by the post-delete cleanup
 * and the undo capture (the two must never disagree about which rows die).
 * The Dexie capture/restore paths follow the canonical fenced bulkGet/bulkPut
 * idioms and are exercised through the store-level undo wiring tests.
 */
import { describe, expect, it } from 'vitest';
import { createBlankNode, normalizeOwnershipNode, type OwnershipNode } from '../../types/node';
import { createBlankLease, type Lease } from '../../types/owner';
import { planOwnerRecordCleanup } from '../undo-cascade-bundle';

function node(id: string, fields: Partial<OwnershipNode> = {}): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(id), ...fields });
}

function lease(id: string, ownerId: string): Lease {
  return createBlankLease('ws-1', ownerId, { id });
}

describe('planOwnerRecordCleanup', () => {
  it('removes an owner only when no surviving node or lease still references them', () => {
    const removed = [node('a', { linkedOwnerId: 'owner-1' })];
    const surviving = [node('b', { linkedOwnerId: 'owner-1' })];
    expect(planOwnerRecordCleanup(removed, surviving, [])).toEqual({
      ownerIdsToRemove: [],
      leaseIdsToRemove: [],
    });

    expect(planOwnerRecordCleanup(removed, [node('c')], [])).toEqual({
      ownerIdsToRemove: ['owner-1'],
      leaseIdsToRemove: [],
    });
  });

  it('keeps an owner whose lease is still linked by a surviving node', () => {
    const removed = [node('a', { linkedOwnerId: 'owner-1' })];
    const surviving = [node('b', { linkedLeaseId: 'lease-1' })];
    expect(
      planOwnerRecordCleanup(removed, surviving, [lease('lease-1', 'owner-1')])
    ).toEqual({ ownerIdsToRemove: [], leaseIdsToRemove: [] });
  });

  it('removes a lease individually when its owner survives', () => {
    const removed = [
      node('a', { linkedLeaseId: 'lease-1', linkedOwnerId: 'owner-1' }),
    ];
    const surviving = [node('b', { linkedOwnerId: 'owner-1' })];
    expect(
      planOwnerRecordCleanup(removed, surviving, [lease('lease-1', 'owner-1')])
    ).toEqual({ ownerIdsToRemove: [], leaseIdsToRemove: ['lease-1'] });
  });

  it('folds a lease into its removed owner instead of double-removing', () => {
    const removed = [
      node('a', { linkedOwnerId: 'owner-1', linkedLeaseId: 'lease-1' }),
    ];
    expect(
      planOwnerRecordCleanup(removed, [], [lease('lease-1', 'owner-1')])
    ).toEqual({ ownerIdsToRemove: ['owner-1'], leaseIdsToRemove: [] });
  });

  it('returns empty plans for unlinked removals', () => {
    expect(planOwnerRecordCleanup([node('a')], [node('b')], [])).toEqual({
      ownerIdsToRemove: [],
      leaseIdsToRemove: [],
    });
  });
});
