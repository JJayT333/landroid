import db from './db';
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

export async function loadMapWorkspaceData(
  workspaceId: string
): Promise<MapWorkspaceData> {
  const [mapAssets, mapRegions, mapReferences] = await Promise.all([
    db.mapAssets.where('workspaceId').equals(workspaceId).toArray(),
    db.mapRegions.where('workspaceId').equals(workspaceId).toArray(),
    db.mapExternalReferences.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return {
    mapAssets: mapAssets.map((asset) => normalizeMapAsset(asset)),
    mapRegions: mapRegions.map((region) => normalizeMapRegion(region)),
    mapReferences: mapReferences.map((reference) =>
      normalizeMapExternalReference(reference)
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
    db.mapAssets.where('workspaceId').equals(workspaceId).toArray(),
    db.mapRegions.where('workspaceId').equals(workspaceId).toArray(),
    db.mapExternalReferences.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return {
    mapAssets: mapAssets.map(stripMapAssetBlob),
    mapRegions: mapRegions.map((region) => normalizeMapRegion(region)),
    mapReferences: mapReferences.map((reference) =>
      normalizeMapExternalReference(reference)
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
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();
  return mapAssets.map((asset) => normalizeMapAsset(asset));
}

/** Fetch a single map asset's file blob on demand (preview/download/render). */
export async function getMapAssetBlob(id: string): Promise<Blob | undefined> {
  const asset = await db.mapAssets.get(id);
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
        db.mapAssets.where('workspaceId').equals(workspaceId).delete(),
        db.mapRegions.where('workspaceId').equals(workspaceId).delete(),
        db.mapExternalReferences.where('workspaceId').equals(workspaceId).delete(),
      ]);

      if (data.mapAssets.length > 0) {
        await db.mapAssets.bulkPut(
          data.mapAssets.map((asset) =>
            normalizeMapAsset({ ...asset, workspaceId })
          )
        );
      }

      if (data.mapRegions.length > 0) {
        await db.mapRegions.bulkPut(
          data.mapRegions.map((region) =>
            normalizeMapRegion({ ...region, workspaceId })
          )
        );
      }

      if (data.mapReferences.length > 0) {
        await db.mapExternalReferences.bulkPut(
          data.mapReferences.map((reference) =>
            normalizeMapExternalReference({ ...reference, workspaceId })
          )
        );
      }
    }
  );
}

export function saveMapAsset(asset: MapAsset) {
  return db.mapAssets.put(normalizeMapAsset(asset));
}

/**
 * Update a map asset's metadata columns in place. The stored file blob is
 * left untouched, so featured-flag toggles, link clears, and metadata edits
 * never need (and never overwrite) the bytes. Used by the metadata-first
 * store, which holds blob-free assets.
 */
export function updateMapAssetFields(id: string, fields: Partial<MapAssetMeta>) {
  const { id: _id, ...rest } = fields as Partial<MapAsset>;
  return db.mapAssets.update(id, rest);
}

export function saveMapRegion(region: MapRegion) {
  return db.mapRegions.put(normalizeMapRegion(region));
}

export function saveMapReference(reference: MapExternalReference) {
  return db.mapExternalReferences.put(normalizeMapExternalReference(reference));
}

export function deleteMapAsset(id: string) {
  return db.transaction(
    'rw',
    db.mapAssets,
    db.mapRegions,
    db.mapExternalReferences,
    async () => {
      await db.mapAssets.delete(id);
      const regionIds = await db.mapRegions.where('assetId').equals(id).primaryKeys();
      await db.mapRegions.where('assetId').equals(id).delete();
      await db.mapExternalReferences.where('assetId').equals(id).delete();
      for (const regionId of regionIds) {
        await db.mapExternalReferences.where('regionId').equals(String(regionId)).delete();
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
      await db.mapRegions.delete(id);
      await db.mapExternalReferences.where('regionId').equals(id).delete();
    }
  );
}

export function deleteMapReference(id: string) {
  return db.mapExternalReferences.delete(id);
}

export function clearDeskMapLink(id: string) {
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets.where('deskMapId').equals(id).modify({ deskMapId: null }),
      db.mapRegions.where('deskMapId').equals(id).modify({ deskMapId: null }),
    ]);
  });
}

export function clearNodeLink(id: string) {
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets.where('nodeId').equals(id).modify({ nodeId: null }),
      db.mapRegions.where('nodeId').equals(id).modify({ nodeId: null }),
    ]);
  });
}

export function clearOwnerLink(id: string) {
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets.where('linkedOwnerId').equals(id).modify({ linkedOwnerId: null }),
      db.mapRegions.where('linkedOwnerId').equals(id).modify({ linkedOwnerId: null }),
    ]);
  });
}

export function clearLeaseLink(id: string) {
  return db.transaction('rw', db.mapAssets, db.mapRegions, async () => {
    await Promise.all([
      db.mapAssets.where('leaseId').equals(id).modify({ leaseId: null }),
      db.mapRegions.where('leaseId').equals(id).modify({ leaseId: null }),
    ]);
  });
}
