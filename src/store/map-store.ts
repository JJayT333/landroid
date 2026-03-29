import { create } from 'zustand';
import {
  clearDeskMapLink,
  clearLeaseLink,
  clearNodeLink,
  clearOwnerLink,
  deleteMapAsset,
  loadMapWorkspaceData,
  replaceMapWorkspaceData,
  saveMapAsset,
  type MapWorkspaceData,
} from '../storage/map-persistence';
import type { MapAsset } from '../types/map';

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

interface MapState {
  workspaceId: string | null;
  mapAssets: MapAsset[];
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
  unlinkDeskMap: (id: string) => Promise<void>;
  unlinkNode: (id: string) => Promise<void>;
  unlinkOwner: (id: string) => Promise<void>;
  unlinkLease: (id: string) => Promise<void>;
}

export const useMapStore = create<MapState>()((set, get) => ({
  workspaceId: null,
  mapAssets: [],
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadMapWorkspaceData(workspaceId);
    set({
      workspaceId,
      mapAssets: data.mapAssets,
      _hydrated: true,
    });
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    await replaceMapWorkspaceData(workspaceId, data);
    set({
      workspaceId,
      mapAssets: data.mapAssets.map((asset) => ({ ...asset, workspaceId })),
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => ({
    mapAssets: get().mapAssets,
  }),

  addAsset: async (asset) => {
    const workspaceId = get().workspaceId ?? asset.workspaceId;
    const next = { ...asset, workspaceId };
    await saveMapAsset(next);
    set((state) => ({ mapAssets: [next, ...state.mapAssets] }));
  },

  updateAsset: async (id, fields) => {
    const current = get().mapAssets.find((asset) => asset.id === id);
    if (!current) return;
    const next = touch({ ...current, ...fields, workspaceId: current.workspaceId });
    await saveMapAsset(next);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) => (asset.id === id ? next : asset)),
    }));
  },

  removeAsset: async (id) => {
    await deleteMapAsset(id);
    set((state) => ({
      mapAssets: state.mapAssets.filter((asset) => asset.id !== id),
    }));
  },

  unlinkDeskMap: async (id) => {
    await clearDeskMapLink(id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.deskMapId === id ? { ...asset, deskMapId: null } : asset
      ),
    }));
  },

  unlinkNode: async (id) => {
    await clearNodeLink(id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.nodeId === id ? { ...asset, nodeId: null } : asset
      ),
    }));
  },

  unlinkOwner: async (id) => {
    await clearOwnerLink(id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.linkedOwnerId === id ? { ...asset, linkedOwnerId: null } : asset
      ),
    }));
  },

  unlinkLease: async (id) => {
    await clearLeaseLink(id);
    set((state) => ({
      mapAssets: state.mapAssets.map((asset) =>
        asset.leaseId === id ? { ...asset, leaseId: null } : asset
      ),
    }));
  },
}));
