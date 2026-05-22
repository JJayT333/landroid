import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createBlankNode, type DeskMap } from '../../types/node';
import { createBlankOwner } from '../../types/owner';
import { landroidTools } from '../tools';
import { approveAIProposal, useAIApprovalStore } from '../approval-store';
import { buildAIApprovalPreview } from '../approval-preview';
import { useAIUndoStore } from '../undo-store';

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
    nodeIds: [],
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

async function runTool<Tool extends { execute?: (...args: never[]) => unknown }>(
  tool: Tool,
  args: unknown
): Promise<any> {
  const exec = tool.execute as (a: unknown, o: unknown) => Promise<unknown>;
  return await exec(args, {} as never);
}

describe('AI approval previews', () => {
  beforeEach(() => {
    persistenceMocks.exportDocumentWorkspaceData.mockResolvedValue({
      documents: [],
      attachments: [],
    });
    persistenceMocks.replaceDocumentWorkspaceData.mockResolvedValue(undefined);
    useWorkspaceStore.setState({
      workspaceId: 'ws-1',
      projectName: 'Preview Test',
      deskMaps: [deskMap({ nodeIds: ['root'] })],
      nodes: [rootNode()],
      activeDeskMapId: 'dm-1',
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
    });
    useOwnerStore.setState({ owners: [], leases: [] });
    useAIApprovalStore.getState().clear();
    useAIUndoStore.getState().clear();
  });

  it('simulates conveyance before approval without mutating the workspace', () => {
    const preview = buildAIApprovalPreview('convey', {
      parentNodeId: 'root',
      share: '0.25',
      form: { grantee: 'Child Owner' },
    });

    expect(preview.canApprove).toBe(true);
    expect(preview.validation).toMatchObject({
      status: 'valid',
      issueCount: 0,
    });
    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Parent remaining',
          before: '1',
          after: '0.750000000',
        }),
        expect.objectContaining({
          label: 'New child initial',
          before: 'none',
          after: '0.25',
        }),
      ])
    );
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);
  });

  it('blocks approval when the previewed title move would fail', async () => {
    const queued = await runTool(landroidTools.convey, {
      parentNodeId: 'root',
      share: '2',
      form: { grantee: 'Impossible Child' },
    });

    expect(queued).toMatchObject({
      ok: true,
      approvalRequired: true,
      proposalId: expect.any(String),
    });
    const proposal = useAIApprovalStore.getState().proposals[0];
    expect(proposal.preview).toMatchObject({
      canApprove: false,
      validation: {
        status: 'blocked',
        message: expect.stringContaining('share exceeds parent remaining fraction'),
      },
    });

    await expect(approveAIProposal(queued.proposalId)).rejects.toThrow(
      /cannot be approved/
    );
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);
    expect(useAIUndoStore.getState().snapshot).toBeNull();
  });

  it('previews non-graph owner and lease proposals with typed blockers', () => {
    const owner = {
      ...createBlankOwner('ws-1'),
      id: 'owner-1',
      name: 'Owner One',
    };
    useOwnerStore.setState({ owners: [owner], leases: [] });

    const ownerPreview = buildAIApprovalPreview('createOwner', {
      name: 'New Owner',
      county: 'Reeves',
    });
    expect(ownerPreview).toMatchObject({
      canApprove: true,
      validation: {
        status: 'not_applicable',
        message: expect.stringContaining('Owner records do not change'),
      },
    });

    const leasePreview = buildAIApprovalPreview('createLease', {
      ownerId: 'owner-1',
      royaltyRate: 'not a fraction',
    });
    expect(leasePreview).toMatchObject({
      canApprove: false,
      validation: {
        status: 'blocked',
        message: expect.stringContaining('Royalty rate'),
      },
    });
  });
});
