import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createBlankNode, type DeskMap } from '../../types/node';
import {
  approveAIProposal,
  queueAIApprovalProposal,
  registerAIMutationExecutor,
  useAIApprovalStore,
} from '../approval-store';

const persistenceMocks = vi.hoisted(() => ({
  exportDocumentWorkspaceData: vi.fn(async () => ({
    documents: [],
    attachments: [],
  })),
  replaceDocumentWorkspaceData: vi.fn(async () => undefined),
}));

vi.mock('../../storage/workspace-persistence', () => ({
  exportDocumentWorkspaceData: persistenceMocks.exportDocumentWorkspaceData,
  replaceDocumentWorkspaceData: persistenceMocks.replaceDocumentWorkspaceData,
}));

function deskMap(overrides: Partial<DeskMap> = {}): DeskMap {
  return {
    id: 'dm-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: null,
    grossAcres: '100',
    pooledAcres: '100',
    description: '',
    nodeIds: ['root'],
    ...overrides,
  };
}

function rootNode() {
  return {
    ...createBlankNode('root'),
    grantee: 'Root Owner',
    fraction: '1',
    initialFraction: '1',
  };
}

function seedWorkspaceWithRoot() {
  useWorkspaceStore.setState({
    workspaceId: 'ws-1',
    projectName: 'Approval Store Test',
    deskMaps: [deskMap()],
    nodes: [rootNode()],
    activeDeskMapId: 'dm-1',
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
  });
}

describe('AI approval store — live preview refresh (DA-M12)', () => {
  beforeEach(() => {
    useAIApprovalStore.getState().clear();
    seedWorkspaceWithRoot();
  });

  it('recomputes queued proposal previews from current workspace state', () => {
    const queued = queueAIApprovalProposal(
      'deleteNode',
      { nodeId: 'root' },
      'Delete leaf root'
    );
    const before = useAIApprovalStore
      .getState()
      .proposals.find((p) => p.id === queued.proposalId);
    expect(before?.preview.canApprove).toBe(true);

    // The user edits the graph after queuing: the parent node is gone.
    useWorkspaceStore.setState({ nodes: [], deskMaps: [deskMap({ nodeIds: [] })] });
    useAIApprovalStore.getState().refreshPreviews();

    const after = useAIApprovalStore
      .getState()
      .proposals.find((p) => p.id === queued.proposalId);
    expect(after?.preview.canApprove).toBe(false);
    expect(after?.preview.validation.status).toBe('blocked');
  });
});

describe('AI approval store — re-assert before execute (DA-M12)', () => {
  beforeEach(() => {
    useAIApprovalStore.getState().clear();
    seedWorkspaceWithRoot();
  });

  it('re-checks applicability against current state and skips a now-invalid mutation', async () => {
    const executor = vi.fn(async () => ({ ok: true }));
    registerAIMutationExecutor('deleteNode', executor);

    const queued = queueAIApprovalProposal(
      'deleteNode',
      { nodeId: 'root' },
      'Delete leaf root'
    );

    // State changes after the card was shown, making the proposal inapplicable.
    useWorkspaceStore.setState({ nodes: [], deskMaps: [deskMap({ nodeIds: [] })] });

    await expect(approveAIProposal(queued.proposalId)).rejects.toThrow(
      /cannot be approved/
    );
    expect(executor).not.toHaveBeenCalled();
  });
});
