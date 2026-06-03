import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import {
  LANDROID_FILE_VERSION,
  type WorkspaceData,
} from '../workspace-persistence';
import { buildWorkspaceShards, type WorkspaceShardSet } from '../workspace-shards';

type WorkspaceRecord = {
  id: string;
  projectName: string;
  data: string;
  savedAt: string;
};

type ShardRow = {
  id: string;
  workspaceId: string;
  dbKey?: string;
};

type CanvasRecord = {
  id: string;
  data: string;
  savedAt: string;
};

type WorkspaceWriteLeaseRecord = {
  workspaceId: string;
  ownerTabId: string;
  heartbeatAt: number;
  expiresAt: number;
  fencingToken: number;
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

// A small in-memory Dexie table double that supports the read/write surface
// the shard reader and shard writer touch: toArray, get, put, bulkPut, and
// where(field).equals(value).{toArray,delete}.
function makeShardTable<Row extends ShardRow>(initial: Row[] = []) {
  const rows = new Map<string, Row>();
  for (const row of initial) rows.set(row.id, row);

  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => [...rows.values()].filter(predicate)),
    delete: vi.fn(async () => {
      for (const [key, row] of [...rows.entries()]) {
        if (predicate(row)) rows.delete(key);
      }
    }),
  });

  return {
    rows,
    toArray: vi.fn(async () => [...rows.values()]),
    get: vi.fn(async (id: string) => rows.get(id)),
    put: vi.fn(async (row: Row) => {
      rows.set(row.id, row);
    }),
    bulkPut: vi.fn(async (newRows: Row[]) => {
      for (const row of newRows) rows.set(row.id, row);
    }),
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) =>
        collection(
          (row) => {
            if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
              const [dbKey, workspaceId] = value as [string, string];
              return row.dbKey === dbKey && row.workspaceId === workspaceId;
            }
            return (row as unknown as Record<string, unknown>)[field] === value;
          }
        )
      ),
    })),
  };
}

function shardRowsFromWorkspace(
  workspace: WorkspaceData,
  savedAt = '2026-04-25T00:00:00.000Z',
  dbKey = 'user-alice'
): WorkspaceShardSet {
  const shards = buildWorkspaceShards(workspace, {
    lastModified: savedAt,
    landroidFileVersion: LANDROID_FILE_VERSION,
    source: 'migration',
    syncState: 'local_only',
    legacyWorkspaceDataJson: JSON.stringify(workspace),
  });
  return {
    manifest: { ...shards.manifest, dbKey },
    deskMaps: shards.deskMaps.map((row) => ({ ...row, dbKey })),
    nodes: shards.nodes.map((row) => ({ ...row, dbKey })),
    leaseholdState: { ...shards.leaseholdState, dbKey },
    uiState: { ...shards.uiState, dbKey },
  };
}

async function loadPersistenceWithKeys({
  workspaceKey,
  canvasKey,
  workspaceRecords = new Map<string, WorkspaceRecord>(),
  canvasRecords = new Map<string, CanvasRecord>(),
  shards,
}: {
  workspaceKey: string;
  canvasKey: string;
  workspaceRecords?: Map<string, WorkspaceRecord>;
  canvasRecords?: Map<string, CanvasRecord>;
  shards?: WorkspaceShardSet | {
    manifest?: WorkspaceShardSet['manifest'] | null;
    deskMaps?: WorkspaceShardSet['deskMaps'];
    nodes?: WorkspaceShardSet['nodes'];
    leaseholdState?: WorkspaceShardSet['leaseholdState'] | null;
    uiState?: WorkspaceShardSet['uiState'] | null;
  };
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
  const workspaceWriteLeaseRows = new Map<string, WorkspaceWriteLeaseRecord>();
  const workspaceWriteLeases = {
    get: vi.fn(async (workspaceId: string) =>
      workspaceWriteLeaseRows.get(workspaceId)
    ),
    put: vi.fn(async (lease: WorkspaceWriteLeaseRecord) => {
      workspaceWriteLeaseRows.set(lease.workspaceId, lease);
    }),
    delete: vi.fn(async (workspaceId: string) => {
      workspaceWriteLeaseRows.delete(workspaceId);
    }),
  };

  const db = {
    workspaces,
    canvases,
    workspaceWriteLeases,
    workspaceManifestShards: makeShardTable(
      shards?.manifest ? [shards.manifest] : []
    ),
    deskMapShards: makeShardTable(shards?.deskMaps ?? []),
    ownershipNodeCompatShards: makeShardTable(shards?.nodes ?? []),
    leaseholdStateShards: makeShardTable(
      shards?.leaseholdState ? [shards.leaseholdState] : []
    ),
    workspaceUiStateShards: makeShardTable(
      shards?.uiState ? [shards.uiState] : []
    ),
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') {
        throw new Error('transaction callback missing');
      }
      return callback();
    }),
  };

  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => workspaceKey,
    getCanvasDbKey: () => canvasKey,
  }));
  vi.doMock('../db', () => ({ default: db }));

  const workspacePersistence = await import('../workspace-persistence');
  const canvasPersistence = await import('../canvas-persistence');
  return { workspacePersistence, canvasPersistence, db, workspaces, canvases };
}

