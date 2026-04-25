import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode } from '../../types/node';
import { createBlankLease } from '../../types/owner';

const mocks = vi.hoisted(() => ({
  unlinkDeskMap: vi.fn(),
  unlinkNode: vi.fn(),
  deletePdf: vi.fn(),
  unlinkCurativeNode: vi.fn(),
}));

vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkDeskMap: mocks.unlinkDeskMap,
      unlinkNode: mocks.unlinkNode,
    }),
  },
}));

vi.mock('../../storage/pdf-store', () => ({
  deletePdf: mocks.deletePdf,
}));

vi.mock('../curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: mocks.unlinkCurativeNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));

import { useWorkspaceStore } from '../workspace-store';

describe('workspace-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      workspaceId: 'ws-test',
      projectName: 'Workspace Store Test',
      nodes: [],
      deskMaps: [],
      leaseholdUnit: createBlankLeaseholdUnit(),
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
      activeDeskMapId: null,
      activeUnitCode: null,
      instrumentTypes: ['Deed'],
      _hydrated: true,
      activeNodeId: null,
      lastAudit: null,
      lastError: null,
      startupWarning: null,
    });
  });

  it('repairs an invalid active desk map id while loading a workspace', () => {
    const rootNode = {
      ...createBlankNode('node-1', null),
      grantee: 'Root Owner',
      instrument: 'Patent',
      initialFraction: '1.000000000',
      fraction: '1.000000000',
      numerator: '1',
      denominator: '1',
    };

    useWorkspaceStore.getState().loadWorkspace({
      workspaceId: 'ws-loaded',
      projectName: 'Loaded Workspace',
      nodes: [rootNode],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['node-1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'missing-desk-map',
      instrumentTypes: ['Deed'],
    });

    expect(useWorkspaceStore.getState().activeDeskMapId).toBe('dm-1');
    expect(useWorkspaceStore.getState().getActiveDeskMapNodes()).toEqual([
      expect.objectContaining({ id: 'node-1' }),
    ]);
  });

  it('adds nodes to the first desk map when the active desk map pointer is stale', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'missing-desk-map',
    });

    useWorkspaceStore.getState().addNodeToActiveDeskMap('node-99');

    const state = useWorkspaceStore.getState();
    expect(state.activeDeskMapId).toBe('dm-1');
    expect(state.deskMaps[0]?.nodeIds).toEqual(['node-99']);
    expect(state.deskMaps[1]?.nodeIds).toEqual([]);
  });

  it('tracks active unit code and creates new tracts inside the selected unit', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-a1',
          name: 'A Tract 1',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
        {
          id: 'dm-b1',
          name: 'B Tract 1',
          code: 'B1',
          tractId: 'B1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit B',
          unitCode: 'B',
        },
      ],
      activeDeskMapId: 'dm-a1',
      activeUnitCode: 'A',
    });

    useWorkspaceStore.getState().setActiveUnitCode('B');
    const newDeskMapId = useWorkspaceStore.getState().createDeskMap(
      'B Tract 2',
      'B2',
      [],
      {
        unitName: 'Raven Forest Unit B',
        unitCode: 'B',
      }
    );

    const state = useWorkspaceStore.getState();
    expect(state.activeUnitCode).toBe('B');
    expect(state.activeDeskMapId).toBe(newDeskMapId);
    expect(state.deskMaps.find((deskMap) => deskMap.id === newDeskMapId)).toEqual(
      expect.objectContaining({
        unitName: 'Raven Forest Unit B',
        unitCode: 'B',
      })
    );
  });

  it('defaults new unit-scope leasehold records to the active unit', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-a1',
          name: 'A Tract 1',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
      ],
      activeDeskMapId: 'dm-a1',
      activeUnitCode: 'A',
    });

    const assignmentId = useWorkspaceStore.getState().addLeaseholdAssignment({
      scope: 'unit',
      assignee: 'Caprock Resources',
    });
    const orriId = useWorkspaceStore.getState().addLeaseholdOrri({
      scope: 'unit',
      payee: 'Override Owner',
    });

    const state = useWorkspaceStore.getState();
    expect(state.leaseholdAssignments.find((item) => item.id === assignmentId)).toEqual(
      expect.objectContaining({ unitCode: 'A' })
    );
    expect(state.leaseholdOrris.find((item) => item.id === orriId)).toEqual(
      expect.objectContaining({ unitCode: 'A' })
    );
  });

  it('refreshes linked lease node display fields from the canonical lease record', () => {
    const parentNode = {
      ...createBlankNode('owner-node', null),
      grantee: 'Ava Moonwhistle',
      landDesc: 'Abstract 1, Example County, Texas',
      linkedOwnerId: 'owner-1',
      initialFraction: '1',
      fraction: '1',
    };
    const leaseNode = {
      ...createBlankNode('lease-node', 'owner-node'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      grantee: 'Old Lessee',
      remarks: 'stale remarks',
      linkedOwnerId: 'owner-1',
      linkedLeaseId: 'lease-1',
    };
    const lease = createBlankLease('ws-test', 'owner-1', {
      id: 'lease-1',
      leaseName: 'Updated Lease',
      lessee: 'Bluebonnet Operating',
      royaltyRate: '1/8',
      leasedInterest: '1',
      status: 'Active',
      docNo: '2026-1001',
      notes: 'Fresh notes',
    });

    useWorkspaceStore.setState({
      nodes: [parentNode, leaseNode],
    });

    useWorkspaceStore.getState().syncLeaseNodesFromRecord(lease);

    expect(useWorkspaceStore.getState().nodes).toEqual([
      expect.objectContaining({ id: 'owner-node' }),
      expect.objectContaining({
        id: 'lease-node',
        grantee: 'Bluebonnet Operating',
        docNo: '2026-1001',
        linkedLeaseId: 'lease-1',
      }),
    ]);
    expect(useWorkspaceStore.getState().nodes[1]?.remarks).toContain(
      'Lease: Updated Lease'
    );
    expect(useWorkspaceStore.getState().nodes[1]?.remarks).toContain(
      'Royalty: 1/8'
    );
  });

  it('neutralizes stale lessee card facts when a linked lease record is deleted', () => {
    const leaseNode = {
      ...createBlankNode('lease-node', 'owner-node'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      date: '2026-01-01',
      fileDate: '2026-01-02',
      docNo: '2026-1001',
      grantee: 'Old Lessee',
      remarks: 'Lease: Old Lease | Royalty: 1/8',
      linkedLeaseId: 'lease-1',
    };

    useWorkspaceStore.setState({
      nodes: [leaseNode],
    });

    useWorkspaceStore.getState().clearLinkedLease('lease-1');

    expect(useWorkspaceStore.getState().nodes[0]).toEqual(
      expect.objectContaining({
        linkedLeaseId: null,
        date: '',
        fileDate: '',
        docNo: '',
        grantee: '',
        remarks: 'Lease record removed; review or delete this lessee card.',
      })
    );
  });

  it('clears the active desk map nodes and scoped leasehold rows without deleting other tracts', () => {
    const root = {
      ...createBlankNode('root-1', null),
      grantee: 'Root Owner',
      initialFraction: '1',
      fraction: '0.5',
    };
    const child = {
      ...createBlankNode('child-1', 'root-1'),
      grantee: 'Child Owner',
      initialFraction: '0.5',
      fraction: '0.5',
    };
    const otherRoot = {
      ...createBlankNode('root-2', null),
      grantee: 'Other Tract Owner',
      initialFraction: '1',
      fraction: '1',
    };

    useWorkspaceStore.setState({
      nodes: [root, child, otherRoot],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-1', 'child-1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-2'],
        },
      ],
      activeDeskMapId: 'dm-1',
      activeNodeId: 'child-1',
      leaseholdAssignments: [
        {
          id: 'assignment-1',
          assignor: '',
          assignee: '',
          scope: 'tract',
          deskMapId: 'dm-1',
          workingInterestFraction: '',
          effectiveDate: '',
          sourceDocNo: '',
          notes: '',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-1',
          payee: '',
          scope: 'tract',
          deskMapId: 'dm-1',
          burdenFraction: '',
          burdenBasis: 'gross_8_8',
          effectiveDate: '',
          sourceDocNo: '',
          notes: '',
        },
      ],
      leaseholdTransferOrderEntries: [
        {
          id: 'entry-1',
          sourceRowId: 'royalty-dm-1-owner-1',
          ownerNumber: '',
          status: 'draft',
          notes: '',
        },
        {
          id: 'entry-2',
          sourceRowId: 'assignment-other',
          ownerNumber: '',
          status: 'draft',
          notes: '',
        },
      ],
    });

    useWorkspaceStore.getState().clearDeskMapNodes('dm-1');

    const state = useWorkspaceStore.getState();
    expect(state.nodes.map((node) => node.id)).toEqual(['root-2']);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-1')?.nodeIds).toEqual([]);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-2')?.nodeIds).toEqual(['root-2']);
    expect(state.activeNodeId).toBeNull();
    expect(state.leaseholdAssignments).toEqual([]);
    expect(state.leaseholdOrris).toEqual([]);
    expect(state.leaseholdTransferOrderEntries).toEqual([
      expect.objectContaining({ sourceRowId: 'assignment-other' }),
    ]);
    expect(mocks.deletePdf).toHaveBeenCalledWith('root-1');
    expect(mocks.deletePdf).toHaveBeenCalledWith('child-1');
    expect(mocks.unlinkNode).toHaveBeenCalledWith('root-1');
    expect(mocks.unlinkNode).toHaveBeenCalledWith('child-1');
    expect(mocks.unlinkCurativeNode).toHaveBeenCalledWith('root-1');
    expect(mocks.unlinkCurativeNode).toHaveBeenCalledWith('child-1');
  });

  it('removes shared nodes from the cleared desk map without deleting their records', () => {
    const sharedRoot = {
      ...createBlankNode('shared-root', null),
      grantee: 'Shared Owner',
      initialFraction: '1',
      fraction: '1',
    };

    useWorkspaceStore.setState({
      nodes: [sharedRoot],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['shared-root'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['shared-root'],
        },
      ],
      activeDeskMapId: 'dm-1',
      activeNodeId: 'shared-root',
    });

    useWorkspaceStore.getState().clearDeskMapNodes('dm-1');

    const state = useWorkspaceStore.getState();
    expect(state.nodes.map((node) => node.id)).toEqual(['shared-root']);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-1')?.nodeIds).toEqual([]);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-2')?.nodeIds).toEqual([
      'shared-root',
    ]);
    expect(mocks.deletePdf).not.toHaveBeenCalled();
    expect(mocks.unlinkNode).not.toHaveBeenCalled();
  });

  it('rejects createRootNode when explicit deskMapId does not exist (audit M2)', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-real',
          name: 'Real Tract',
          code: 'R1',
          tractId: 'R1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-real',
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-x',
      '1',
      { grantee: 'Typed Wrong ID', instrument: 'Patent' },
      'dm-does-not-exist'
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(false);
    expect(state.nodes).toEqual([]);
    expect(state.deskMaps[0]?.nodeIds).toEqual([]);
    expect(state.lastError).toMatch(/not found/i);
  });

  it('batchAttachConveyance is atomic — one invalid orphan aborts all (audit M1)', () => {
    const parent = {
      ...createBlankNode('parent', null),
      grantee: 'Common Grantor',
      instrument: 'Patent',
      interestClass: 'mineral' as const,
      initialFraction: '1.000000000',
      fraction: '1.000000000',
    };
    const orphanA = {
      ...createBlankNode('orphan-a', null),
      grantee: 'Orphan A',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    const orphanB = {
      ...createBlankNode('orphan-b', null),
      grantee: 'Orphan B',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    useWorkspaceStore.setState({
      nodes: [parent, orphanA, orphanB],
      deskMaps: [],
    });

    const snapshotParentIds = () =>
      useWorkspaceStore.getState().nodes.map((n) => [n.id, n.parentId]);
    const before = snapshotParentIds();

    const result = useWorkspaceStore.getState().batchAttachConveyance([
      {
        activeNodeId: 'orphan-a',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
      {
        activeNodeId: 'does-not-exist',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.attached).toEqual([]);
    expect(result.failed).toHaveLength(1);
    // Critical: no parent IDs changed despite orphan-a being valid.
    expect(snapshotParentIds()).toEqual(before);
  });

  it('batchAttachConveyance commits all orphans when every item is valid (audit M1)', () => {
    const parent = {
      ...createBlankNode('parent', null),
      grantee: 'Common Grantor',
      instrument: 'Patent',
      interestClass: 'mineral' as const,
      initialFraction: '1.000000000',
      fraction: '1.000000000',
    };
    const orphanA = {
      ...createBlankNode('orphan-a', null),
      grantee: 'Orphan A',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    const orphanB = {
      ...createBlankNode('orphan-b', null),
      grantee: 'Orphan B',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    useWorkspaceStore.setState({
      nodes: [parent, orphanA, orphanB],
      deskMaps: [],
    });

    const result = useWorkspaceStore.getState().batchAttachConveyance([
      {
        activeNodeId: 'orphan-a',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
      {
        activeNodeId: 'orphan-b',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.attached.sort()).toEqual(['orphan-a', 'orphan-b']);
    const parentIds = Object.fromEntries(
      useWorkspaceStore.getState().nodes.map((n) => [n.id, n.parentId])
    );
    expect(parentIds['orphan-a']).toBe('parent');
    expect(parentIds['orphan-b']).toBe('parent');
  });

  it('falls back to the active desk map when deskMapId is omitted', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-active',
          name: 'Active Tract',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-active',
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-y',
      '1',
      { grantee: 'Omitted DM', instrument: 'Patent' }
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(true);
    expect(state.deskMaps[0]?.nodeIds).toEqual(['root-y']);
  });
});
