import { describe, expect, it } from 'vitest';

import { buildLeaseAddTargets } from '../lease-add-targets';
import { createBlankNode } from '../../../types/node';

function mineralOwner(id: string, grantee: string, ownerId: string, fraction = '1') {
  return {
    ...createBlankNode(id),
    grantee,
    fraction,
    initialFraction: fraction,
    linkedOwnerId: ownerId,
  };
}

describe('buildLeaseAddTargets', () => {
  it('lists present mineral owners, excludes NPRI / lease / zero-interest nodes, unleased first', () => {
    const alpha = mineralOwner('n-alpha', 'Alpha', 'owner-alpha');
    const bravo = mineralOwner('n-bravo', 'Bravo', 'owner-bravo', '0.5');
    const npri = {
      ...createBlankNode('n-npri'),
      grantee: 'NPRI holder',
      fraction: '0.25',
      linkedOwnerId: 'owner-npri',
      interestClass: 'npri' as const,
    };
    const leaseChild = {
      ...createBlankNode('n-lease'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      parentId: 'n-alpha',
      linkedLeaseId: 'lease-1',
    };
    const zero = mineralOwner('n-zero', 'Zeroed', 'owner-zero', '0');

    const targets = buildLeaseAddTargets({
      deskMaps: [
        { id: 'dm1', name: 'Tract 1', nodeIds: ['n-alpha', 'n-lease', 'n-npri'] },
        { id: 'dm2', name: 'Tract 2', nodeIds: ['n-bravo', 'n-zero'] },
      ],
      nodes: [alpha, bravo, npri, leaseChild, zero],
    });

    expect(targets).toEqual([
      {
        nodeId: 'n-bravo',
        deskMapId: 'dm2',
        deskMapName: 'Tract 2',
        label: 'Bravo',
        leased: false,
      },
      {
        nodeId: 'n-alpha',
        deskMapId: 'dm1',
        deskMapName: 'Tract 1',
        label: 'Alpha',
        leased: true,
      },
    ]);
  });

  it('returns an empty list when no desk map has a present mineral owner', () => {
    expect(buildLeaseAddTargets({ deskMaps: [], nodes: [] })).toEqual([]);
  });
});
