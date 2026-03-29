import db from './db';
import type { MapAsset } from '../types/map';

export interface MapWorkspaceData {
  mapAssets: MapAsset[];
}

export async function loadMapWorkspaceData(
  workspaceId: string
): Promise<MapWorkspaceData> {
  return {
    mapAssets: await db.mapAssets.where('workspaceId').equals(workspaceId).toArray(),
  };
}

export async function replaceMapWorkspaceData(
  workspaceId: string,
  data: MapWorkspaceData
): Promise<void> {
  await db.transaction('rw', db.mapAssets, async () => {
    await db.mapAssets.where('workspaceId').equals(workspaceId).delete();
    if (data.mapAssets.length > 0) {
      await db.mapAssets.bulkPut(
        data.mapAssets.map((asset) => ({ ...asset, workspaceId }))
      );
    }
  });
}

export function saveMapAsset(asset: MapAsset) {
  return db.mapAssets.put(asset);
}

export function deleteMapAsset(id: string) {
  return db.mapAssets.delete(id);
}

export function clearDeskMapLink(id: string) {
  return db.mapAssets.where('deskMapId').equals(id).modify({ deskMapId: null });
}

export function clearNodeLink(id: string) {
  return db.mapAssets.where('nodeId').equals(id).modify({ nodeId: null });
}

export function clearOwnerLink(id: string) {
  return db.mapAssets.where('linkedOwnerId').equals(id).modify({ linkedOwnerId: null });
}

export function clearLeaseLink(id: string) {
  return db.mapAssets.where('leaseId').equals(id).modify({ leaseId: null });
}
