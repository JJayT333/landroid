/**
 * Session-scoped storage health signals for the UI.
 *
 * This store is intentionally diagnostic only: it does not create a new
 * persistence authority or affect autosave/export behavior.
 */
import { create } from 'zustand';

interface StorageHealthState {
  lastExportedAt: string | null;
  recordWorkspaceExported: (exportedAt?: string) => void;
}

export const useStorageHealthStore = create<StorageHealthState>((set) => ({
  lastExportedAt: null,
  recordWorkspaceExported: (exportedAt = new Date().toISOString()) => {
    set({ lastExportedAt: exportedAt });
  },
}));