const ALWAYS_WRITABLE = { ensureWritable: async () => true };

describe('persistence db keys (audit M-1)', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('writes workspace shard rows and the canvas row under the active per-user keys', async () => {
    const { workspacePersistence, canvasPersistence, db, canvases } =
      await loadPersistenceWithKeys({
        workspaceKey: 'user-alice',
        canvasKey: 'user-alice-canvas',
      });

    const result = await workspacePersistence.saveWorkspaceShardsToDb(
      workspaceData(),
      ALWAYS_WRITABLE
    );
    await canvasPersistence.saveCanvasToDb(canvasData(), 'ws-1');

    expect(result.status).toBe('written');
    const manifests = await db.workspaceManifestShards.toArray();
    expect(manifests).toHaveLength(1);
    expect(manifests[0]).toEqual(
      expect.objectContaining({ workspaceId: 'ws-1', dbKey: 'user-alice' })
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
    expect(result.source).toBe('monolith');
  });

  it('prefers a newer monolith over stale shards instead of stranding the edit', async () => {
    // Post-fix recency contract. Before the shard writer landed, the reader
    // preferred complete shards unconditionally — so a newer monolith (the only
    // copy autosave updated) was silently discarded on reload. The reader must
    // now keep the newer copy.
    const monolithWorkspace = workspaceData('Newer Monolith Workspace');
    const shardWorkspace = workspaceData('Stale Sharded Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: monolithWorkspace.projectName,
          data: JSON.stringify(monolithWorkspace),
          savedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: shardRowsFromWorkspace(shardWorkspace, '2026-04-25T00:00:00.000Z'),
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(result.status).toBe('loaded');
    expect(result.source).toBe('monolith');
    expect(result.warning).toMatch(/older than the preserved monolithic/);
    expect(result.data?.projectName).toBe('Newer Monolith Workspace');
  });

  it('loads complete shard rows when they are at least as fresh as the monolith', async () => {
    const monolithWorkspace = workspaceData('Alice Monolith Workspace');
    const shardWorkspace = workspaceData('Alice Sharded Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: monolithWorkspace.projectName,
          data: JSON.stringify(monolithWorkspace),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: shardRowsFromWorkspace(shardWorkspace, '2026-05-10T00:00:00.000Z'),
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(result.status).toBe('loaded');
    expect(result.source).toBe('shards');
    expect(result.warning).toBeNull();
    expect(result.data?.projectName).toBe('Alice Sharded Workspace');
  });

  it('falls back to the monolith with a warning when active workspace shards are incomplete', async () => {
    const workspace = workspaceData('Alice Monolith Workspace');
    const shards = shardRowsFromWorkspace(workspace);
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: workspace.projectName,
          data: JSON.stringify(workspace),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: {
        ...shards,
        uiState: null,
      },
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(result.status).toBe('loaded');
    expect(result.source).toBe('monolith');
    expect(result.warning).toMatch(/workspace UI state shard is missing/);
    expect(result.data?.projectName).toBe('Alice Monolith Workspace');
  });

  it('surfaces a fresh hosted user as missing instead of adopting another user\'s shards (Bug 001)', async () => {
    // Alice has saved shards stamped with her own DB key. Bob signs in on the
    // same browser profile with no monolith of his own. The reader must not
    // hand Bob the only manifest in the table.
    const aliceWorkspace = workspaceData('Alice Private Workspace');
    const aliceShards = shardRowsFromWorkspace(aliceWorkspace);
    aliceShards.manifest.dbKey = 'user-alice';
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: aliceWorkspace.projectName,
          data: JSON.stringify(aliceWorkspace),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-bob',
      canvasKey: 'user-bob-canvas',
      workspaceRecords,
      shards: aliceShards,
    });

    const result = await workspacePersistence.loadWorkspaceFromDb();

    expect(result.status).toBe('missing');
    expect(result.data).toBeNull();
  });

  it('keeps a post-migration edit on reload (v9->v10 regression)', async () => {
    // Simulate a v9->v10 migrated workspace: a frozen monolith plus migration
    // -time shards (no dbKey) that match the monolith. After an edit is
    // autosaved through the shard writer, reload must return the edit.
    const migrated = workspaceData('Migrated Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: migrated.projectName,
          data: JSON.stringify(migrated),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: shardRowsFromWorkspace(migrated, '2026-04-25T00:00:00.000Z'),
    });

    const initial = await workspacePersistence.loadWorkspaceFromDb();
    expect(initial.status).toBe('loaded');
    expect(initial.data?.projectName).toBe('Migrated Workspace');

    const edited = { ...migrated, projectName: 'Edited Workspace' };
    const writeResult = await workspacePersistence.saveWorkspaceShardsToDb(edited, {
      ensureWritable: async () => true,
      now: () => '2026-06-01T00:00:00.000Z',
    });
    expect(writeResult.status).toBe('written');

    const reloaded = await workspacePersistence.loadWorkspaceFromDb();
    expect(reloaded.status).toBe('loaded');
    expect(reloaded.source).toBe('shards');
    expect(reloaded.data?.projectName).toBe('Edited Workspace');
  });

  it('leaves the migration backup untouched when the same workspace is edited', async () => {
    const migrated = workspaceData('Original Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: migrated.projectName,
          data: JSON.stringify(migrated),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: shardRowsFromWorkspace(migrated, '2026-04-25T00:00:00.000Z'),
    });

    await workspacePersistence.loadWorkspaceFromDb();
    await workspacePersistence.saveWorkspaceShardsToDb(
      { ...migrated, projectName: 'Edited In Place' },
      { ensureWritable: async () => true, now: () => '2026-06-01T00:00:00.000Z' }
    );

    // Same workspace id -> the frozen migration backup is not rewritten.
    const monolith = workspaceRecords.get('user-alice')!;
    expect(monolith.savedAt).toBe('2026-04-25T00:00:00.000Z');
    expect(JSON.parse(monolith.data).projectName).toBe('Original Workspace');
  });

  it('re-anchors the monolith to an imported workspace and falls back to it, not the pre-import one', async () => {
    const original = workspaceData('Original Workspace');
    const workspaceRecords = new Map([
      [
        'user-alice',
        {
          id: 'user-alice',
          projectName: original.projectName,
          data: JSON.stringify(original),
          savedAt: '2026-04-25T00:00:00.000Z',
        },
      ],
    ]);
    const { workspacePersistence, db } = await loadPersistenceWithKeys({
      workspaceKey: 'user-alice',
      canvasKey: 'user-alice-canvas',
      workspaceRecords,
      shards: shardRowsFromWorkspace(original, '2026-04-25T00:00:00.000Z'),
    });

    await workspacePersistence.loadWorkspaceFromDb();

    // Import replaces the active workspace (different workspaceId).
    const imported = { ...workspaceData('Imported Workspace'), workspaceId: 'ws-imported' };
    await workspacePersistence.saveWorkspaceShardsToDb(imported, {
      ensureWritable: async () => true,
      now: () => '2026-06-01T00:00:00.000Z',
    });

    // The backup row now describes the imported workspace, not the old one.
    const monolith = workspaceRecords.get('user-alice')!;
    expect(JSON.parse(monolith.data).workspaceId).toBe('ws-imported');

    // Force the imported shard set to be incomplete, then reload: the fallback
    // must land on the imported workspace, never the stale pre-import one.
    db.workspaceUiStateShards.rows.clear();
    const reloaded = await workspacePersistence.loadWorkspaceFromDb();
    expect(reloaded.status).toBe('loaded');
    expect(reloaded.source).toBe('monolith');
    expect(reloaded.data?.projectName).toBe('Imported Workspace');
  });
});
