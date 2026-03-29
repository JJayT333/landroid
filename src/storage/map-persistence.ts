import db from './db';
import {
  normalizeMapAsset,
  normalizeMapExternalReference,
  normalizeMapRegion,
  type MapAsset,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';

export interface MapWorkspaceData {
  mapAssets: MapAsset[];
  mapRegions: MapRegion[];
  mapReferences: MapExternalReference[];
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
