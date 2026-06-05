/**
 * Session-scoped storage health signals for the UI.
 *
 * This store is intentionally diagnostic only: it does not create a new
 * persistence authority or affect autosave/export behavior.
 */
import { create } from 'zustand';
import type {
  BrowserStorageEstimateResult,
  PersistentStorageResult,
} from '../storage/persistent-storage';

interface StorageHealthState {
  browserStorageEstimate: BrowserStorageEstimateResult | null;
  lastExportedAt: string | null;
  lastSavedAt: string | null;
  persistentStorage: PersistentStorageResult | null;
  recordWorkspaceSaved: (savedAt?: string) => void;
  recordWorkspaceExported: (exportedAt?: string) => void;
  setBrowserStorageEstimate: (estimate: BrowserStorageEstimateResult) => void;
  setPersistentStorageResult: (result: PersistentStorageResult) => void;
}

export const useStorageHealthStore = create<StorageHealthState>((set) => ({
  browserStorageEstimate: null,
  lastExportedAt: null,
  lastSavedAt: null,
  persistentStorage: null,
  recordWorkspaceSaved: (savedAt = new Date().toISOString()) => {
    set({ lastSavedAt: savedAt });
  },
  recordWorkspaceExported: (exportedAt = new Date().toISOString()) => {
    set({ lastExportedAt: exportedAt });
  },
  setBrowserStorageEstimate: (estimate) => {
    set({ browserStorageEstimate: estimate });
  },
  setPersistentStorageResult: (result) => {
    set({ persistentStorage: result });
  },
}));
