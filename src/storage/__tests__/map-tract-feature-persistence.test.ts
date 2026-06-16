/**
 * DA2-M tract-feature side-store persistence. Workspace + dbKey scoping, the
 * idempotent per-asset delete, and the in-place match patch — exercised against
 * a hand-rolled Dexie table mock (mirrors map-persistence-lazy.test.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeMapTractFeature,
  type MapTractFeature,
} from '../../types/map-tract-feature';

const ACTIVE_DB_KEY = 'user-alice';

type Row = MapTractFeature & { dbKey?: string };

function feature(
  id: string,
  overrides: Partial<MapTractFeature> & { workspaceId: string; assetId: string }
): MapTractFeature {
  return normalizeMapTractFeature({
    id,
    tractKey: id,
    polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
    bbox: [0, 0, 1, 1],
    ...overrides,
  });
}

function makeTable(rows: Row[]) {
  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => rows.filter(predicate)),
    delete: vi.fn(async () => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (predicate(rows[i])) rows.splice(i, 1);
      }
    }),
  });
  return {
    rows,
    get: vi.fn(async (id: string) => rows.find((row) => row.id === id)),
    put: vi.fn(async (row: Row) => {
      const existing = rows.findIndex((r) => r.id === row.id);
      if (existing >= 0) rows[existing] = row;
      else rows.push(row);
      return row.id;
    }),
    bulkPut: vi.fn(async (newRows: Row[]) => {
      for (const row of newRows) {
        const existing = rows.findIndex((r) => r.id === row.id);
        if (existing >= 0) rows[existing] = row;
        else rows.push(row);
      }
    }),
    update: vi.fn(async (id: string, patch: Partial<Row>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    }),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) =>
        collection((row) => {
          if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
            const [dbKey, workspaceId] = value as [string, string];
            return row.dbKey === dbKey && row.workspaceId === workspaceId;
          }
          if (field === '[dbKey+workspaceId+assetId]' && Array.isArray(value)) {
            const [dbKey, workspaceId, assetId] = value as [string, string, string];
            return (
              row.dbKey === dbKey
              && row.workspaceId === workspaceId
              && row.assetId === assetId
            );
          }
          return (row as unknown as Record<string, unknown>)[field] === value;
        }),
    })),
  };
}

async function loadStore(initial: Row[] = []) {
  vi.resetModules();
  const mapTractFeatures = makeTable(initial);
  const db = {
    mapTractFeatures,
    workspaceWriteLeases: {},
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') throw new Error('transaction callback missing');
      return callback();
    }),
  };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => ACTIVE_DB_KEY,
  }));
  vi.doMock('../workspace-write-lease', () => ({
    assertWorkspaceWriteFence: vi.fn(async () => undefined),
    ensureWorkspaceWriteFence: vi.fn(async () => undefined),
  }));
  const persistence = await import('../map-tract-feature-persistence');
  return { persistence, db };
}

describe('map tract feature persistence', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../workspace-write-lease');
    vi.resetModules();
  });

  it('writes and reads back features scoped to the workspace', async () => {
    const { persistence, db } = await loadStore();
    await persistence.saveMapTractFeatures('ws-1', [
      feature('a', { workspaceId: 'ws-1', assetId: 'asset-A', matchedDeskMapId: null }),
      feature('b', { workspaceId: 'ws-1', assetId: 'asset-A' }),
    ]);

    // stored rows carry the active dbKey + a key-scoped storage id
    expect(db.mapTractFeatures.rows).toHaveLength(2);
    expect(db.mapTractFeatures.rows.every((row) => row.dbKey === ACTIVE_DB_KEY)).toBe(true);

    const loaded = await persistence.loadMapTractFeatures('ws-1');
    expect(loaded.map((f) => f.tractKey).sort()).toEqual(['a', 'b']);
    // the storage-scoped id is stripped back to the bare id on read
    expect(loaded.map((f) => f.id).sort()).toEqual(['a', 'b']);
  });

  it('an empty batch is a no-op', async () => {
    const { persistence, db } = await loadStore();
    await persistence.saveMapTractFeatures('ws-1', []);
    expect(db.mapTractFeatures.rows).toHaveLength(0);
  });

  it('deletes only the requested asset’s features', async () => {
    const { persistence } = await loadStore();
    await persistence.saveMapTractFeatures('ws-1', [
      feature('a', { workspaceId: 'ws-1', assetId: 'asset-A' }),
      feature('b', { workspaceId: 'ws-1', assetId: 'asset-B' }),
    ]);

    await persistence.deleteMapTractFeaturesForAsset('ws-1', 'asset-A');

    const loaded = await persistence.loadMapTractFeatures('ws-1');
    expect(loaded.map((f) => f.tractKey)).toEqual(['b']);
  });

  it('patches the match link in place without rewriting other fields', async () => {
    const { persistence } = await loadStore();
    await persistence.saveMapTractFeatures('ws-1', [
      feature('a', { workspaceId: 'ws-1', assetId: 'asset-A', acresText: '110 ac' }),
    ]);

    await persistence.updateMapTractFeatureFields('a', { matchedDeskMapId: 'dm-7' });

    const [loaded] = await persistence.loadMapTractFeatures('ws-1');
    expect(loaded.matchedDeskMapId).toBe('dm-7');
    expect(loaded.acresText).toBe('110 ac');
  });

  it('another workspace sees none of it', async () => {
    const { persistence } = await loadStore();
    await persistence.saveMapTractFeatures('ws-1', [
      feature('a', { workspaceId: 'ws-1', assetId: 'asset-A' }),
    ]);
    expect(await persistence.loadMapTractFeatures('ws-2')).toEqual([]);
  });
});
