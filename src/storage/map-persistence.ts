import db from './db';
import {
  activeDbKey,
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
  stripStorageScopedId,
} from './db-key-scope';
import {
  normalizeMapAsset,
  normalizeMapExternalReference,
  normalizeMapRegion,
  type MapAsset,
  type MapAssetMeta,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';

export interface MapWorkspaceData {
  mapAssets: MapAsset[];
  mapRegions: MapRegion[];
  mapReferences: MapExternalReference[];
}

/** Project-open shape: map assets carry metadata only, never the file blob. */
export interface MapWorkspaceMetadata {
  mapAssets: MapAssetMeta[];
  mapRegions: MapRegion[];
  mapReferences: MapExternalReference[];
}

function stripMapAssetBlob(asset: MapAsset): MapAssetMeta {
  const { blob: _blob, ...meta } = normalizeMapAsset(asset);
  return meta;
}

function stripStoredId<T extends { id: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'id');
}

async function getMapAssetRow(id: string) {
  return (await db.mapAssets.get(activeStorageScopedId(id))) ?? db.mapAssets.get(id);
}

async function getMapRegionRow(id: string) {
  return (await db.mapRegions.get(activeStorageScopedId(id))) ?? db.mapRegions.get(id);
}

async function getMapReferenceRow(id: string) {
  return (
    (await db.mapExternalReferences.get(activeStorageScopedId(id)))
    ?? db.mapExternalReferences.get(id)
  );
}

export async function loadMapWorkspaceData(
  workspaceId: string
): Promise<MapWorkspaceData> {
  const [mapAssets, mapRegions, mapReferences] = await Promise.all([
    db.mapAssets.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.mapRegions.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.mapExternalReferences.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
  ]);

  return {
    mapAssets: mapAssets.map((asset) => normalizeMapAsset(stripStoredId(asset))),
    mapRegions: mapRegions.map((region) => normalizeMapRegion(stripStoredId(region))),
    mapReferences: mapReferences.map((reference) =>
      normalizeMapExternalReference(stripStoredId(reference))
    ),
  };
}

/**
 * Metadata-first project-open reader. Identical to {@link loadMapWorkspaceData}
 * except map assets are returned blob-free so opening a project never holds
 * blob bytes. Fetch bytes on demand with {@link getMapAssetBlob}.
 */
export async function loadMapWorkspaceMetadata(
  workspaceId: string
): Promise<MapWorkspaceMetadata> {
  const [mapAssets, mapRegions, mapReferences] = await Promise.all([
    db.mapAssets.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.mapRegions.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.mapExternalReferences.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
  ]);

  return {
    mapAssets: mapAssets.map((asset) => stripMapAssetBlob(stripStoredId(asset))),
    mapRegions: mapRegions.map((region) => normalizeMapRegion(stripStoredId(region))),
    mapReferences: mapReferences.map((reference) =>
      normalizeMapExternalReference(stripStoredId(reference))
    ),
  };
}

/**
 * Read the blob-bearing map assets for a workspace. Used by `.landroid`
 * export and the AI undo snapshot, which must carry the file bytes even
 * though the in-memory store holds metadata only.
 */
export async function loadMapAssetsWithBlobs(
  workspaceId: string
): Promise<MapAsset[]> {
  const mapAssets = await db.mapAssets
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
  return mapAssets.map((asset) => normalizeMapAsset(stripStoredId(asset)));
}

/** Fetch a single map asset's file blob on demand (preview/download/render). */
export async function getMapAssetBlob(id: string): Promise<Blob | undefined> {
  const asset = await getMapAssetRow(id);
  if (!asset || asset.dbKey !== activeWorkspaceScope(asset.workspaceId)[0]) return undefined;
  return asset?.blob;
}

export async function replaceMapWorkspaceData(
  workspaceId: string,
  data: MapWorkspaceData
): Promise<void> {
  await db.transaction(
    'rw',
    db.mapAssets,
    db.mapRegions,
    db.mapExternalReferences,
    async () => {
      await Promise.all([
        db.mapAssets.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.mapRegions.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.mapExternalReferences.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
      ]);

      if (data.mapAssets.length > 0) {
        await db.mapAssets.bulkPut(
          data.mapAssets.map((asset) =>
            stampActiveDbKeyWithStorageId(
              normalizeMapAsset({ ...asset, workspaceId }),
              'id'
            )
          )
        );
      }

      if (data.mapRegions.length > 0) {
        await db.mapRegions.bulkPut(
          data.mapRegions.map((region) =>
            stampActiveDbKeyWithStorageId(
              normalizeMapRegion({ ...region, workspaceId }),
              'id'
            )
          )
        );
      }

      if (data.mapReferences.length > 0) {
        await db.mapExternalReferences.bulkPut(
          data.mapReferences.map((reference) =>
            stampActiveDbKeyWithStorageId(
              normalizeMapExternalReference({ ...reference, workspaceId }),
              'id'
            )
          )
        );
      }
    }
  );
}

