import { describe, expect, it, vi } from 'vitest';
import { createBlankLease, type Lease, type LeaseJurisdiction } from '../../../types/owner';
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
      addLease: vi.fn(async (_lease: Lease) => {}),
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

  function mineralNode(id: string): OwnershipNode {
    return {
      ...createBlankNode(id),
      grantee: 'Smith',
      interestClass: 'mineral',
      linkedOwnerId: 'owner-1',
    };
  }

  function tractDraft(
    mineralNodeId: string,
    deskMapId: string,
    overrides: Partial<TractDraft> = {}
  ): TractDraft {
    return {
      mineralNodeId,
      deskMapId,
      deskMapName: deskMapId,
      ownerLabel: 'Smith',
      checked: true,
      leaseName: 'Smith Lease',
      leasedInterest: '0.5',
      grossAcres: '40',
      status: 'Active',
      docNo: '',
      existingLeaseId: null,
      existingLeaseNodeId: null,
      ...overrides,
    };
  }

  const sharedOverrides = {
    lessee: 'Big Oil Co',
    leaseName: 'Smith Lease',
    status: 'Active',
    docNo: 'DOC-9',
    ownerId: 'owner-1',
  };

  // Lease-instrument model: one lease across N tracts is ONE record fanned to a
  // node per tract, with each tract's lessor interest carried on its node.
  it('creates ONE record fanned to a node per tract for a new multi-tract lease', async () => {
    const m1 = mineralNode('m1');
    const m2 = mineralNode('m2');
    const actions = buildActions();

    await reconcileLeaseTractNodes({
      tractDrafts: [tractDraft('m1', 'dm-1'), tractDraft('m2', 'dm-2')],
      parentNode: m1,
      ownerId: 'owner-1',
      resolvedWorkspaceId: 'ws-1',
      nodes: [m1, m2],
      leases: [],
      leaseOverrides: sharedOverrides,
      normalizedInterestByNode: new Map([
        ['m1', '0.5'],
        ['m2', '0.25'],
      ]),
      actions,
    });

    // exactly one canonical record, blank record-level leased interest
    expect(actions.addLease).toHaveBeenCalledTimes(1);
    expect(actions.updateLease).not.toHaveBeenCalled();
    const record = actions.addLease.mock.calls[0][0];
    expect(record.leasedInterest).toBe('');
    expect(record.leaseName).toBe('Smith Lease');

    // one lease-node per tract, both linked to the canonical record, each
    // carrying its own per-tract leased interest
    expect(actions.addNode).toHaveBeenCalledTimes(2);
    const created = actions.addNode.mock.calls.map((call) => call[0] as OwnershipNode);
    expect(created.every((node) => node.linkedLeaseId === record.id)).toBe(true);
    expect(
      created.map((node) => node.leaseTractLeasedInterest).sort()
    ).toEqual(['0.25', '0.5']);
  });

  // Editing a lease that was saved in the old per-tract-record shape must
  // consolidate the duplicates into the originating record, not keep spawning them.
  it('consolidates legacy per-tract duplicate records into one on edit', async () => {
    const m1 = mineralNode('m1');
    const m2 = mineralNode('m2');
    const lease1 = createBlankLease('ws-1', 'owner-1', { id: 'lease-1', leaseName: 'Smith Lease' });
    const lease2 = createBlankLease('ws-1', 'owner-1', { id: 'lease-2', leaseName: 'Smith Lease' });
    const ln1: OwnershipNode = {
      ...createBlankNode('ln-1', 'm1'),
      type: 'related',
      relatedKind: 'lease',
      linkedLeaseId: 'lease-1',
    };
    const ln2: OwnershipNode = {
      ...createBlankNode('ln-2', 'm2'),
      type: 'related',
      relatedKind: 'lease',
      linkedLeaseId: 'lease-2',
    };
    const actions = buildActions();

    await reconcileLeaseTractNodes({
      tractDrafts: [
        tractDraft('m1', 'dm-1', { existingLeaseId: 'lease-1', existingLeaseNodeId: 'ln-1' }),
        tractDraft('m2', 'dm-2', { existingLeaseId: 'lease-2', existingLeaseNodeId: 'ln-2' }),
      ],
      parentNode: m1,
      ownerId: 'owner-1',
      resolvedWorkspaceId: 'ws-1',
      nodes: [m1, m2, ln1, ln2],
      leases: [lease1, lease2],
      leaseOverrides: { ...sharedOverrides, docNo: '' },
      normalizedInterestByNode: new Map([
        ['m1', '0.5'],
        ['m2', '0.25'],
      ]),
      actions,
    });

    // originating record is the canonical; it's updated, not duplicated
    expect(actions.updateLease).toHaveBeenCalledWith(
      'lease-1',
      expect.objectContaining({ id: 'lease-1' })
    );
    expect(actions.addLease).not.toHaveBeenCalled();
    // both lease-nodes now point at the canonical record
    expect(actions.updateNode).toHaveBeenCalledWith(
      'ln-1',
      expect.objectContaining({ linkedLeaseId: 'lease-1' })
    );
    expect(actions.updateNode).toHaveBeenCalledWith(
      'ln-2',
      expect.objectContaining({ linkedLeaseId: 'lease-1' })
    );
    // the now-orphaned duplicate record is dropped; the canonical is kept
    expect(actions.removeLease).toHaveBeenCalledWith('lease-2');
    expect(actions.removeLease).not.toHaveBeenCalledWith('lease-1');
  });
});
