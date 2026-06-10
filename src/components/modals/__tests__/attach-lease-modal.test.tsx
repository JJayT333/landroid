import { describe, expect, it, vi } from 'vitest';
import { createBlankLease, type LeaseJurisdiction } from '../../../types/owner';
import { createBlankNode, type OwnershipNode } from '../../../types/node';
import type { TractDraft } from '../../leasehold/lease-tract-rows';
import {
  getAttachLeaseModalTexasMathError,
  reconcileLeaseTractNodes,
} from '../AttachLeaseModal';

describe('AttachLeaseModal Texas math guard', () => {
  it('blocks federal, private, and tribal leases from Desk Map math', () => {
    const blockedJurisdictions = ['federal', 'private', 'tribal'] satisfies LeaseJurisdiction[];
    for (const jurisdiction of blockedJurisdictions) {
      const lease = createBlankLease('ws-1', 'owner-1', { jurisdiction });

      expect(getAttachLeaseModalTexasMathError(lease)).toMatch(
        /Only Texas fee\/state leases/
      );
    }
  });

  it('allows Texas fee and Texas state leases', () => {
    const texasJurisdictions = ['tx_fee', 'tx_state'] satisfies LeaseJurisdiction[];
    for (const jurisdiction of texasJurisdictions) {
      const lease = createBlankLease('ws-1', 'owner-1', { jurisdiction });

      expect(getAttachLeaseModalTexasMathError(lease)).toBeNull();
    }
  });
});

describe('reconcileLeaseTractNodes', () => {
  function buildActions() {
    return {
      addLease: vi.fn(async () => {}),
      updateLease: vi.fn(async () => {}),
      removeLease: vi.fn(async () => {}),
      addNode: vi.fn(),
      updateNode: vi.fn(),
      removeNode: vi.fn(),
      addNodeToDeskMap: vi.fn(),
    };
  }

  // Regression: lease record created first (Owners "Add Lease" form), then the
  // user saves from the "Create Tract N" path. The tract slice carries an
  // existingLeaseId but no existingLeaseNodeId; saving must create the missing
  // lessee node instead of silently doing nothing.
  it('creates the missing lessee node when a tract has a record but no node', async () => {
    const parentNode: OwnershipNode = {
      ...createBlankNode('m1'),
      grantee: 'Smith',
      linkedOwnerId: 'owner-1',
    };
    const existingLease = createBlankLease('ws-1', 'owner-1', {
      id: 'lease-1',
      leaseName: 'Smith Lease',
    });
    const tract: TractDraft = {
      mineralNodeId: 'm1',
      deskMapId: 'dm-1',
      deskMapName: 'Tract 1',
      ownerLabel: 'Smith',
      checked: true,
      leaseName: 'Smith Lease',
      leasedInterest: '0.5',
      grossAcres: '40',
      status: 'Active',
      docNo: '',
      existingLeaseId: 'lease-1',
      existingLeaseNodeId: null,
    };
    const actions = buildActions();

    const originatingNodeId = await reconcileLeaseTractNodes({
      tractDrafts: [tract],
      parentNode,
      ownerId: 'owner-1',
      resolvedWorkspaceId: 'ws-1',
      nodes: [parentNode],
      leases: [existingLease],
      leaseOverrides: { lessee: 'Big Oil Co', ownerId: 'owner-1' },
      normalizedInterestByNode: new Map([['m1', '0.5']]),
      actions,
    });

    expect(actions.updateLease).toHaveBeenCalledWith(
      'lease-1',
      expect.objectContaining({ id: 'lease-1', lessee: 'Big Oil Co' })
    );
    expect(actions.addNode).toHaveBeenCalledTimes(1);
    const createdNode = actions.addNode.mock.calls[0][0] as OwnershipNode;
    expect(createdNode.linkedLeaseId).toBe('lease-1');
    expect(createdNode.relatedKind).toBe('lease');
    expect(createdNode.parentId).toBe('m1');
    expect(actions.addNodeToDeskMap).toHaveBeenCalledWith(
      createdNode.id,
      'dm-1'
    );
    expect(originatingNodeId).toBe(createdNode.id);
    // No pre-existing node, so nothing to update or remove.
    expect(actions.updateNode).not.toHaveBeenCalled();
    expect(actions.removeNode).not.toHaveBeenCalled();
  });

  it('updates the existing lessee node when the tract has both record and node', async () => {
    const parentNode: OwnershipNode = {
      ...createBlankNode('m1'),
      grantee: 'Smith',
      linkedOwnerId: 'owner-1',
    };
    const existingLease = createBlankLease('ws-1', 'owner-1', {
      id: 'lease-1',
    });
    const existingNode: OwnershipNode = {
      ...createBlankNode('ln-1', 'm1'),
      type: 'related',
      relatedKind: 'lease',
      linkedLeaseId: 'lease-1',
    };
    const tract: TractDraft = {
      mineralNodeId: 'm1',
      deskMapId: 'dm-1',
      deskMapName: 'Tract 1',
      ownerLabel: 'Smith',
      checked: true,
      leaseName: 'Smith Lease',
      leasedInterest: '0.5',
      grossAcres: '40',
      status: 'Active',
      docNo: '',
      existingLeaseId: 'lease-1',
      existingLeaseNodeId: 'ln-1',
    };
    const actions = buildActions();

    const originatingNodeId = await reconcileLeaseTractNodes({
      tractDrafts: [tract],
      parentNode,
      ownerId: 'owner-1',
      resolvedWorkspaceId: 'ws-1',
      nodes: [parentNode, existingNode],
      leases: [existingLease],
      leaseOverrides: { lessee: 'Big Oil Co', ownerId: 'owner-1' },
      normalizedInterestByNode: new Map([['m1', '0.5']]),
      actions,
    });

    expect(actions.updateNode).toHaveBeenCalledWith(
      'ln-1',
      expect.objectContaining({ linkedLeaseId: 'lease-1' })
    );
    expect(actions.addNode).not.toHaveBeenCalled();
    expect(actions.addNodeToDeskMap).not.toHaveBeenCalled();
    expect(originatingNodeId).toBe('ln-1');
  });
});
