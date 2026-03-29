import { create } from 'zustand';
import {
  clearDeskMapLink,
  clearLeaseLink,
  clearNodeLink,
  clearOwnerLink,
  deleteMapAsset,
  deleteMapReference,
  deleteMapRegion,
  loadMapWorkspaceData,
  replaceMapWorkspaceData,
  saveMapAsset,
  saveMapReference,
  saveMapRegion,
  type MapWorkspaceData,
} from '../storage/map-persistence';
import {
  normalizeMapAsset,
  normalizeMapExternalReference,
  normalizeMapRegion,
  type MapAsset,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

interface MapState {
  workspaceId: string | null;
  mapAssets: MapAsset[];
  mapRegions: MapRegion[];
  mapReferences: MapExternalReference[];
  _hydrated: boolean;
  setWorkspace: (workspaceId: string) => Promise<void>;
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

function ensureFeaturedAsset(assets: MapAsset[]): MapAsset[] {
  if (assets.length === 0) return [];
  if (assets.some((asset) => asset.isFeatured)) return assets;
  return assets.map((asset, index) =>
    index === 0 ? { ...asset, isFeatured: true } : asset
  );
}

function sameFeaturedState(left: MapAsset[], right: MapAsset[]): boolean {
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

async function persistAssets(assets: MapAsset[]): Promise<void> {
  await Promise.all(assets.map((asset) => saveMapAsset(asset)));
}

export const useMapStore = create<MapState>()((set, get) => ({
  workspaceId: null,
  mapAssets: [],
  mapRegions: [],
  mapReferences: [],
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadMapWorkspaceData(workspaceId);
    const featuredAssets = ensureFeaturedAsset(data.mapAssets);
    if (!sameFeaturedState(data.mapAssets, featuredAssets)) {
      await persistAssets(featuredAssets);
    }
    set({
      workspaceId,
      mapAssets: featuredAssets,
      mapRegions: data.mapRegions,
      mapReferences: data.mapReferences,
      _hydrated: true,
    });
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
      mapAssets: normalizedData.mapAssets,
      mapRegions: normalizedData.mapRegions,
      mapReferences: normalizedData.mapReferences,
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => ({
    mapAssets: get().mapAssets,
    mapRegions: get().mapRegions,
    mapReferences: get().mapReferences,
  }),

  addAsset: async (asset) => {
    const workspaceId = get().workspaceId ?? asset.workspaceId;
    const state = get();
    const next = normalizeMapAsset({
      ...asset,
      workspaceId,
      isFeatured:
        asset.isFeatured || !state.mapAssets.some((candidate) => candidate.isFeatured),
    });
    const nextAssets = ensureFeaturedAsset(
      [next, ...state.mapAssets].map((candidate) =>
        next.isFeatured ? { ...candidate, isFeatured: candidate.id === next.id } : candidate
      )
    );
    await persistAssets(nextAssets);
    set({ mapAssets: nextAssets });
  },

  updateAsset: async (id, fields) => {
    const state = get();
    const current = state.mapAssets.find((asset) => asset.id === id);
    if (!current) return;
    const next = normalizeMapAsset(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
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
    await persistAssets(nextAssets);
    set({ mapAssets: nextAssets });
  },

  removeAsset: async (id) => {
    await deleteMapAsset(id);
    const state = get();
    const nextAssets = ensureFeaturedAsset(
      state.mapAssets.filter((asset) => asset.id !== id)
    );
    await persistAssets(nextAssets);
    set({
      mapAssets: nextAssets,
      mapRegions: state.mapRegions.filter((region) => region.assetId !== id),
      mapReferences: state.mapReferences.filter((reference) => reference.assetId !== id),
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
    await persistAssets(nextAssets);
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
    await clearDeskMapLink(id);
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
    await clearNodeLink(id);
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
    await clearOwnerLink(id);
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
    await clearLeaseLink(id);
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
