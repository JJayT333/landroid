import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replaceOwnerWorkspaceData: vi.fn(
    async (_workspaceId: string, _data: unknown) => undefined
  ),
  replaceDocumentWorkspaceData: vi.fn(
    async (_data: unknown, _workspaceId: string) => undefined
  ),
  replaceMapWorkspaceData: vi.fn(
    async (_workspaceId: string, _data: unknown) => undefined
  ),
  replaceResearchWorkspaceData: vi.fn(
    async (_workspaceId: string, _data: unknown) => undefined
  ),
  replaceCurativeWorkspaceData: vi.fn(
    async (_workspaceId: string, _data: unknown) => undefined
  ),
  replaceCanvasAssetWorkspaceData: vi.fn(
    async (_workspaceId: string, _data: unknown) => undefined
  ),
  listCanvasAssets: vi.fn(async (_workspaceId: string) => [] as unknown[]),
  exportOwnerWorkspaceData: vi.fn(),
  exportDocumentWorkspaceData: vi.fn(),
  exportMapWorkspaceData: vi.fn(),
  exportResearchWorkspaceData: vi.fn(),
  exportCurativeWorkspaceData: vi.fn(),
  clearWorkspaceShardsForActiveKey: vi.fn(async () => undefined),
  clearTitleLedgerRowsForActiveKey: vi.fn(async () => undefined),
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

vi.mock('../title-ledger-persistence', () => ({
  clearTitleLedgerRowsForActiveKey: mocks.clearTitleLedgerRowsForActiveKey,
}));

vi.mock('../canvas-assets', () => ({
  listCanvasAssets: mocks.listCanvasAssets,
  replaceCanvasAssetWorkspaceData: mocks.replaceCanvasAssetWorkspaceData,
}));

import {
  replaceWorkspaceSideStores,
  replaceWorkspaceSideStoresWithRollback,
} from '../workspace-side-store-reset';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function emptyOwnerData() {
  return { owners: [], leases: [], contacts: [], docs: [] };
}

function emptyDocumentData() {
  return { documents: [], attachments: [] };
}

function emptyMapData() {
  return { mapAssets: [], mapRegions: [], mapReferences: [] };
}

function emptyResearchData() {
  return {
    imports: [],
    sources: [],
    formulas: [],
    projectRecords: [],
    questions: [],
  };
}

function emptyCurativeData() {
  return { titleIssues: [] };
}

function emptyCanvasAssetData() {
  return { assets: [] };
}

function emptySideStoreData() {
  return {
    ownerData: emptyOwnerData(),
    documentData: emptyDocumentData(),
    mapData: emptyMapData(),
    researchData: emptyResearchData(),
    curativeData: emptyCurativeData(),
    canvasAssetData: emptyCanvasAssetData(),
  };
}

type SideStoreDataFixture = ReturnType<typeof emptySideStoreData>;

function mockExportedSideStores(data: SideStoreDataFixture) {
  mocks.exportOwnerWorkspaceData.mockResolvedValue(data.ownerData);
  mocks.exportDocumentWorkspaceData.mockResolvedValue(data.documentData);
  mocks.exportMapWorkspaceData.mockResolvedValue(data.mapData);
  mocks.exportResearchWorkspaceData.mockResolvedValue(data.researchData);
  mocks.exportCurativeWorkspaceData.mockResolvedValue(data.curativeData);
  mocks.listCanvasAssets.mockResolvedValue(data.canvasAssetData.assets);
}

function expectSideStoreWrites(
  workspaceId: string,
  data: SideStoreDataFixture
) {
  expect(mocks.replaceOwnerWorkspaceData).toHaveBeenCalledWith(
    workspaceId,
    data.ownerData
  );
  expect(mocks.replaceDocumentWorkspaceData).toHaveBeenCalledWith(
    data.documentData,
    workspaceId
  );
  expect(mocks.replaceMapWorkspaceData).toHaveBeenCalledWith(
    workspaceId,
    data.mapData
  );
  expect(mocks.replaceResearchWorkspaceData).toHaveBeenCalledWith(
    workspaceId,
    data.researchData
  );
  expect(mocks.replaceCurativeWorkspaceData).toHaveBeenCalledWith(
    workspaceId,
    data.curativeData
  );
  expect(mocks.replaceCanvasAssetWorkspaceData).toHaveBeenCalledWith(
    workspaceId,
    data.canvasAssetData
  );
}

function expectFinalStoresCleared() {
  expect(mocks.clearWorkspaceShardsForActiveKey).toHaveBeenCalledOnce();
  expect(mocks.clearTitleLedgerRowsForActiveKey).toHaveBeenCalledOnce();
  expect(mocks.clearApprovals).toHaveBeenCalledOnce();
  expect(mocks.clearActionJournal).toHaveBeenCalledOnce();
  expect(mocks.clearUndo).toHaveBeenCalledOnce();
}