export function saveMapAsset(asset: MapAsset) {
  return db.mapAssets.put(
    stampActiveDbKeyWithStorageId(normalizeMapAsset(asset), 'id')
  );
}

/**
 * Update a map asset's metadata columns in place. The stored file blob is
 * left untouched, so featured-flag toggles, link clears, and metadata edits
 * never need (and never overwrite) the bytes. Used by the metadata-first
 * store, which holds blob-free assets.
 */
export function updateMapAssetFields(id: string, fields: Partial<MapAssetMeta>) {
  const { id: _id, ...rest } = fields as Partial<MapAsset>;
  return db.transaction('rw', db.mapAssets, async () => {
    const asset = await getMapAssetRow(id);
    if (!asset || asset.dbKey !== activeWorkspaceScope(asset.workspaceId)[0]) return;
    await db.mapAssets.update(asset.id, rest);
  });
}

export function saveMapRegion(region: MapRegion) {
  return db.mapRegions.put(
    stampActiveDbKeyWithStorageId(normalizeMapRegion(region), 'id')
  );
}

export function saveMapReference(reference: MapExternalReference) {
  return db.mapExternalReferences.put(
    stampActiveDbKeyWithStorageId(normalizeMapExternalReference(reference), 'id')
  );
}

export function deleteMapAsset(id: string) {
  return db.transaction(
    'rw',
    db.mapAssets,
    db.mapRegions,
    db.mapExternalReferences,
    async () => {
      const asset = await getMapAssetRow(id);
      if (!asset || asset.dbKey !== activeWorkspaceScope(asset.workspaceId)[0]) return;
      const scope = activeWorkspaceScope(asset.workspaceId);
      const assetId = stripStorageScopedId(asset.id, asset.dbKey);
      await db.mapAssets.delete(asset.id);
      const regions = await db.mapRegions
        .where('[dbKey+workspaceId+assetId]')
        .equals([...scope, assetId])
        .toArray();
      await db.mapRegions
        .where('[dbKey+workspaceId+assetId]')
        .equals([...scope, assetId])
        .delete();
      await db.mapExternalReferences
        .where('[dbKey+workspaceId+assetId]')
        .equals([...scope, assetId])
        .delete();
      for (const region of regions) {
        const regionId = stripStorageScopedId(region.id, region.dbKey);
        await db.mapExternalReferences
          .where('[dbKey+workspaceId+regionId]')
          .equals([...scope, regionId])
          .delete();
      }
    }
  );
}

export function deleteMapRegion(id: string) {
  return db.transaction(
    'rw',
    db.mapRegions,
    db.mapExternalReferences,
    async () => {
      const region = await getMapRegionRow(id);
      if (!region || region.dbKey !== activeWorkspaceScope(region.workspaceId)[0]) return;
      const scope = activeWorkspaceScope(region.workspaceId);
      const regionId = stripStorageScopedId(region.id, region.dbKey);
      await db.mapRegions.delete(region.id);
      await db.mapExternalReferences
        .where('[dbKey+workspaceId+regionId]')
        .equals([...scope, regionId])
        .delete();
    }
  );
}

export function deleteMapReference(id: string) {
  return db.transaction('rw', db.mapExternalReferences, async () => {
    const reference = await getMapReferenceRow(id);
    if (!reference || reference.dbKey !== activeWorkspaceScope(reference.workspaceId)[0]) return;
    await db.mapExternalReferences.delete(reference.id);
  });
}

export function clearDeskMapLink(id: string) {
  const dbKey = activeDbKey();
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets
        .where('deskMapId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ deskMapId: null }),
      db.mapRegions
        .where('deskMapId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ deskMapId: null }),
    ]);
  });
}

export function clearNodeLink(id: string) {
  const dbKey = activeDbKey();
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets
        .where('nodeId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ nodeId: null }),
      db.mapRegions
        .where('nodeId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ nodeId: null }),
    ]);
  });
}

export function clearOwnerLink(id: string) {
  const dbKey = activeDbKey();
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets
        .where('linkedOwnerId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ linkedOwnerId: null }),
      db.mapRegions
        .where('linkedOwnerId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ linkedOwnerId: null }),
    ]);
  });
}

export function clearLeaseLink(id: string) {
  const dbKey = activeDbKey();
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets
        .where('leaseId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ leaseId: null }),
      db.mapRegions
        .where('leaseId')
        .equals(id)
        .filter((row) => row.dbKey === dbKey)
        .modify({ leaseId: null }),
    ]);
  });
}
