import { beforeEach, describe, expect, it } from 'vitest';
import { useOwnerStore } from '../../store/owner-store';
import { useUIStore } from '../../store/ui-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createBlankNode } from '../../types/node';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import { buildAIAppContext } from '../app-context';

describe('AI app context packet', () => {
  beforeEach(() => {
    useUIStore.setState({ view: 'chart' });
    useOwnerStore.setState({ owners: [], leases: [] });
    useWorkspaceStore.setState({
      workspaceId: 'ws-ai-context',
      projectName: 'Truncation Test',
      activeDeskMapId: 'dm-1',
      activeUnitCode: null,
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: [],
        },
      ],
      nodes: [],
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
    });
  });

  it('surfaces when visible Desk Map cards are omitted from compact context', () => {
    const nodes = Array.from({ length: 42 }, (_, index) => ({
      ...createBlankNode(`node-${index + 1}`),
      grantor: `Grantor ${index + 1}`,
      grantee: `Grantee ${index + 1}`,
      fraction: '1/42',
      initialFraction: '1/42',
    }));
    const deskMap = useWorkspaceStore.getState().deskMaps[0];
    expect(deskMap).toBeDefined();
    useWorkspaceStore.setState({
      nodes,
      deskMaps: [
        {
          ...deskMap!,
          nodeIds: nodes.map((node) => node.id),
        },
      ],
    });

    const context = buildAIAppContext();

    expect(context).toContain('Visible Desk Map cards: 42');
    expect(context.match(/^- Conveyance:/gm)).toHaveLength(40);
    expect(context).toContain(
      '- 2 additional cards omitted from this compact context packet.'
    );
  });

  it('builds hosted minimal context from counts without sensitive project details', () => {
    const node = {
      ...createBlankNode('node-sensitive'),
      grantor: 'Front State of Texas',
      grantee: 'P. T. Broncus',
      docNo: '1473-01-15',
      remarks: 'Sensitive remarks',
      fraction: '1/2',
      initialFraction: '1/2',
    };
    const deskMap = useWorkspaceStore.getState().deskMaps[0];
    expect(deskMap).toBeDefined();
    useWorkspaceStore.setState({
      projectName: 'Vulcan Mesa - Demo',
      nodes: [node],
      deskMaps: [
        {
          ...deskMap!,
          name: 'Apollo Draw',
          code: 'VM1',
          unitName: 'Jupiter Flats Unit',
          unitCode: 'JFU',
          nodeIds: [node.id],
        },
      ],
    });

    const context = buildAIAppContext('minimal');

    expect(context).toContain('Read-only LANDroid app context (minimal)');
    expect(context).toContain('Workspace counts: 1 tract map, 1 title card');
    expect(context).toContain('Visible card counts: 1 total');
    expect(context).not.toContain('Vulcan Mesa');
    expect(context).not.toContain('Apollo Draw');
    expect(context).not.toContain('VM1');
    expect(context).not.toContain('Jupiter Flats');
    expect(context).not.toContain('Front State of Texas');
    expect(context).not.toContain('P. T. Broncus');
    expect(context).not.toContain('1473-01-15');
    expect(context).not.toContain('Sensitive remarks');
    expect(context).not.toContain('1/2');
    expect(context).not.toContain('node-sensitive');
  });

  it('adds bounded full-context rollups for all tracts, not just the active tract', () => {
    seedTwoTractProject();
    useWorkspaceStore.setState({ activeDeskMapId: 'dm-1' });

    const context = buildAIAppContext('full');

    expect(context).toContain('Whole-project structured summary:');
    expect(context).toContain('Tract maps: 2; title cards: 3');
    expect(context).toContain('All-tract rollups:');
    expect(context).toContain('VM1 - Apollo Draw');
    expect(context).toContain('VM2 - Zeus Ridge');
    expect(context).toContain('lessees Zeus Ridge Energy LLC');
    expect(context).toContain('Visible Desk Map cards: 1');
    expect(context).not.toContain('Zeus Hidden Owner');
  });

  it('keeps hosted minimal all-tract summary to counts and structure only', () => {
    seedTwoTractProject();

    const context = buildAIAppContext('minimal');

    expect(context).toContain('Whole-project structure (counts only):');
    expect(context).toContain('All-tract structure (counts only):');
    expect(context).toContain('Tract maps: 2; title cards: 3');
    expect(context).toContain(
      '- Tract 2: 2 title cards; 1 conveyance; 0 NPRI; 1 related lease'
    );
    expect(context).not.toContain('Cross-Tract Privacy Demo');
    expect(context).not.toContain('Apollo Draw');
    expect(context).not.toContain('Zeus Ridge');
    expect(context).not.toContain('Zeus Hidden Owner');
    expect(context).not.toContain('Zeus Ridge Energy LLC');
    expect(context).not.toContain('Zeus Ridge Lease');
    expect(context).not.toContain('1/2');
    expect(context).not.toContain('1/5');
    expect(context).not.toContain('320');
    expect(context).not.toContain('JFU');
  });
});

