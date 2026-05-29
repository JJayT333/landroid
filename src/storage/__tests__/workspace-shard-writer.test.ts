import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankNode, type DeskMap } from '../../types/node';
import type { WorkspaceData } from '../workspace-persistence';

const SHARD_TABLE_NAMES = [
  'workspaceManifestShards',
  'deskMapShards',
  'ownershipNodeCompatShards',
  'leaseholdStateShards',
  'workspaceUiStateShards',
] as const;

type ShardTableName = (typeof SHARD_TABLE_NAMES)[number];

interface FakeRow {
  id: string;
  workspaceId: string;
  [key: string]: unknown;
}

interface FakeTable {
  rows: Map<string, FakeRow>;
  failBulkPut: boolean;
  toArray: () => Promise<FakeRow[]>;
  put: (row: FakeRow) => Promise<void>;
  bulkPut: (rows: FakeRow[]) => Promise<void>;
  where: (field: string) => {
    equals: (value: unknown) => {
      toArray: () => Promise<FakeRow[]>;
      delete: () => Promise<void>;
    };
  };
}

function makeTable(initial: FakeRow[] = []): FakeTable {
  const table: FakeTable = {
    rows: new Map(initial.map((row) => [row.id, row])),
    failBulkPut: false,
    toArray: async () => [...table.rows.values()],
    put: async (row: FakeRow) => {
      table.rows.set(row.id, row);
    },
    bulkPut: async (rows: FakeRow[]) => {
      if (table.failBulkPut) throw new Error('simulated shard write failure');
      for (const row of rows) table.rows.set(row.id, row);
    },
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () =>
          [...table.rows.values()].filter((row) => row[field] === value),
        delete: async () => {
          for (const [key, row] of [...table.rows.entries()]) {
            if (row[field] === value) table.rows.delete(key);
          }
        },
      }),
    }),
  };
  return table;
}

function makeWriterDb(
  seed: Partial<Record<ShardTableName | 'workspaces', FakeRow[]>> = {}
) {
  const tables = {} as Record<ShardTableName, FakeTable>;
  for (const name of SHARD_TABLE_NAMES) {
    tables[name] = makeTable(seed[name] ?? []);
  }
  // The shard writer also anchors the monolithic backup row on a workspace
  // change. No prior load ran in these tests, so every write re-anchors it.
  const workspaces = makeTable(seed.workspaces ?? []);
  const snapshotNames = [...SHARD_TABLE_NAMES, 'workspaces'] as const;
  const allTables: Record<string, FakeTable> = { ...tables, workspaces };
  const db = {
    ...tables,
    workspaces,
    // Emulate Dexie transaction atomicity: snapshot every table before the
    // callback runs and restore on throw so a failed write rolls back.
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') throw new Error('missing callback');
      const snapshots = snapshotNames.map(
        (name) => new Map(allTables[name].rows)
      );
      try {
        return await callback();
      } catch (error) {
        snapshotNames.forEach((name, index) => {
          allTables[name].rows = snapshots[index];
        });
        throw error;
      }
    }),
  };
  return { db, tables, workspaces };
}

function workspaceWithContent(projectName = 'Writer Workspace'): WorkspaceData {
  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'North Unit',
    code: 'A',
    tractId: 'T-1',
    grossAcres: '160',
    pooledAcres: '120',
    description: 'North half',
    nodeIds: ['node-root'],
  };
  return {
    workspaceId: 'ws-1',
    projectName,
    nodes: [{ ...createBlankNode('node-root'), fraction: '1', initialFraction: '1' }],
    deskMaps: [deskMap],
    leaseholdUnit: undefined,
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Deed'],
  };
}

async function loadWriter(db: unknown, dbKey = 'user-alice') {
  vi.resetModules();
  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => dbKey,
    getCanvasDbKey: () => `${dbKey}-canvas`,
  }));
  vi.doMock('../db', () => ({ default: db }));
  return import('../workspace-persistence');
}

describe('saveWorkspaceShardsToDb', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('writes all five shard tables and stamps the active DB key on the manifest', async () => {
    const { db, tables } = makeWriterDb();
    const persistence = await loadWriter(db);

    const result = await persistence.saveWorkspaceShardsToDb(workspaceWithContent(), {
      ensureWritable: async () => true,
      now: () => '2026-06-01T00:00:00.000Z',
    });

    expect(result.status).toBe('written');
    const manifests = await tables.workspaceManifestShards.toArray();
    expect(manifests).toHaveLength(1);
    expect(manifests[0]).toMatchObject({ workspaceId: 'ws-1', dbKey: 'user-alice' });
    expect(manifests[0].nodeCount).toBe(1);
    expect(tables.deskMapShards.rows.size).toBe(1);
    expect(tables.ownershipNodeCompatShards.rows.size).toBe(1);
    expect(tables.leaseholdStateShards.rows.size).toBe(1);
    expect(tables.workspaceUiStateShards.rows.size).toBe(1);
  });

  it('does not write when the single-writer lease is held by another tab', async () => {
    const { db, tables } = makeWriterDb();
    const persistence = await loadWriter(db);

    const result = await persistence.saveWorkspaceShardsToDb(workspaceWithContent(), {
      ensureWritable: async () => false,
    });

    expect(result.status).toBe('blocked');
    expect(db.transaction).not.toHaveBeenCalled();
    for (const name of SHARD_TABLE_NAMES) {
      expect(tables[name].rows.size).toBe(0);
    }
  });

  it('leaves the prior complete shard set intact when a write fails mid-transaction', async () => {
    // Seed a prior complete set for ws-1, then fail the node bulkPut.
    const priorManifest: FakeRow = {
      id: 'ws-1:workspace-manifest',
      workspaceId: 'ws-1',
      shardKind: 'workspace_manifest',
      dbKey: 'user-alice',
      projectName: 'Prior Workspace',
    };
    const priorDeskMap: FakeRow = {
      id: 'ws-1:desk-map:dm-old',
      workspaceId: 'ws-1',
      shardKind: 'desk_map',
    };
    const priorNode: FakeRow = {
      id: 'ws-1:ownership-node-compat:node-old',
      workspaceId: 'ws-1',
      shardKind: 'ownership_node_compat',
    };
    const { db, tables } = makeWriterDb({
      workspaceManifestShards: [priorManifest],
      deskMapShards: [priorDeskMap],
      ownershipNodeCompatShards: [priorNode],
    });
    tables.ownershipNodeCompatShards.failBulkPut = true;
    const persistence = await loadWriter(db);

    await expect(
      persistence.saveWorkspaceShardsToDb(workspaceWithContent('Replacement'), {
        ensureWritable: async () => true,
      })
    ).rejects.toThrow(/simulated shard write failure/);

    // The transaction rolled back: the prior set survived untouched.
    expect([...tables.workspaceManifestShards.rows.values()]).toEqual([priorManifest]);
    expect([...tables.deskMapShards.rows.values()]).toEqual([priorDeskMap]);
    expect([...tables.ownershipNodeCompatShards.rows.values()]).toEqual([priorNode]);
  });
});
