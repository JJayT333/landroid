import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode } from '../../types/node';
import { useCurativeStore } from '../../store/curative-store';
import { useMapStore } from '../../store/map-store';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';

const persistenceMocks = vi.hoisted(() => ({
  exportDocumentWorkspaceData: vi.fn(),
  replaceDocumentWorkspaceData: vi.fn(),
}));

vi.mock('../../storage/workspace-persistence', () => ({
  exportDocumentWorkspaceData: persistenceMocks.exportDocumentWorkspaceData,
  replaceDocumentWorkspaceData: persistenceMocks.replaceDocumentWorkspaceData,
}));

describe('AI undo snapshots', () => {
  beforeEach(() => {
    persistenceMocks.exportDocumentWorkspaceData.mockReset();
    persistenceMocks.replaceDocumentWorkspaceData.mockReset();

    useWorkspaceStore.setState({
      workspaceId: 'ws-1',
      projectName: 'Undo Test',
      nodes: [],
      deskMaps: [],
      leaseholdUnit: createBlankLeaseholdUnit(),
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
      activeDeskMapId: null,
      activeNodeId: null,
    });
    useOwnerStore.setState({ owners: [], leases: [], contacts: [], docs: [] });
    useCurativeStore.setState({ titleIssues: [] });
    useMapStore.setState({ mapAssets: [], mapRegions: [], mapReferences: [] });
  });

  it('captures node document workspace data alongside store state', async () => {
    const { captureSnapshot } = await import('../undo-store');
    const node = {
      ...createBlankNode('node-1'),
      attachments: [
        {
          docId: 'doc-undo',
          attachmentId: 'att-undo',
          fileName: 'instrument.pdf',
          kind: 'deed' as const,
        },
      ],
    };
    const documentData = {
      documents: [
        {
          docId: 'doc-undo',
          workspaceId: 'ws-1',
          fileName: 'instrument.pdf',
          mimeType: 'application/pdf',
          byteLength: 3,
          contentHash: 'hash-stub',
          blob: new Blob(['pdf'], { type: 'application/pdf' }),
          kind: 'deed' as const,
          createdAt: '2026-04-19T00:00:00.000Z',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
      ],
      attachments: [
        {
          attachmentId: 'att-undo',
          docId: 'doc-undo',
          entityKind: 'node' as const,
          entityId: node.id,
          position: 0,
          createdAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    };
    persistenceMocks.exportDocumentWorkspaceData.mockResolvedValue(documentData);
    useWorkspaceStore.setState({ nodes: [node] });

    const snapshot = await captureSnapshot('before AI');

    expect(persistenceMocks.exportDocumentWorkspaceData).toHaveBeenCalledWith(
      'ws-1',
      [node]
    );
    expect(snapshot?.documents).toBe(documentData);
  });

  it('fails closed when document workspace export fails', async () => {
    const { captureSnapshot } = await import('../undo-store');
    persistenceMocks.exportDocumentWorkspaceData.mockRejectedValue(
      new Error('document export failed')
    );

    await expect(captureSnapshot('before AI')).rejects.toThrow(
      'document export failed'
    );
  });
});