function seedTwoTractProject(): void {
  const activeOwner = createBlankOwner('ws-ai-context', {
    id: 'owner-1',
    name: 'Apollo Minerals LLC',
  });
  const hiddenOwner = createBlankOwner('ws-ai-context', {
    id: 'owner-2',
    name: 'Zeus Minerals LLC',
  });
  const hiddenLease = createBlankLease('ws-ai-context', hiddenOwner.id, {
    id: 'lease-2',
    leaseName: 'Zeus Ridge Lease',
    lessee: 'Zeus Ridge Energy LLC',
    royaltyRate: '1/5',
    leasedInterest: '1/2',
  });
  const activeNode = {
    ...createBlankNode('node-active'),
    grantor: 'State of Texas',
    grantee: 'Apollo Visible Owner',
    fraction: '1',
    initialFraction: '1',
    linkedOwnerId: activeOwner.id,
  };
  const hiddenNode = {
    ...createBlankNode('node-hidden'),
    grantor: 'State of Texas',
    grantee: 'Zeus Hidden Owner',
    fraction: '0.5',
    initialFraction: '0.5',
    linkedOwnerId: hiddenOwner.id,
  };
  const hiddenLeaseNode = {
    ...createBlankNode('node-hidden-lease'),
    type: 'related' as const,
    relatedKind: 'lease' as const,
    grantor: 'Zeus Hidden Owner',
    grantee: 'Zeus Ridge Energy LLC',
    instrument: 'Oil & Gas Lease',
    fraction: '0',
    initialFraction: '0',
    parentId: hiddenNode.id,
    linkedLeaseId: hiddenLease.id,
  };

  useOwnerStore.setState({
    owners: [activeOwner, hiddenOwner],
    leases: [hiddenLease],
  });
  useWorkspaceStore.setState({
    workspaceId: 'ws-ai-context',
    projectName: 'Cross-Tract Privacy Demo',
    activeDeskMapId: 'dm-1',
    activeUnitCode: 'JFU',
    nodes: [activeNode, hiddenNode, hiddenLeaseNode],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Apollo Draw',
        code: 'VM1',
        tractId: 'tract-1',
        grossAcres: '160',
        pooledAcres: '160',
        description: '',
        unitName: 'Jupiter Flats Unit',
        unitCode: 'JFU',
        nodeIds: [activeNode.id],
      },
      {
        id: 'dm-2',
        name: 'Zeus Ridge',
        code: 'VM2',
        tractId: 'tract-2',
        grossAcres: '320',
        pooledAcres: '160',
        description: '',
        unitName: 'Jupiter Flats Unit',
        unitCode: 'JFU',
        nodeIds: [hiddenNode.id, hiddenLeaseNode.id],
      },
    ],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
  });
}
