import { create } from 'zustand';
import {
  clearDeskMapLink,
  clearLeaseLink,
  clearNodeLink,
  clearOwnerLink,
  deleteMapAsset,
  deleteMapReference,
  deleteMapRegion,
  loadMapAssetsWithBlobs,
  loadMapWorkspaceMetadata,
  replaceMapWorkspaceData,
  saveMapAsset,
  saveMapReference,
  saveMapRegion,
  updateMapAssetFields,
  type MapWorkspaceData,
} from '../storage/map-persistence';
import {
  createBlankMapAsset,
  normalizeMapAsset,
  normalizeMapExternalReference,
  normalizeMapRegion,
  type MapAsset,
  type MapAssetMeta,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';
import {
  deleteMapTractFeature,
  deleteMapTractFeaturesForAsset,
  loadMapTractFeatures,
  saveMapTractFeatures,
  updateMapTractFeatureFields,
} from '../storage/map-tract-feature-persistence';
import {
  buildMapTractFeatures,
  parseTractFeatures,
} from '../maps/geojson-ingest';
import {
  buildArcgisExternalRef,
  removeExternalRef,
  upsertExternalRef,
} from '../maps/feature-tract-matcher';
import type { MapTractFeature } from '../types/map-tract-feature';

export interface GeoJsonIngestResult {
  assetId: string;
  featureCount: number;
  warnings: string[];
}

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

function toMapAssetMeta(asset: MapAsset): MapAssetMeta {
  const { blob: _blob, ...meta } = asset;
  return meta;
}

interface MapState {
  workspaceId: string | null;
  mapAssets: MapAssetMeta[];
  mapRegions: MapRegion[];
  mapReferences: MapExternalReference[];
  /** DA2-M: parsed GeoJSON tract polygons (separate from rect `mapRegions`). */
  tractFeatures: MapTractFeature[];
  _hydrated: boolean;
  setWorkspace: (workspaceId: string) => Promise<void>;
  /**
   * Ingest an ArcGIS GeoJSON export: store the raw file as a `GeoJSON` map
   * asset, parse its polygons, and persist them as tract features keyed to that
   * asset (idempotent — re-ingesting the same file replaces its features).
   */
  ingestGeoJsonTractFeatures: (input: {
    fileName: string;
    text: string;
  }) => Promise<GeoJsonIngestResult>;
  /**
   * Link (or unlink, with `null`) a tract feature to a DeskMap. Persists the
   * feature's match and writes/moves the ArcGIS `ExternalRef` onto the
   * DeskMap(s) via the workspace store.
   */
  setFeatureTractMatch: (
    featureId: string,
    deskMapId: string | null
  ) => Promise<void>;
  /** Remove a tract feature entirely (and its ArcGIS ref from any matched DeskMap). */
  removeTractFeature: (featureId: string) => Promise<void>;
  replaceWorkspaceData: (
    workspaceId: string,
    data: MapWorkspaceData
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<MapWorkspaceData>;
  addAsset: (asset: MapAsset) => Promise<void>;
  updateAsset: (id: string, fields: Partial<MapAsset>) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  setFeaturedAsset: (id: string) => Promise<void>;
  addRegion: (region: MapRegion) => Promise<void>;
  updateRegion: (id: string, fields: Partial<MapRegion>) => Promise<void>;
  removeRegion: (id: string) => Promise<void>;
  addReference: (reference: MapExternalReference) => Promise<void>;
  updateReference: (
    id: string,
    fields: Partial<MapExternalReference>
  ) => Promise<void>;
  removeReference: (id: string) => Promise<void>;
  unlinkDeskMap: (id: string) => Promise<void>;
  unlinkNode: (id: string) => Promise<void>;
  unlinkOwner: (id: string) => Promise<void>;
  unlinkLease: (id: string) => Promise<void>;
}

function ensureFeaturedAsset<T extends { id: string; isFeatured: boolean }>(
  assets: T[]
): T[] {
  if (assets.length === 0) return [];
  if (assets.some((asset) => asset.isFeatured)) return assets;
  return assets.map((asset, index) =>
    index === 0 ? { ...asset, isFeatured: true } : asset
  );
}

function sameFeaturedState<T extends { id: string; isFeatured: boolean }>(
  left: T[],
  right: T[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((asset, index) => {
    const candidate = right[index];
    return (
      candidate &&
      candidate.id === asset.id &&
      candidate.isFeatured === asset.isFeatured
    );
  });
}

/**
 * Persist only the `isFeatured` flag for each asset via a blob-preserving
 * partial update. Replaces the old full-row `put` so the metadata-first store
 * (which holds blob-free assets) never wipes stored blobs on a featured
 * toggle. Asset rows must already exist in Dexie.
 */
async function persistFeaturedFlags(
  assets: ReadonlyArray<{ id: string; isFeatured: boolean }>
): Promise<void> {
  await Promise.all(
    assets.map((asset) =>
      updateMapAssetFields(asset.id, { isFeatured: asset.isFeatured })
    )
  );
}

export const useMapStore = create<MapState>()((set, get) => ({
  workspaceId: null,
  mapAssets: [],
  mapRegions: [],
  mapReferences: [],
  tractFeatures: [],
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const [data, tractFeatures] = await Promise.all([
      loadMapWorkspaceMetadata(workspaceId),
      loadMapTractFeatures(workspaceId),
    ]);
    const featuredAssets = ensureFeaturedAsset(data.mapAssets);
    if (!sameFeaturedState(data.mapAssets, featuredAssets)) {
      await persistFeaturedFlags(featuredAssets);
    }
    set({
      workspaceId,
      mapAssets: featuredAssets,
      mapRegions: data.mapRegions,
      mapReferences: data.mapReferences,
      tractFeatures,
      _hydrated: true,
    });
  },

  ingestGeoJsonTractFeatures: async ({ fileName, text }) => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) {
      throw new Error('Cannot ingest GeoJSON before a workspace is set.');
    }
    const collection = parseTractFeatures(text);

    // Store the raw GeoJSON as a map asset so the source file round-trips and
    // the features carry a stable `assetId` back-reference.
    const asset = createBlankMapAsset(
      workspaceId,
      new Blob([text], { type: 'application/geo+json' }),
      { fileName, mimeType: 'application/geo+json' }
    );
    await get().addAsset(asset);

    const now = new Date().toISOString();
    const features = buildMapTractFeatures(workspaceId, asset.id, collection, now);
    // Idempotent: clear any prior features for this asset, then write the batch.
    await deleteMapTractFeaturesForAsset(workspaceId, asset.id);
    await saveMapTractFeatures(workspaceId, features);
    set((state) => ({
      tractFeatures: [
        ...state.tractFeatures.filter((feature) => feature.assetId !== asset.id),
        ...features,
      ],
    }));

    return {
      assetId: asset.id,
      featureCount: features.length,
      warnings: collection.warnings,
    };
  },

  setFeatureTractMatch: async (featureId, deskMapId) => {
    const feature = get().tractFeatures.find((f) => f.id === featureId);
    if (!feature || feature.matchedDeskMapId === deskMapId) return;
    const previousDeskMapId = feature.matchedDeskMapId;
    const ref = buildArcgisExternalRef(feature);

    // 1. persist + reflect the feature's match link
    const updatedAt = new Date().toISOString();
    await updateMapTractFeatureFields(featureId, { matchedDeskMapId: deskMapId, updatedAt });
    set((state) => ({
      tractFeatures: state.tractFeatures.map((f) =>
        f.id === featureId ? { ...f, matchedDeskMapId: deskMapId, updatedAt } : f
      ),
    }));

    // 2. move the ArcGIS ref between desk maps. Dynamic import: workspace-store
    // statically imports this module, so a static back-import would deepen the
    // cycle. updateDeskMapDetails persists via the shard autosave (not journaled
    // — externalRefs is a GIS link, not a title-math field).
    if (!ref) return;
    const { useWorkspaceStore } = await import('./workspace-store');
    const ws = useWorkspaceStore.getState();
    if (previousDeskMapId && previousDeskMapId !== deskMapId) {
      const old = ws.deskMaps.find((dm) => dm.id === previousDeskMapId);
      if (old) {
        ws.updateDeskMapDetails(previousDeskMapId, {
          externalRefs: removeExternalRef(old.externalRefs ?? [], ref),
        });
      }
    }
    if (deskMapId) {
      const next = useWorkspaceStore.getState().deskMaps.find((dm) => dm.id === deskMapId);
      if (next) {
        ws.updateDeskMapDetails(deskMapId, {
          externalRefs: upsertExternalRef(next.externalRefs ?? [], ref),
        });
      }
    }
  },

  removeTractFeature: async (featureId) => {
    const feature = get().tractFeatures.find((f) => f.id === featureId);
    if (!feature) return;
    // Clear the ArcGIS ref off any matched DeskMap before dropping the feature.
    if (feature.matchedDeskMapId) {
      const ref = buildArcgisExternalRef(feature);
      if (ref) {
        const { useWorkspaceStore } = await import('./workspace-store');
        const deskMap = useWorkspaceStore
          .getState()
          .deskMaps.find((dm) => dm.id === feature.matchedDeskMapId);
        if (deskMap) {
          useWorkspaceStore.getState().updateDeskMapDetails(feature.matchedDeskMapId, {
            externalRefs: removeExternalRef(deskMap.externalRefs ?? [], ref),
          });
        }
      }
    }
    await deleteMapTractFeature(featureId);
    set((state) => ({
      tractFeatures: state.tractFeatures.filter((f) => f.id !== featureId),
    }));
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    const normalizedAssets = ensureFeaturedAsset(
      data.mapAssets.map((asset) => normalizeMapAsset({ ...asset, workspaceId }))
    );
    const normalizedData: MapWorkspaceData = {
      mapAssets: normalizedAssets,
      mapRegions: data.mapRegions.map((region) =>
        normalizeMapRegion({ ...region, workspaceId })
      ),
      mapReferences: data.mapReferences.map((reference) =>
        normalizeMapExternalReference({ ...reference, workspaceId })
      ),
    };
    await replaceMapWorkspaceData(workspaceId, normalizedData);
    set({
      workspaceId,
      mapAssets: normalizedData.mapAssets.map(toMapAssetMeta),
      mapRegions: normalizedData.mapRegions,
      mapReferences: normalizedData.mapReferences,
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => {
    const { workspaceId, mapRegions, mapReferences } = get();
    // Re-read blob-bearing assets from Dexie: the in-memory store holds
    // metadata only, but `.landroid` export and the AI undo snapshot must
    // carry the file bytes.
    const mapAssets = workspaceId
      ? await loadMapAssetsWithBlobs(workspaceId)
      : [];
    return { mapAssets, mapRegions, mapReferences };
  },

  addAsset: async (asset) => {
    const workspaceId = get().workspaceId ?? asset.workspaceId;
    const state = get();
    // `next` keeps the blob for the Dexie insert; the store holds metadata.
    const next = normalizeMapAsset({
      ...asset,
      workspaceId,
      isFeatured:
        asset.isFeatured || !state.mapAssets.some((candidate) => candidate.isFeatured),
    });
    const nextMeta = toMapAssetMeta(next);
    const nextAssets = ensureFeaturedAsset(
      [nextMeta, ...state.mapAssets].map((candidate) =>
        nextMeta.isFeatured
          ? { ...candidate, isFeatured: candidate.id === nextMeta.id }
          : candidate
      )
    );
    await saveMapAsset(next); // insert the new row WITH its blob first
    await persistFeaturedFlags(nextAssets); // then sync featured flags
    set({ mapAssets: nextAssets });
  },

  updateAsset: async (id, fields) => {
    const state = get();
    const current = state.mapAssets.find((asset) => asset.id === id);
    if (!current) return;
    const { blob: _blob, ...metaFields } = fields;
    const next = toMapAssetMeta(
      normalizeMapAsset(
        touch({ ...current, ...metaFields, workspaceId: current.workspaceId })
      )
    );
    const nextAssets = ensureFeaturedAsset(
      state.mapAssets.map((asset) => {
        const candidate = asset.id === id ? next : asset;
        if (fields.isFeatured === true) {
          return { ...candidate, isFeatured: candidate.id === id };
        }
        return candidate;
      })
    );
    // Metadata-only partial update preserves the stored blob.
    await updateMapAssetFields(id, next);
    await persistFeaturedFlags(nextAssets);
    set({ mapAssets: nextAssets });
  },

  removeAsset: async (id) => {
    await deleteMapAsset(id);
    const state = get();
    // Drop tract features ingested from this (GeoJSON) asset, if any.
    if (state.workspaceId && state.tractFeatures.some((feature) => feature.assetId === id)) {
      await deleteMapTractFeaturesForAsset(state.workspaceId, id);
    }
    const nextAssets = ensureFeaturedAsset(
      state.mapAssets.filter((asset) => asset.id !== id)
    );
    await persistFeaturedFlags(nextAssets);
    set({
      mapAssets: nextAssets,
      mapRegions: state.mapRegions.filter((region) => region.assetId !== id),
      mapReferences: state.mapReferences.filter((reference) => reference.assetId !== id),
      tractFeatures: state.tractFeatures.filter((feature) => feature.assetId !== id),
    });
  },

  setFeaturedAsset: async (id) => {
    const state = get();
    const nextAssets = ensureFeaturedAsset(
      state.mapAssets.map((asset) => ({
        ...asset,
        isFeatured: asset.id === id,
      }))
    );
    await persistFeaturedFlags(nextAssets);
    set({ mapAssets: nextAssets });
  },

  addRegion: async (region) => {
    const workspaceId = get().workspaceId ?? region.workspaceId;
    const next = normalizeMapRegion({ ...region, workspaceId });
    await saveMapRegion(next);
    set((state) => ({ mapRegions: [...state.mapRegions, next] }));
  },

  updateRegion: async (id, fields) => {
    const current = get().mapRegions.find((region) => region.id === id);
    if (!current) return;
    const next = normalizeMapRegion(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveMapRegion(next);
    set((state) => ({
      mapRegions: state.mapRegions.map((region) =>
        region.id === id ? next : region
      ),
    }));
  },

  removeRegion: async (id) => {
    await deleteMapRegion(id);
    set((state) => ({
      mapRegions: state.mapRegions.filter((region) => region.id !== id),
      mapReferences: state.mapReferences.filter(
        (reference) => reference.regionId !== id
      ),
    }));
  },

  addReference: async (reference) => {
    const workspaceId = get().workspaceId ?? reference.workspaceId;
    const next = normalizeMapExternalReference({ ...reference, workspaceId });
    await saveMapReference(next);
    set((state) => ({ mapReferences: [...state.mapReferences, next] }));
  },

  updateReference: async (id, fields) => {
    const current = get().mapReferences.find((reference) => reference.id === id);
    if (!current) return;
    const next = normalizeMapExternalReference(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveMapReference(next);
    set((state) => ({
      mapReferences: state.mapReferences.map((reference) =>
        reference.id === id ? next : reference
      ),
    }));
  },

  removeReference: async (id) => {
    await deleteMapReference(id);
    set((state) => ({
      mapReferences: state.mapReferences.filter((reference) => reference.id !== id),
    }));
  },

  unlinkDeskMap: async (id) => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;
    await clearDeskMapLink(workspaceId, id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.deskMapId === id ? { ...asset, deskMapId: null } : asset
      ),
      mapRegions: state.mapRegions.map((region) =>
        region.deskMapId === id ? { ...region, deskMapId: null } : region
      ),
    }));
  },

  unlinkNode: async (id) => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;
    await clearNodeLink(workspaceId, id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.nodeId === id ? { ...asset, nodeId: null } : asset
      ),
      mapRegions: state.mapRegions.map((region) =>
        region.nodeId === id ? { ...region, nodeId: null } : region
      ),
    }));
  },

  unlinkOwner: async (id) => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;
    await clearOwnerLink(workspaceId, id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.linkedOwnerId === id ? { ...asset, linkedOwnerId: null } : asset
      ),
      mapRegions: state.mapRegions.map((region) =>
        region.linkedOwnerId === id ? { ...region, linkedOwnerId: null } : region
      ),
    }));
  },

  unlinkLease: async (id) => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;
    await clearLeaseLink(workspaceId, id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.leaseId === id ? { ...asset, leaseId: null } : asset
      ),
      mapRegions: state.mapRegions.map((region) =>
        region.leaseId === id ? { ...region, leaseId: null } : region
      ),
    }));
  },
}));
