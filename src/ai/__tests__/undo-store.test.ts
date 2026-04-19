import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode } from '../../types/node';
import { useCurativeStore } from '../../store/curative-store';
import { useMapStore } from '../../store/map-store';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';

const persistenceMocks = vi.hoisted(() => ({
  exportPdfWorkspaceData: vi.fn(),
  replacePdfWorkspaceData: vi.fn(),
}));

vi.mock('../../storage/workspace-persistence', () => ({
  exportPdfWorkspaceData: persistenceMocks.exportPdfWorkspaceData,
  replacePdfWorkspaceData: persistenceMocks.replacePdfWorkspaceData,
}));

describe('AI undo snapshots', () => {
  beforeEach(() => {
    persistenceMocks.exportPdfWorkspaceData.mockReset();
    persistenceMocks.replacePdfWorkspaceData.mockReset();

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

  it('captures node PDF workspace data alongside store state', async () => {
    const { captureSnapshot } = await import('../undo-store');
    const node = {
      ...createBlankNode('node-1'),
      hasDoc: true,
      docFileName: 'instrument.pdf',
    };
    const pdfData = {
      pdfs: [
        {
          nodeId: node.id,
          fileName: 'instrument.pdf',
          mimeType: 'application/pdf',
          blob: new Blob(['pdf'], { type: 'application/pdf' }),
          createdAt: '2026-04-19T00:00:00.000Z',
        },
      ],
    };
    persistenceMocks.exportPdfWorkspaceData.mockResolvedValue(pdfData);
    useWorkspaceStore.setState({ nodes: [node] });

    const snapshot = await captureSnapshot('before AI');

    expect(persistenceMocks.exportPdfWorkspaceData).toHaveBeenCalledWith([node]);
    expect(snapshot?.pdf).toBe(pdfData);
  });
});
