import { beforeEach, describe, expect, it } from 'vitest';
import { useOwnerStore } from '../../store/owner-store';
import { useUIStore } from '../../store/ui-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createBlankNode } from '../../types/node';
import { buildAIAppContext } from '../app-context';

describe('AI app context packet', () => {
  beforeEach(() => {
    useUIStore.setState({ view: 'chart' });
    useOwnerStore.setState({ owners: [], leases: [] });
    useWorkspaceStore.setState({
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
});
