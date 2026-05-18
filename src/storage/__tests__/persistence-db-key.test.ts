import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import type { WorkspaceData } from '../workspace-persistence';

type WorkspaceRecord = {
  id: string;
  projectName: string;
  data: string;
  savedAt: string;
};

type CanvasRecord = {
  id: string;
  data: string;
  savedAt: string;
};

function workspaceData(projectName = 'Namespaced Workspace'): WorkspaceData {
  return {
    workspaceId: 'ws-1',
    projectName,
    nodes: [],
    deskMaps: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: ['Deed'],
  };
}

function canvasData(): CanvasSaveData {
  return {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    gridCols: 4,
    gridRows: 3,
    orientation: 'landscape',
    pageSize: 'ansi-a',
    horizontalSpacingFactor: 1,
    verticalSpacingFactor: 1,
    snapToGrid: false,
    gridSize: 20,
  };
}

async function loadPersistenceWithKeys({
  workspaceKey,
  canvasKey,
  workspaceRecords = new Map<string, WorkspaceRecord>(),
  canvasRecords = new Map<string, CanvasRecord>(),
}: {
  workspaceKey: string;
  canvasKey: string;
  workspaceRecords?: Map<string, WorkspaceRecord>;
  canvasRecords?: Map<string, CanvasRecord>;
}) {
  vi.resetModules();

  const workspaces = {
    put: vi.fn(async (record: WorkspaceRecord) => {
      workspaceRecords.set(record.id, record);
    }),
    get: vi.fn(async (id: string) => workspaceRecords.get(id)),
  };
  const canvases = {
    put: vi.fn(async (record: CanvasRecord) => {
      canvasRecords.set(record.id, record);
    }),
    get: vi.fn(async (id: string) => canvasRecords.get(id)),
  };

  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => workspaceKey,
    getCanvasDbKey: () => canvasKey,
  }));
  vi.doMock('../db', () => ({
    default: {
      workspaces,
      canvases,
    },
  }));

  const workspacePersistence = await import('../workspace-persistence');
  const canvasPersistence = await import('../canvas-persistence');
  return { workspacePersistence, canvasPersistence, workspaces, canvases };
}

describe('persistence db keys (audit M-1)', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('writes workspace and canvas rows under the active per-user keys', async () => {
    const { workspacePersistence, canvasPersistence, workspaces, canvases } =
      await loadPersistenceWithKeys({
        workspaceKey: 'user-alice',
        canvasKey: 'user-alice-canvas',
      });

    await workspacePersistence.saveWorkspaceToDb(workspaceData());
    await canvasPersistence.saveCanvasToDb(canvasData());

    expect(workspaces.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-alice' })
    );
    expect(canvases.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-alice-canvas' })
    );
  });

  it('does not silently load or migrate the legacy default row for a hosted user key', async () => {
    const legacyWorkspace = workspaceData('Legacy Default Workspace');
    const workspaceRecords = new Map([
      [
        'default',
        {
          id: 'default',
          projectName: legacyWorkspace.projectName,
          data: JSON.stringify(legacyWorkspace),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence, workspaces } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(workspaces.get).toHaveBeenCalledWith('user-alice');
    expect(result.status).toBe('missing');
    expect(workspaceRecords.has('default')).toBe(true);
    expect(workspaceRecords.has('user-alice')).toBe(false);
  });

  it('loads only the current per-user workspace row when one exists', async () => {
    const currentWorkspace = workspaceData('Alice Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: currentWorkspace.projectName,
          data: JSON.stringify(currentWorkspace),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(result.status).toBe('loaded');
    expect(result.data?.projectName).toBe('Alice Workspace');
  });
});