describe('replaceWorkspaceSideStores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.replaceOwnerWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceDocumentWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceMapWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceResearchWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceCurativeWorkspaceData.mockResolvedValue(undefined);
    mocks.replaceCanvasAssetWorkspaceData.mockResolvedValue(undefined);
    mocks.listCanvasAssets.mockResolvedValue([]);
  });

  it('clears every side store when no side data is supplied', async () => {
    await replaceWorkspaceSideStores('ws-reset');

    expect(mocks.replaceOwnerWorkspaceData).toHaveBeenCalledWith(
      'ws-reset',
      emptyOwnerData()
    );
    expect(mocks.replaceDocumentWorkspaceData).toHaveBeenCalledWith(
      emptyDocumentData(),
      'ws-reset'
    );
    expect(mocks.replaceMapWorkspaceData).toHaveBeenCalledWith(
      'ws-reset',
      emptyMapData()
    );
    expect(mocks.replaceResearchWorkspaceData).toHaveBeenCalledWith(
      'ws-reset',
      emptyResearchData()
    );
    expect(mocks.replaceCurativeWorkspaceData).toHaveBeenCalledWith(
      'ws-reset',
      emptyCurativeData()
    );
    expect(mocks.replaceCanvasAssetWorkspaceData).toHaveBeenCalledWith(
      'ws-reset',
      emptyCanvasAssetData()
    );
    expectFinalStoresCleared();
  });

  it('replaces every side store with target data and resolves on success', async () => {
    const targetData = emptySideStoreData();

    await expect(
      replaceWorkspaceSideStores('ws-target', targetData)
    ).resolves.toBeUndefined();

    expectSideStoreWrites('ws-target', targetData);
    expectFinalStoresCleared();
  });

  it('restores the previous active side stores when target replacement fails', async () => {
    const previousData = emptySideStoreData();
    const targetOwnerData = emptyOwnerData();

    mockExportedSideStores(previousData);
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
      previousData.ownerData
    );
    expect(mocks.replaceDocumentWorkspaceData).toHaveBeenCalledWith(
      previousData.documentData,
      'ws-old'
    );
    expect(mocks.replaceMapWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousData.mapData
    );
    expect(mocks.replaceResearchWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousData.researchData
    );
    expect(mocks.replaceCurativeWorkspaceData).toHaveBeenCalledWith(
      'ws-old',
      previousData.curativeData
    );
    expectFinalStoresCleared();
  });

  it('replaces every target side store through the rollback wrapper on success', async () => {
    const previousData = emptySideStoreData();
    const targetData = emptySideStoreData();

    mockExportedSideStores(previousData);

    await expect(
      replaceWorkspaceSideStoresWithRollback({
        targetWorkspaceId: 'ws-new',
        targetData,
        rollbackWorkspaceId: 'ws-old',
        rollbackNodes: [],
      })
    ).resolves.toBeUndefined();

    expectSideStoreWrites('ws-new', targetData);
    expect(mocks.replaceOwnerWorkspaceData).not.toHaveBeenCalledWith(
      'ws-old',
      previousData.ownerData
    );
    expectFinalStoresCleared();
  });

  it('waits for delayed target writes before rolling back failed imports', async () => {
    const previousData = emptySideStoreData();
    const targetData = emptySideStoreData();
    const storeState: {
      ownerData: unknown;
      documentData: unknown;
      mapData: unknown;
      researchData: unknown;
      curativeData: unknown;
    } = {
      ownerData: previousData.ownerData,
      documentData: previousData.documentData,
      mapData: previousData.mapData,
      researchData: previousData.researchData,
      curativeData: previousData.curativeData,
    };
    const events: string[] = [];
    const delayedResearchTarget = deferred<void>();

    mockExportedSideStores(previousData);

    mocks.replaceOwnerWorkspaceData.mockImplementation(async (workspaceId, data) => {
      events.push(`${workspaceId}:owner`);
      storeState.ownerData = data;
    });
    mocks.replaceDocumentWorkspaceData.mockImplementation(async (data, workspaceId) => {
      events.push(`${workspaceId}:document`);
      storeState.documentData = data;
    });
    mocks.replaceMapWorkspaceData.mockImplementation(async (workspaceId, data) => {
      events.push(`${workspaceId}:map`);
      if (workspaceId === 'ws-new') {
        throw new Error('map replace failed');
      }
      storeState.mapData = data;
    });
    mocks.replaceResearchWorkspaceData.mockImplementation(async (workspaceId, data) => {
      events.push(`${workspaceId}:research:start`);
      if (workspaceId === 'ws-new') {
        await delayedResearchTarget.promise;
      }
      storeState.researchData = data;
      events.push(`${workspaceId}:research:end`);
    });
    mocks.replaceCurativeWorkspaceData.mockImplementation(async (workspaceId, data) => {
      events.push(`${workspaceId}:curative`);
      storeState.curativeData = data;
    });

    const replace = replaceWorkspaceSideStoresWithRollback({
      targetWorkspaceId: 'ws-new',
      targetData,
      rollbackWorkspaceId: 'ws-old',
      rollbackNodes: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toContain('ws-new:research:start');
    expect(events).not.toContain('ws-old:owner');

    delayedResearchTarget.resolve();
    await expect(replace).rejects.toThrow('map replace failed');

    expect(storeState).toEqual({
      ownerData: previousData.ownerData,
      documentData: previousData.documentData,
      mapData: previousData.mapData,
      researchData: previousData.researchData,
      curativeData: previousData.curativeData,
    });
    expect(storeState.ownerData).toBe(previousData.ownerData);
    expect(storeState.documentData).toBe(previousData.documentData);
    expect(storeState.mapData).toBe(previousData.mapData);
    expect(storeState.researchData).toBe(previousData.researchData);
    expect(storeState.curativeData).toBe(previousData.curativeData);
    expect(events.indexOf('ws-new:research:end')).toBeLessThan(
      events.indexOf('ws-old:owner')
    );
    expectFinalStoresCleared();
  });
});
