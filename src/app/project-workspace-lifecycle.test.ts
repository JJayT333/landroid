import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSaveData } from '../store/canvas-store';
import type { WorkspaceData } from '../storage/workspace-persistence';

type SavedProjectSummary = {
  workspaceId: string;
  workspaceDbKey: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

function workspaceData(
  workspaceId: string,
  projectName: string
): WorkspaceData {
  return {
    workspaceId,
    projectName,
    nodes: [],
    deskMaps: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: [],
  };
}

function savedProject(
  workspaceId: string,
  workspaceDbKey: string,
  projectName: string
): SavedProjectSummary {
  return {
    workspaceId,
    workspaceDbKey,
    projectName,
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    lastOpenedAt: '2026-06-07T00:00:00.000Z',
  };
}

async function loadLifecycleHarness(options: {
  initialActiveKey?: string | null;
  existingProjects?: SavedProjectSummary[];
  replaceSideStoresImpl?: () => Promise<void>;
} = {}) {
  vi.resetModules();
  const calls: string[] = [];
  let activeWorkspaceKey: string | null =
    options.initialActiveKey ?? 'default::project::ws-active';
  const projects = new Map<string, SavedProjectSummary>(
    (options.existingProjects ?? []).map((project) => [project.workspaceId, project])
  );

  const workspaceState = {
    ...workspaceData('ws-active', 'Active Project'),
    _hydrated: true,
    loadWorkspace: vi.fn((data: WorkspaceData) => {
      calls.push(`loadWorkspace:${activeWorkspaceKey}:${data.workspaceId}`);
      Object.assign(workspaceState, data);
    }),
    hydrateNodeAttachments: vi.fn(async () => {
      calls.push(`hydrateNodeAttachments:${activeWorkspaceKey}`);
    }),
    setStartupWarning: vi.fn((message: string | null) => {
      calls.push(`setStartupWarning:${message ?? 'null'}`);
    }),
  };
  const canvasState = {
    nodes: [],
    edges: [],
    loadCanvas: vi.fn((canvas: CanvasSaveData) => {
      calls.push(`loadCanvas:${activeWorkspaceKey}:${canvas.nodes.length}`);
    }),
  };

  const saveProjectWorkspaceSnapshot = vi.fn(
    async (data: WorkspaceData, workspaceDbKey: string) => {
      calls.push(`saveProjectWorkspaceSnapshot:${workspaceDbKey}:${data.workspaceId}`);
    }
  );
  const saveProjectCanvas = vi.fn(
    async (data: CanvasSaveData, workspaceDbKey: string) => {
      calls.push(`saveProjectCanvas:${workspaceDbKey}:${data.nodes.length}`);
    }
  );
  const replaceWorkspaceSideStores = vi.fn(async (workspaceId: string) => {
    calls.push(`replaceSideStores:${activeWorkspaceKey}:${workspaceId}`);
    await (options.replaceSideStoresImpl?.() ?? Promise.resolve());
  });

  vi.doMock('../storage/active-workspace-key', () => ({
    getActiveWorkspaceStorageKey: () => activeWorkspaceKey,
    getProjectIndexDbKey: () => 'default',
    getWorkspaceDbKey: () => activeWorkspaceKey ?? 'default',
    makeProjectWorkspaceDbKey: (workspaceId: string) =>
      `default::project::${workspaceId}`,
    setActiveWorkspaceStorageKey: (dbKey: string | null) => {
      activeWorkspaceKey = dbKey;
      calls.push(`setActive:${dbKey ?? 'null'}`);
    },
  }));
  vi.doMock('../storage/saved-project-index', () => ({
    createSavedProjectIndexRecord: vi.fn(
      async (workspaceId: string, projectName: string) => {
        const project = savedProject(
          workspaceId,
          `default::project::${workspaceId}`,
          projectName
        );
        projects.set(workspaceId, project);
        return project;
      }
    ),
    getSavedProject: vi.fn(async (workspaceId: string) =>
      projects.get(workspaceId) ?? null
    ),
    getMostRecentSavedProject: vi.fn(async () => null),
    listSavedProjects: vi.fn(async () => [...projects.values()]),
    markSavedProjectOpened: vi.fn(async (workspaceId: string) =>
      projects.get(workspaceId) ?? null
    ),
    renameSavedProjectIndexRecord: vi.fn(),
    upsertSavedProjectFromWorkspace: vi.fn(
      async ({
        workspaceId,
        projectName,
        workspaceDbKey,
      }: {
        workspaceId: string;
        projectName: string;
        workspaceDbKey: string;
      }) => {
        const project = savedProject(workspaceId, workspaceDbKey, projectName);
        projects.set(workspaceId, project);
        calls.push(`upsertProject:${workspaceDbKey}:${workspaceId}`);
        return project;
      }
    ),
  }));
  vi.doMock('../storage/project-workspace-storage', () => ({
    deleteProjectStorage: vi.fn(async (project: SavedProjectSummary) => {
      calls.push(`deleteProjectStorage:${project.workspaceDbKey}`);
      projects.delete(project.workspaceId);
    }),
    duplicateProjectStorage: vi.fn(),
    loadProjectCanvas: vi.fn(async () => null),
    loadProjectWorkspace: vi.fn(async () => ({
      status: 'missing',
      data: null,
      error: null,
      warning: null,
      source: null,
    })),
    renameProjectInStorage: vi.fn(),
    saveProjectCanvas,
    saveProjectWorkspaceSnapshot,
  }));
  vi.doMock('../storage/workspace-side-store-reset', () => ({
    replaceWorkspaceSideStores,
  }));
  vi.doMock('../storage/autosave-change-detection', () => ({
    buildCanvasAutosavePayload: vi.fn(() => ({ nodes: [], edges: [] })),
    buildWorkspaceAutosavePayload: vi.fn((state: WorkspaceData) => state),
  }));
  vi.doMock('../storage/canvas-persistence', () => ({
    saveCanvasToDb: vi.fn(async () => {
      calls.push(`flushCanvas:${activeWorkspaceKey}`);
    }),
  }));
  vi.doMock('../storage/workspace-persistence', () => ({
    saveWorkspaceShardsToDb: vi.fn(async (data: WorkspaceData) => {
      calls.push(`flushWorkspace:${activeWorkspaceKey}:${data.workspaceId}`);
      return { status: 'written' };
    }),
  }));
  vi.doMock('../store/workspace-store', () => ({
    useWorkspaceStore: { getState: () => workspaceState },
    readCurrentWorkspaceData: vi.fn(() => workspaceState),
  }));
  vi.doMock('../store/canvas-store', () => ({
    useCanvasStore: { getState: () => canvasState },
  }));
  vi.doMock('../store/owner-store', () => ({
    useOwnerStore: { getState: () => ({ owners: [], leases: [], setWorkspace: vi.fn() }) },
  }));
  vi.doMock('../store/map-store', () => ({
    useMapStore: { getState: () => ({ setWorkspace: vi.fn() }) },
  }));
  vi.doMock('../store/research-store', () => ({
    useResearchStore: { getState: () => ({ setWorkspace: vi.fn() }) },
  }));
  vi.doMock('../store/curative-store', () => ({
    useCurativeStore: { getState: () => ({ setWorkspace: vi.fn() }) },
  }));
  vi.doMock('../store/title-action-log', () => ({
    flushTitleActionLogToStorage: vi.fn(async () => {
      calls.push(`flushTitle:${activeWorkspaceKey}`);
    }),
    hydrateTitleActionLogFromStorageOrBaseline: vi.fn(),
    hydrateTitleActionLogFromImportedLedger: vi.fn(async () => {
      calls.push(`hydrateImportedLedger:${activeWorkspaceKey}`);
    }),
  }));
  vi.doMock('../storage/workspace-write-lease', () => ({
    initWorkspaceWriteLease: vi.fn(async (workspaceId: string) => {
      calls.push(`reengageLease:${workspaceId}`);
      return true;
    }),
  }));
  vi.doMock('../utils/workspace-id', () => ({
    createWorkspaceId: () => 'ws-new-project',
  }));

  const module = await import('./project-workspace-lifecycle');
  return {
    module,
    calls,
    projects,
    workspaceState,
    saveProjectWorkspaceSnapshot,
    saveProjectCanvas,
    replaceWorkspaceSideStores,
    getActiveWorkspaceKey: () => activeWorkspaceKey,
  };
}

describe('project workspace lifecycle helpers', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('creates blank project data without Desk Maps or title rows', async () => {
    const { module } = await loadLifecycleHarness();

    const workspace = module.createBlankWorkspaceData('  New Lease Review  ');

    expect(workspace.projectName).toBe('New Lease Review');
    expect(workspace.workspaceId).toBe('ws-new-project');
    expect(workspace.nodes).toEqual([]);
    expect(workspace.deskMaps).toEqual([]);
    expect(workspace.activeDeskMapId).toBeNull();
    expect(workspace.instrumentTypes).toEqual([]);
  });

  it('creates and selects an imported .landroid project before side-store and snapshot writes', async () => {
    const { module, calls, saveProjectWorkspaceSnapshot } =
      await loadLifecycleHarness();
    const imported = {
      ...workspaceData('ws-imported', 'Imported Package'),
      canvas: { nodes: [], edges: [] },
      ownerData: { owners: [], leases: [], contacts: [], docs: [] },
    };

    await module.importAndOpenWorkspace(imported);

    expect(calls).toContain('setActive:default::project::ws-imported');
    expect(calls.indexOf('setActive:default::project::ws-imported')).toBeLessThan(
      calls.indexOf('replaceSideStores:default::project::ws-imported:ws-imported')
    );
    expect(calls.indexOf('replaceSideStores:default::project::ws-imported:ws-imported')).toBeLessThan(
      calls.indexOf('saveProjectWorkspaceSnapshot:default::project::ws-imported:ws-imported')
    );
    expect(saveProjectWorkspaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-imported',
        projectName: 'Imported Package',
      }),
      'default::project::ws-imported'
    );
    expect(calls).toContain('loadWorkspace:default::project::ws-imported:ws-imported');
    // DA-H2: the lifecycle owns the post-load title ledger hydration.
    expect(calls).toContain('hydrateImportedLedger:default::project::ws-imported');
  });

  it('reuses an existing saved-project storage key for repeat imports', async () => {
    const existing = savedProject(
      'ws-imported',
      'default::project::existing-import-key',
      'Old Name'
    );
    const { module, calls, projects } = await loadLifecycleHarness({
      existingProjects: [existing],
    });

    await module.importAndOpenWorkspace(
      workspaceData('ws-imported', 'Renamed Import')
    );

    expect(calls).toContain('setActive:default::project::existing-import-key');
    expect(calls).toContain(
      'replaceSideStores:default::project::existing-import-key:ws-imported'
    );
    expect(projects.get('ws-imported')).toMatchObject({
      workspaceDbKey: 'default::project::existing-import-key',
      projectName: 'Renamed Import',
    });
  });

  it('replaces an existing demo project with a fresh slot when replaceExisting is set', async () => {
    const existing = savedProject(
      'ws-imported',
      'default::project::existing-import-key',
      'Old Name'
    );
    const { module, calls } = await loadLifecycleHarness({
      existingProjects: [existing],
    });

    await module.importAndOpenWorkspace(
      workspaceData('ws-imported', 'Fresh Demo'),
      { replaceExisting: true }
    );

    // Purges the prior project, then imports into the deterministic fresh key
    // (not the old custom key), guaranteeing a pristine slot.
    expect(calls).toContain(
      'deleteProjectStorage:default::project::existing-import-key'
    );
    expect(calls).toContain('setActive:default::project::ws-imported');
    expect(calls).not.toContain('setActive:default::project::existing-import-key');
    expect(
      calls.indexOf('deleteProjectStorage:default::project::existing-import-key')
    ).toBeLessThan(calls.indexOf('setActive:default::project::ws-imported'));
  });

  it('normalizes CSV-like imports and writes a blank canvas under the imported project key', async () => {
    const { module, saveProjectWorkspaceSnapshot, saveProjectCanvas } =
      await loadLifecycleHarness();

    await module.importAndOpenWorkspace({
      workspaceId: 'ws-csv',
      projectName: 'CSV Import',
      nodes: [],
      deskMaps: [],
      activeDeskMapId: null,
      activeUnitCode: null,
    });

    expect(saveProjectWorkspaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-csv',
        instrumentTypes: [],
      }),
      'default::project::ws-csv'
    );
    expect(saveProjectCanvas).toHaveBeenCalledWith(
      { nodes: [], edges: [] },
      'default::project::ws-csv'
    );
  });

  it('restores the prior active project key if imported side-store replacement fails', async () => {
    const { module, workspaceState, getActiveWorkspaceKey } =
      await loadLifecycleHarness({
        replaceSideStoresImpl: async () => {
          throw new Error('side-store failure');
        },
      });

    await expect(
      module.importAndOpenWorkspace(workspaceData('ws-bad', 'Bad Import'))
    ).rejects.toThrow(/side-store failure/);

    expect(getActiveWorkspaceKey()).toBe('default::project::ws-active');
    expect(workspaceState.loadWorkspace).not.toHaveBeenCalled();
  });

  it('re-engages the active workspace lease after renaming a background project', async () => {
    const background = savedProject('ws-other', 'default::project::ws-other', 'Other');
    const { module, calls } = await loadLifecycleHarness({
      existingProjects: [background],
    });

    await module.renameSavedProject(background, 'Renamed Other');

    // The rename engaged ws-other's lease (singleton controller); the active
    // workspace must be re-engaged so its heartbeat/channel keep running.
    expect(calls).toContain('reengageLease:ws-active');
  });

  it('re-engages the active workspace lease after deleting a background project', async () => {
    const background = savedProject('ws-other', 'default::project::ws-other', 'Other');
    const { module, calls } = await loadLifecycleHarness({
      existingProjects: [background],
    });

    await module.deleteSavedProject(background);

    expect(calls).toContain('deleteProjectStorage:default::project::ws-other');
    expect(calls).toContain('reengageLease:ws-active');
  });
});
