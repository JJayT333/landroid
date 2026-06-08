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

export type RollingAutoExportSupport = 'checking' | 'supported' | 'unsupported';
export type RollingAutoExportPermission =
  | PermissionState
  | 'unknown'
  | 'unsupported';

export interface RollingAutoExportState {
  directoryName: string | null;
  enabled: boolean;
  isWriting: boolean;
  lastAutoExportedAt: string | null;
  lastAutoExportError: string | null;
  lastAutoExportFileName: string | null;
  pendingExportDueAt: string | null;
  permission: RollingAutoExportPermission;
  support: RollingAutoExportSupport;
  warning: string | null;
}

const initialRollingAutoExportState: RollingAutoExportState = {
  directoryName: null,
  enabled: false,
  isWriting: false,
  lastAutoExportedAt: null,
  lastAutoExportError: null,
  lastAutoExportFileName: null,
  pendingExportDueAt: null,
  permission: 'unknown',
  support: 'checking',
  warning: null,
};

interface StorageHealthState {
  browserStorageEstimate: BrowserStorageEstimateResult | null;
  lastExportedAt: string | null;
  lastSavedAt: string | null;
  persistentStorage: PersistentStorageResult | null;
  rollingAutoExport: RollingAutoExportState;
  clearRollingAutoExportDirectory: () => void;
  configureRollingAutoExportDirectory: (directory: {
    directoryName: string;
    lastAutoExportedAt?: string | null;
    lastAutoExportFileName?: string | null;
    permission: RollingAutoExportPermission;
  }) => void;
  recordRollingAutoExported: (snapshot: {
    exportedAt: string;
    fileName: string;
  }) => void;
  recordRollingAutoExportError: (
    message: string,
    permission?: RollingAutoExportPermission
  ) => void;
  recordRollingAutoExportScheduled: (dueAt: string) => void;
  recordRollingAutoExportStarted: () => void;
  recordRollingAutoExportWarning: (message: string) => void;
  recordWorkspaceSaved: (savedAt?: string) => void;
  recordWorkspaceExported: (exportedAt?: string) => void;
  setBrowserStorageEstimate: (estimate: BrowserStorageEstimateResult) => void;
  setPersistentStorageResult: (result: PersistentStorageResult) => void;
  setRollingAutoExportSupported: () => void;
  setRollingAutoExportUnsupported: () => void;
}

export const useStorageHealthStore = create<StorageHealthState>((set) => ({
  browserStorageEstimate: null,
  lastExportedAt: null,
  lastSavedAt: null,
  persistentStorage: null,
  rollingAutoExport: initialRollingAutoExportState,
  clearRollingAutoExportDirectory: () => {
    set({
      rollingAutoExport: {
        ...initialRollingAutoExportState,
        support: 'supported',
      },
    });
  },
  configureRollingAutoExportDirectory: (directory) => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        directoryName: directory.directoryName,
        enabled: true,
        isWriting: false,
        lastAutoExportedAt: directory.lastAutoExportedAt ?? null,
        lastAutoExportError: null,
        lastAutoExportFileName: directory.lastAutoExportFileName ?? null,
        pendingExportDueAt: null,
        permission: directory.permission,
        support: 'supported',
        warning: null,
      },
    }));
  },
  recordRollingAutoExported: (snapshot) => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        isWriting: false,
        lastAutoExportedAt: snapshot.exportedAt,
        lastAutoExportError: null,
        lastAutoExportFileName: snapshot.fileName,
        pendingExportDueAt: null,
        permission: 'granted',
        warning: null,
      },
    }));
  },
  recordRollingAutoExportError: (message, permission) => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        isWriting: false,
        lastAutoExportError: message,
        pendingExportDueAt: null,
        permission: permission ?? state.rollingAutoExport.permission,
        warning: message,
      },
    }));
  },
  recordRollingAutoExportScheduled: (dueAt) => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        isWriting: false,
        lastAutoExportError: null,
        pendingExportDueAt: dueAt,
        warning: null,
      },
    }));
  },
  recordRollingAutoExportStarted: () => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        isWriting: true,
        lastAutoExportError: null,
        pendingExportDueAt: null,
        warning: null,
      },
    }));
  },
  recordRollingAutoExportWarning: (message) => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        warning: message,
      },
    }));
  },
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
  setRollingAutoExportSupported: () => {
    set((state) => ({
      rollingAutoExport: {
        ...state.rollingAutoExport,
        support: 'supported',
        warning: state.rollingAutoExport.enabled
          ? state.rollingAutoExport.warning
          : null,
      },
    }));
  },
  setRollingAutoExportUnsupported: () => {
    set({
      rollingAutoExport: {
        ...initialRollingAutoExportState,
        support: 'unsupported',
        warning:
          'Rolling auto-export needs browser folder access. Use Backup Now for manual .landroid backups.',
      },
    });
  },
}));
