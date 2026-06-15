/**
 * Session-scoped storage health signals for the UI.
 *
 * This store is intentionally diagnostic only: it does not create a new
 * persistence authority or affect autosave/export behavior.
 */
import { create } from 'zustand';
import { isQuotaExceededError } from '../storage/persistent-storage';
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
  /**
   * Last storage-quota write failure (DA-M11). A denied blob/shard write was
   * previously invisible; this surfaces it so the Sidebar can warn the user to
   * export. Cleared by the next successful workspace save.
   */
  lastPersistenceError: { message: string; at: string } | null;
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
  recordPersistenceError: (message: string) => void;
  clearPersistenceError: () => void;
  setBrowserStorageEstimate: (estimate: BrowserStorageEstimateResult) => void;
  setPersistentStorageResult: (result: PersistentStorageResult) => void;
  setRollingAutoExportSupported: () => void;
  setRollingAutoExportUnsupported: () => void;
}

export const useStorageHealthStore = create<StorageHealthState>((set) => ({
  browserStorageEstimate: null,
  lastExportedAt: null,
  lastSavedAt: null,
  lastPersistenceError: null,
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
    // A successful save means storage accepted the write — clear any stale
    // quota warning.
    set({ lastSavedAt: savedAt, lastPersistenceError: null });
  },
  recordWorkspaceExported: (exportedAt = new Date().toISOString()) => {
    set({ lastExportedAt: exportedAt });
  },
  recordPersistenceError: (message) => {
    set({ lastPersistenceError: { message, at: new Date().toISOString() } });
  },
  clearPersistenceError: () => {
    set({ lastPersistenceError: null });
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

/**
 * Run a storage write; on an IndexedDB quota failure, record it on the
 * storage-health store (so the Sidebar can warn the user to export) before
 * rethrowing so existing callers still see the failure (DA-M11).
 */
export async function withQuotaErrorReporting<T>(
  operationLabel: string,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      useStorageHealthStore
        .getState()
        .recordPersistenceError(
          `${operationLabel} failed: browser storage is full. Export a .landroid backup to free space.`
        );
    }
    throw error;
  }
}
