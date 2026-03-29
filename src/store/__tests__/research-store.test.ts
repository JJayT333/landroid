import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankResearchImport } from '../../types/research';

const mocks = vi.hoisted(() => ({
  loadResearchWorkspaceData: vi.fn(),
  replaceResearchWorkspaceData: vi.fn(),
  saveResearchImport: vi.fn(),
  deleteResearchImport: vi.fn(),
}));

vi.mock('../../storage/research-persistence', () => ({
  loadResearchWorkspaceData: mocks.loadResearchWorkspaceData,
  replaceResearchWorkspaceData: mocks.replaceResearchWorkspaceData,
  saveResearchImport: mocks.saveResearchImport,
  deleteResearchImport: mocks.deleteResearchImport,
}));

import { useResearchStore } from '../research-store';

describe('research-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResearchStore.setState({
      workspaceId: null,
      imports: [],
      _hydrated: false,
    });
  });

  it('loads workspace-scoped research imports', async () => {
    const researchImport = createBlankResearchImport(
      'ws-a',
      new Blob(['api,data'], { type: 'text/csv' }),
      {
        fileName: 'production.csv',
        mimeType: 'text/csv',
        datasetId: 'production-data-query-dump',
        overrides: { id: 'rrc-1', title: 'Production Dump' },
      }
    );
    mocks.loadResearchWorkspaceData.mockResolvedValueOnce({
      imports: [researchImport],
    });

    await useResearchStore.getState().setWorkspace('ws-a');

    expect(useResearchStore.getState().workspaceId).toBe('ws-a');
    expect(useResearchStore.getState().imports[0]?.id).toBe('rrc-1');
  });

  it('stores imports in the active workspace and removes them cleanly', async () => {
    const researchImport = createBlankResearchImport(
      'wrong-ws',
      new Blob(['{}'], { type: 'application/json' }),
      {
        fileName: 'skim.json',
        mimeType: 'application/json',
        datasetId: 'p18-skim-report',
        overrides: { id: 'rrc-2', title: 'Skim Report' },
      }
    );
    mocks.saveResearchImport.mockResolvedValue(undefined);
    mocks.deleteResearchImport.mockResolvedValue(undefined);
    useResearchStore.setState({ workspaceId: 'ws-active' });

    await useResearchStore.getState().addImport(researchImport);

    expect(mocks.saveResearchImport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rrc-2',
        workspaceId: 'ws-active',
      })
    );
    expect(useResearchStore.getState().imports[0]?.workspaceId).toBe('ws-active');

    await useResearchStore.getState().removeImport('rrc-2');

    expect(mocks.deleteResearchImport).toHaveBeenCalledWith('rrc-2');
    expect(useResearchStore.getState().imports).toEqual([]);
  });
});
