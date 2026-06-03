/**
 * Phase 0.5 lazy-load contract for the map-asset side store.
 *
 * Opening a project must hand the map store asset METADATA only — never the
 * file blob bytes — so a large workspace does not pull every map image/PDF into
 * memory just to render the list and the featured-asset bookkeeping. Blob bytes
 * are fetched on demand through `getMapAssetBlob` (preview/download/render) or
 * `loadMapAssetsWithBlobs` (export / AI undo snapshot). These tests lock that
 * behavior so a future reader change cannot silently start leaking blobs into
 * project open. Mirrors `document-store-lazy.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankMapAsset, type MapAsset } from '../../types/map';

type StoredMapAsset = MapAsset & { dbKey?: string };

const ACTIVE_DB_KEY = 'user-alice';

function fakeAsset(
  id: string,
  overrides: Partial<StoredMapAsset> = {}
): StoredMapAsset {
  return {
    ...createBlankMapAsset(
      'ws-1',
      new Blob(['map-bytes'], { type: 'image/png' }),
      {
        fileName: `${id}.png`,
        mimeType: 'image/png',
        overrides: { id, ...overrides },
      }
    ),
    dbKey: ACTIVE_DB_KEY,
    ...overrides,
  };
}

function makeTable<Row extends Record<string, unknown>>(rows: Row[], pk: keyof Row) {
  const byId = new Map(rows.map((row) => [String(row[pk]), row]));
  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => rows.filter(predicate)),
  });
  return {
    get: vi.fn(async (id: string) => byId.get(id)),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) => collection((row) => {
        if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
          const [dbKey, workspaceId] = value as [string, string];
          return row.dbKey === dbKey && row.workspaceId === workspaceId;
        }
        return row[field] === value;
      }),
    })),
  };
}

async function loadStore(assets: StoredMapAsset[]) {
  vi.resetModules();
  const mapAssets = makeTable(assets as unknown as Array<Record<string, unknown>>, 'id');
  const db = {
    mapAssets,
    mapRegions: makeTable([], 'id'),
    mapExternalReferences: makeTable([], 'id'),
  };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => ACTIVE_DB_KEY,
  }));
  const mapPersistence = await import('../map-persistence');
  return { mapPersistence };
}

function hasBlob(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && 'blob' in (value as object);
}

describe('map-asset lazy-load contract', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.resetModules();
  });

  it('loadMapWorkspaceMetadata returns assets with no blob payloads', async () => {
    const { mapPersistence } = await loadStore([
      fakeAsset('map-1'),
      fakeAsset('map-2'),
    ]);

    const data = await mapPersistence.loadMapWorkspaceMetadata('ws-1');

    expect(data.mapAssets).toHaveLength(2);
    expect(data.mapAssets.some(hasBlob)).toBe(false);
    expect(data.mapAssets[0].fileName).toBe('map-1.png');
  });

  it('getMapAssetBlob returns the bytes on demand', async () => {
    const { mapPersistence } = await loadStore([fakeAsset('map-1')]);

    const blob = await mapPersistence.getMapAssetBlob('map-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(9);

    const missing = await mapPersistence.getMapAssetBlob('nope');
    expect(missing).toBeUndefined();
  });

  it('loadMapAssetsWithBlobs carries the bytes for export / undo', async () => {
    const { mapPersistence } = await loadStore([fakeAsset('map-1')]);

    const assets = await mapPersistence.loadMapAssetsWithBlobs('ws-1');
    expect(assets).toHaveLength(1);
    expect(assets[0].blob).toBeInstanceOf(Blob);
  });

  it('never exposes a Blob through the metadata project-open reader', async () => {
    const { mapPersistence } = await loadStore([
      fakeAsset('map-1'),
      fakeAsset('map-2'),
    ]);

    const data = await mapPersistence.loadMapWorkspaceMetadata('ws-1');
    for (const asset of data.mapAssets) {
      expect(asset).not.toBeInstanceOf(Blob);
      expect(hasBlob(asset)).toBe(false);
    }
  });
});
