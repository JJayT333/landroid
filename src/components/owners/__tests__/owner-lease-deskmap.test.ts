import { describe, expect, it } from 'vitest';
import { createBlankNode, type DeskMap } from '../../../types/node';
import { getOwnerLeaseDeskMapTargets } from '../owner-lease-deskmap';

describe('owner-lease-deskmap', () => {
  it('returns linked desk map targets and marks existing lease nodes', () => {
    const nodes = [
      {
        ...createBlankNode('owner-node-a', null),
        grantee: 'Ava Moonwhistle',
        linkedOwnerId: 'owner-1',
      },
      {
        ...createBlankNode('owner-node-b', null),
        grantee: 'Ava Moonwhistle',
        linkedOwnerId: 'owner-1',
      },
      {
        ...createBlankNode('lease-node', 'owner-node-b'),
        type: 'related' as const,
        relatedKind: 'lease' as const,
        linkedOwnerId: 'owner-1',
        linkedLeaseId: 'lease-1',
      },
    ];
    const deskMaps: DeskMap[] = [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: null,
        grossAcres: '',
        pooledAcres: '',
        description: '',
        nodeIds: ['owner-node-a'],
      },
      {
        id: 'dm-2',
        name: 'Tract 2',
        code: 'T2',
        tractId: null,
        grossAcres: '',
        pooledAcres: '',
        description: '',
        nodeIds: ['owner-node-b', 'lease-node'],
      },
    ];

    expect(
      getOwnerLeaseDeskMapTargets({
        ownerId: 'owner-1',
        leaseId: 'lease-1',
        nodes,
        deskMaps,
      })
    ).toEqual([
      {
        parentNodeId: 'owner-node-b',
        parentNodeLabel: 'Ava Moonwhistle',
        deskMapId: 'dm-2',
        deskMapName: 'Tract 2',
        leaseNodeId: 'lease-node',
      },
      {
        parentNodeId: 'owner-node-a',
        parentNodeLabel: 'Ava Moonwhistle',
        deskMapId: 'dm-1',
        deskMapName: 'Tract 1',
        leaseNodeId: null,
      },
    ]);
  });
});
