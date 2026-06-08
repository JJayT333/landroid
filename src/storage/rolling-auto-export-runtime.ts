import { buildCurrentLandroidExport } from '../app/current-landroid-export';
import { useStorageHealthStore } from '../store/storage-health-store';
import {
  ROLLING_AUTO_EXPORT_DEBOUNCE_MS,
  ROLLING_AUTO_EXPORT_OVERDUE_MS,
  RollingAutoExportPermissionError,
  clearStoredRollingAutoExportDirectory,
  isRollingAutoExportSupported,
  loadStoredRollingAutoExportDirectory,
  queryRollingAutoExportPermission,
  requestRollingAutoExportPermission,
  saveStoredRollingAutoExportDirectory,
  selectRollingAutoExportDirectory,
  updateStoredRollingAutoExportMetadata,
  writeRollingAutoExportSnapshot,
  type RollingAutoExportDirectoryHandle,
} from './rolling-auto-export';

let directoryHandle: RollingAutoExportDirectoryHandle | null = null;
let exportTimer: ReturnType<typeof setTimeout> | null = null;
let overdueTimer: ReturnType<typeof setTimeout> | null = null;
let exportGeneration = 0;

function warningFromError(error: unknown): string {
  if (error instanceof RollingAutoExportPermissionError) {
    return 'Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.';
  }
  return error instanceof Error ? error.message : String(error);
}

function clearTimers(): void {
  if (exportTimer) clearTimeout(exportTimer);
  if (overdueTimer) clearTimeout(overdueTimer);
  exportTimer = null;
  overdueTimer = null;
}

function scheduleOverdueWarning(generation: number): void {
  if (overdueTimer) clearTimeout(overdueTimer);
  overdueTimer = setTimeout(() => {
    if (generation !== exportGeneration) return;
    useStorageHealthStore.getState().recordRollingAutoExportWarning(
      'Rolling auto-export is overdue. Use Backup Now or choose the folder again.'
    );
  }, ROLLING_AUTO_EXPORT_OVERDUE_MS);
}

export async function initializeRollingAutoExport(): Promise<void> {
  if (!isRollingAutoExportSupported()) {
    directoryHandle = null;
    clearTimers();
    useStorageHealthStore.getState().setRollingAutoExportUnsupported();
    return;
  }

  useStorageHealthStore.getState().setRollingAutoExportSupported();
  const stored = await loadStoredRollingAutoExportDirectory();
  if (!stored) return;

  directoryHandle = stored.directoryHandle;
  const permission = await queryRollingAutoExportPermission(stored.directoryHandle);
  useStorageHealthStore.getState().configureRollingAutoExportDirectory({
    directoryName: stored.directoryName,
    lastAutoExportedAt: stored.lastAutoExportedAt,
    lastAutoExportFileName: stored.lastAutoExportFileName,
    permission,
  });

  if (permission !== 'granted') {
    useStorageHealthStore.getState().recordRollingAutoExportWarning(
      'Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.'
    );
  }
}

export async function chooseRollingAutoExportDirectory(): Promise<
  'selected' | 'cancelled' | 'unsupported'
> {
  if (!isRollingAutoExportSupported()) {
    useStorageHealthStore.getState().setRollingAutoExportUnsupported();
    return 'unsupported';
  }

  const handle = await selectRollingAutoExportDirectory();
  if (!handle) return 'cancelled';

  directoryHandle = handle;
  let permission = await queryRollingAutoExportPermission(handle);
  if (permission !== 'granted') {
    permission = await requestRollingAutoExportPermission(handle).catch(
      () => permission
    );
  }
  await saveStoredRollingAutoExportDirectory(handle);
  useStorageHealthStore.getState().configureRollingAutoExportDirectory({
    directoryName: handle.name,
    lastAutoExportedAt: null,
    lastAutoExportFileName: null,
    permission,
  });

  if (permission !== 'granted') {
    useStorageHealthStore.getState().recordRollingAutoExportWarning(
      'Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.'
    );
    return 'selected';
  }

  void runRollingAutoExportNow();
  return 'selected';
}

export async function disableRollingAutoExport(): Promise<void> {
  directoryHandle = null;
  exportGeneration += 1;
  clearTimers();
  await clearStoredRollingAutoExportDirectory();
  useStorageHealthStore.getState().clearRollingAutoExportDirectory();
}

export function scheduleRollingAutoExport(): void {
  const store = useStorageHealthStore.getState();
  const state = store.rollingAutoExport;
  if (
    !directoryHandle
    || !state.enabled
    || state.support !== 'supported'
    || state.permission !== 'granted'
  ) {
    return;
  }

  exportGeneration += 1;
  const generation = exportGeneration;
  const dueAt = new Date(Date.now() + ROLLING_AUTO_EXPORT_DEBOUNCE_MS).toISOString();
  store.recordRollingAutoExportScheduled(dueAt);
  if (exportTimer) clearTimeout(exportTimer);
  exportTimer = setTimeout(() => {
    if (generation !== exportGeneration) return;
    void runRollingAutoExportNow();
  }, ROLLING_AUTO_EXPORT_DEBOUNCE_MS);
  scheduleOverdueWarning(generation);
}

export async function runRollingAutoExportNow(): Promise<void> {
  if (!directoryHandle) return;

  exportGeneration += 1;
  clearTimers();
  const store = useStorageHealthStore.getState();
  store.recordRollingAutoExportStarted();

  try {
    const currentExport = await buildCurrentLandroidExport();
    const result = await writeRollingAutoExportSnapshot({
      directoryHandle,
      data: currentExport.data,
      options: currentExport.options,
    });
    await updateStoredRollingAutoExportMetadata({
      exportedAt: result.exportedAt,
      fileName: result.fileName,
    });
    useStorageHealthStore.getState().recordWorkspaceExported(result.exportedAt);
    useStorageHealthStore.getState().recordRollingAutoExported({
      exportedAt: result.exportedAt,
      fileName: result.fileName,
    });
  } catch (error) {
    useStorageHealthStore.getState().recordRollingAutoExportError(
      warningFromError(error),
      error instanceof RollingAutoExportPermissionError ? 'denied' : undefined
    );
  }
}
