import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replaceOwnerWorkspaceData: vi.fn(async () => undefined),
  replaceDocumentWorkspaceData: vi.fn(async () => undefined),
  replaceMapWorkspaceData: vi.fn(async () => undefined),
  replaceResearchWorkspaceData: vi.fn(async () => undefined),
  replaceCurativeWorkspaceData: vi.fn(async () => undefined),
  exportOwnerWorkspaceData: vi.fn(),
  exportDocumentWorkspaceData: vi.fn(),
  exportMapWorkspaceData: vi.fn(),
  exportResearchWorkspaceData: vi.fn(),
  exportCurativeWorkspaceData: vi.fn(),
  clearWorkspaceShardsForActiveKey: vi.fn(async () => undefined),
  clearApprovals: vi.fn(),
  clearActionJournal: vi.fn(),
  clearUndo: vi.fn(),
}));

vi.mock('../../store/owner-store', () => ({
  useOwnerStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceOwnerWorkspaceData,
      exportWorkspaceData: mocks.exportOwnerWorkspaceData,
    }),
  },
}));

vi.mock('../../store/map-store', () => ({
  useMapStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceMapWorkspaceData,
      exportWorkspaceData: mocks.exportMapWorkspaceData,
    }),
  },
}));

vi.mock('../../store/research-store', () => ({
  useResearchStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceResearchWorkspaceData,
      exportWorkspaceData: mocks.exportResearchWorkspaceData,
    }),
  },
}));

vi.mock('../../store/curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceCurativeWorkspaceData,
      exportWorkspaceData: mocks.exportCurativeWorkspaceData,
    }),
  },
}));

vi.mock('../../ai/approval-store', () => ({
  useAIApprovalStore: {
    getState: () => ({
      clear: mocks.clearApprovals,
    }),
  },
}));

vi.mock('../../ai/action-journal', () => ({
  useAIActionJournalStore: {
    getState: () => ({
      clear: mocks.clearActionJournal,
    }),
  },
}));

vi.mock('../../ai/undo-store', () => ({
  useAIUndoStore: {
    getState: () => ({
      clear: mocks.clearUndo,
    }),
  },
}));

vi.mock('../workspace-persistence', () => ({
  exportDocumentWorkspaceData: mocks.exportDocumentWorkspaceData,
  replaceDocumentWorkspaceData: mocks.replaceDocumentWorkspaceData,
  clearWorkspaceShardsForActiveKey: mocks.clearWorkspaceShardsForActiveKey,
}));

import {
  replaceWorkspaceSideStores,
  replaceWorkspaceSideStoresWithRollback,
} from '../workspace-side-store-reset';

describe('replaceWorkspaceSideStores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.replaceOwnerWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceDocumentWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceMapWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceResearchWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceCurativeWorkspaceData.mockResolvedValue(undefined);
  });

  it('clears every side store when no side data is supplied', async () => {
    await replaceWorkspaceSideStores('ws-reset');

    expect(mocks.replaceOwnerWorkspaceData).toHaveBeenCalledWith('ws-reset', {
      owners: [],
      leases: [],
      contacts: [],
      docs: [],
    });
    expect(mocks.replaceDocumentWorkspaceData).toHaveBeenCalledWith(
      { documents: [], attachments: [] },
      'ws-reset'
    );
    expect(mocks.replaceMapWorkspaceData).toHaveBeenCalledWith('ws-reset', {
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
    });
    expect(mocks.replaceResearchWorkspaceData).toHaveBeenCalledWith('ws-reset', {
      imports: [],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
    });
    expect(mocks.replaceCurativeWorkspaceData).toHaveBeenCalledWith('ws-reset', {
      titleIssues: [],
    });
    expect(mocks.clearWorkspaceShardsForActiveKey).toHaveBeenCalledOnce();
    expect(mocks.clearApprovals).toHaveBeenCalledOnce();
    expect(mocks.clearActionJournal).toHaveBeenCalledOnce();
    expect(mocks.clearUndo).toHaveBeenCalledOnce();
  });

  it('restores the previous active side stores when target replacement fails', async () => {
    const previousOwnerData = {
      owners: [],
      leases: [],
      contacts: [],
      docs: [],
    };
    const previousDocumentData = {
      documents: [],
      attachments: [],
    };
    const previousMapData = {
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
    };
    const previousResearchData = {
      imports: [],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
    };
    const previousCurativeData = {
      titleIssues: [],
    };
    const targetOwnerData = {
      owners: [],
      leases: [],
      contacts: [],
      docs: [],
    };

    mocks.exportOwnerWorkspaceData.mockResolvedValue(previousOwnerData);
    mocks.exportDocumentWorkspaceData.mockResolvedValue(previousDocumentData);
    mocks.exportMapWorkspaceData.mockResolvedValue(previousMapData);
    mocks.exportResearchWorkspaceData.mockResolvedValue(previousResearchData);
    mocks.exportCurativeWorkspaceData.mockResolvedValue(previousCurativeData);
    mocks.replaceDocumentWorkspaceData
      .mockRejectedValueOnce(new Error('document replace failed'))
      .mockResolvedValueOnce(undefined);

    await expect(
      replaceWorkspaceSideStoresWithRollback({
        targetWorkspaceId: 'ws-new',
        targetData: { ownerData: targetOwnerData },
        rollbackWorkspaceId: 'ws-old',
        rollbackNodes: [],
      })
    ).rejects.toThrow('document replace failed');

    expect(mocks.exportDocumentWorkspaceData).toHaveBeenCalledWith('ws-old', []);
    expect(mocks.replaceOwnerWorkspaceData).toHaveBeenCalledWith(
      'ws-new',
      targetOwnerData
    );
    expect(mocks.replaceOwnerWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousOwnerData
    );
    expect(mocks.replaceDocumentWorkspaceData).toHaveBeenCalledWith(
      previousDocumentData,
      'ws-old'
    );
    expect(mocks.replaceMapWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousMapData
    );
    expect(mocks.replaceResearchWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousResearchData
    );
    expect(mocks.replaceCurativeWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousCurativeData
    );
    expect(mocks.clearWorkspaceShardsForActiveKey).toHaveBeenCalledOnce();
    expect(mocks.clearApprovals).toHaveBeenCalledOnce();
    expect(mocks.clearActionJournal).toHaveBeenCalledOnce();
    expect(mocks.clearUndo).toHaveBeenCalledOnce();
  });
});
