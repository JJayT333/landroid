import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode } from '../../types/node';
import { createBlankLease } from '../../types/owner';

const mocks = vi.hoisted(() => ({
  unlinkDeskMap: vi.fn(),
  unlinkNode: vi.fn(),
}));

vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkDeskMap: mocks.unlinkDeskMap,
      unlinkNode: mocks.unlinkNode,
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
});
