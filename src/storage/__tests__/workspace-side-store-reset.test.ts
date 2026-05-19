import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replaceOwnerWorkspaceData: vi.fn(async () => undefined),
  replaceDocumentWorkspaceData: vi.fn(async () => undefined),
  replaceMapWorkspaceData: vi.fn(async () => undefined),
  replaceResearchWorkspaceData: vi.fn(async () => undefined),
  replaceCurativeWorkspaceData: vi.fn(async () => undefined),
  clearApprovals: vi.fn(),
  clearUndo: vi.fn(),
}));

vi.mock('../../store/owner-store', () => ({
  useOwnerStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceOwnerWorkspaceData,
    }),
  },
}));

vi.mock('../../store/map-store', () => ({
  useMapStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceMapWorkspaceData,
    }),
  },
}));

vi.mock('../../store/research-store', () => ({
  useResearchStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceResearchWorkspaceData,
    }),
  },
}));

vi.mock('../../store/curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      replaceWorkspaceData: mocks.replaceCurativeWorkspaceData,
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

vi.mock('../../ai/undo-store', () => ({
  useAIUndoStore: {
    getState: () => ({
      clear: mocks.clearUndo,
    }),
  },
}));

vi.mock('../workspace-persistence', () => ({
  replaceDocumentWorkspaceData: mocks.replaceDocumentWorkspaceData,
}));

import { replaceWorkspaceSideStores } from '../workspace-side-store-reset';

describe('replaceWorkspaceSideStores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mocks.clearApprovals).toHaveBeenCalledOnce();
    expect(mocks.clearUndo).toHaveBeenCalledOnce();
  });
});
