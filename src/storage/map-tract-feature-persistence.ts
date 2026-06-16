import db from './db';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
} from './db-key-scope';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWriteFence,
} from './workspace-write-lease';
import {
  normalizeMapTractFeature,
  type MapTractFeature,
} from '../types/map-tract-feature';

function stripStoredId<T extends { id: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'id');
}

async function getMapTractFeatureRow(id: string) {
  return (
    (await db.mapTractFeatures.get(activeStorageScopedId(id)))
    ?? db.mapTractFeatures.get(id)
  );
}

export async function loadMapTractFeatures(
  workspaceId: string
): Promise<MapTractFeature[]> {
  const rows = await db.mapTractFeatures
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
  return rows.map((row) => normalizeMapTractFeature(stripStoredId(row)));
}

/** Write a batch of features (the ingest path). No-op on an empty list. */
export async function saveMapTractFeatures(
  workspaceId: string,
  features: MapTractFeature[]
): Promise<void> {
  if (features.length === 0) return;
  await ensureWorkspaceWriteFence(workspaceId);
  await db.transaction('rw', db.workspaceWriteLeases, db.mapTractFeatures, async () => {
    await assertWorkspaceWriteFence(workspaceId);
    await db.mapTractFeatures.bulkPut(
      features.map((feature) =>
        stampActiveDbKeyWithStorageId(
          normalizeMapTractFeature({ ...feature, workspaceId }),
          'id'
        )
      )
    );
  });
}

/** Patch a single feature's columns in place (e.g. the match link, PR M2). */
export async function updateMapTractFeatureFields(
  id: string,
  fields: Partial<MapTractFeature>
): Promise<void> {
  const { id: _id, ...rest } = fields;
  const row = await getMapTractFeatureRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  await db.transaction('rw', db.workspaceWriteLeases, db.mapTractFeatures, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.mapTractFeatures.update(row.id, rest);
  });
}

/** Delete a single tract feature by id (the operator curating their unit). */
export async function deleteMapTractFeature(id: string): Promise<void> {
  const row = await getMapTractFeatureRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  await db.transaction('rw', db.workspaceWriteLeases, db.mapTractFeatures, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.mapTractFeatures.delete(row.id);
  });
}

/** Drop every feature ingested from one GeoJSON asset (re-ingest / asset delete). */
export async function deleteMapTractFeaturesForAsset(
  workspaceId: string,
  assetId: string
): Promise<void> {
  await ensureWorkspaceWriteFence(workspaceId);
  const [dbKey] = activeWorkspaceScope(workspaceId);
  await db.transaction('rw', db.workspaceWriteLeases, db.mapTractFeatures, async () => {
    await assertWorkspaceWriteFence(workspaceId);
    await db.mapTractFeatures
      .where('[dbKey+workspaceId+assetId]')
      .equals([dbKey, workspaceId, assetId])
      .delete();
  });
}
