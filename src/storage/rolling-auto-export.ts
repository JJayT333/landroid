import {
  exportLandroidFile,
  type LandroidFileData,
  type LandroidFileExportOptions,
} from './workspace-persistence';

export const ROLLING_AUTO_EXPORT_DEBOUNCE_MS = 5 * 60 * 1000;
export const ROLLING_AUTO_EXPORT_OVERDUE_MS = 30 * 60 * 1000;
export const ROLLING_AUTO_EXPORT_KEEP_LAST = 10;

const HANDLE_DB_NAME = 'landroid-rolling-auto-export';
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE_NAME = 'settings';
const DIRECTORY_HANDLE_ID = 'directory-handle';

type PermissionMode = 'read' | 'readwrite';
type DirectoryPermissionState = PermissionState | 'unsupported';

interface PermissionDescriptor {
  mode?: PermissionMode;
}

interface ShowDirectoryPickerOptions {
  mode?: PermissionMode;
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

export interface RollingAutoExportWritable {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
}

export interface RollingAutoExportFileHandle {
  createWritable: () => Promise<RollingAutoExportWritable>;
}

export interface RollingAutoExportDirectoryHandle {
  name: string;
  getFileHandle: (
    name: string,
    options: { create: true }
  ) => Promise<RollingAutoExportFileHandle>;
  values?: () => AsyncIterable<{ kind: string; name: string }>;
  removeEntry?: (name: string) => Promise<void>;
  queryPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>;
}

export type FileSystemAccessWindow = Window & {
  showDirectoryPicker?: (
    options?: ShowDirectoryPickerOptions
  ) => Promise<RollingAutoExportDirectoryHandle>;
};

interface RollingAutoExportDirectoryRecord {
  id: typeof DIRECTORY_HANDLE_ID;
  directoryHandle: RollingAutoExportDirectoryHandle;
  directoryName: string;
  lastAutoExportedAt: string | null;
  lastAutoExportFileName: string | null;
  updatedAt: string;
}

export interface StoredRollingAutoExportDirectory {
  directoryHandle: RollingAutoExportDirectoryHandle;
  directoryName: string;
  lastAutoExportedAt: string | null;
  lastAutoExportFileName: string | null;
  updatedAt: string;
}

export interface RollingAutoExportWriteResult {
  exportedAt: string;
  fileName: string;
  size: number;
  prunedFileNames: string[];
  pruneWarning?: string;
}

export class RollingAutoExportPermissionError extends Error {
  constructor(permission: DirectoryPermissionState) {
    super(
      permission === 'unsupported'
        ? 'Auto-export folder permission cannot be checked in this browser.'
        : 'Auto-export folder permission is not granted.'
    );
    this.name = 'RollingAutoExportPermissionError';
  }
}

function getDefaultWindow(): FileSystemAccessWindow | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as FileSystemAccessWindow);
}

function getDefaultIndexedDB(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

export function isRollingAutoExportSupported(
  win: FileSystemAccessWindow | undefined = getDefaultWindow(),
  idb: IDBFactory | undefined = getDefaultIndexedDB()
): boolean {
  return Boolean(win?.showDirectoryPicker && idb);
}

export async function selectRollingAutoExportDirectory(
  win: FileSystemAccessWindow | undefined = getDefaultWindow()
): Promise<RollingAutoExportDirectoryHandle | null> {
  if (!win?.showDirectoryPicker) return null;

  try {
    return await win.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (error) {
    if (
      typeof DOMException !== 'undefined'
      && error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'NotAllowedError')
    ) {
      return null;
    }
    throw error;
  }
}

export async function queryRollingAutoExportPermission(
  handle: RollingAutoExportDirectoryHandle
): Promise<DirectoryPermissionState> {
  if (!handle.queryPermission) return 'unsupported';
  return handle.queryPermission({ mode: 'readwrite' });
}

export async function requestRollingAutoExportPermission(
  handle: RollingAutoExportDirectoryHandle
): Promise<DirectoryPermissionState> {
  if (!handle.requestPermission) {
    return queryRollingAutoExportPermission(handle);
  }
  return handle.requestPermission({ mode: 'readwrite' });
}

async function assertRollingAutoExportWritePermission(
  handle: RollingAutoExportDirectoryHandle
): Promise<void> {
  const permission = await queryRollingAutoExportPermission(handle);
  if (permission !== 'granted') {
    throw new RollingAutoExportPermissionError(permission);
  }
}

export function sanitizeRollingAutoExportBaseName(projectName: string): string {
  const trimmed = projectName.trim() || 'workspace';
  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, 80);
  return sanitized || 'workspace';
}

export function buildRollingAutoExportFileName(
  projectName: string,
  date: Date
): string {
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `${sanitizeRollingAutoExportBaseName(projectName)}-${timestamp}.landroid`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rollingAutoExportFileNamePattern(projectName: string): RegExp {
  const baseName = escapeRegExp(sanitizeRollingAutoExportBaseName(projectName));
  return new RegExp(
    `^${baseName}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.landroid$`
  );
}

export async function pruneRollingAutoExportSnapshots({
  directoryHandle,
  projectName,
  keepLast = ROLLING_AUTO_EXPORT_KEEP_LAST,
}: {
  directoryHandle: RollingAutoExportDirectoryHandle;
  projectName: string;
  keepLast?: number;
}): Promise<{ deletedFileNames: string[]; skipped: boolean }> {
  if (!directoryHandle.values || !directoryHandle.removeEntry) {
    return { deletedFileNames: [], skipped: true };
  }

  const pattern = rollingAutoExportFileNamePattern(projectName);
  const matchingFileNames: string[] = [];
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file' && pattern.test(entry.name)) {
      matchingFileNames.push(entry.name);
    }
  }

  const keepCount = Math.max(1, Math.trunc(keepLast));
  const deleteFileNames = matchingFileNames
    .sort((left, right) => right.localeCompare(left))
    .slice(keepCount);

  for (const fileName of deleteFileNames) {
    await directoryHandle.removeEntry(fileName);
  }

  return { deletedFileNames: deleteFileNames, skipped: false };
}

export async function writeRollingAutoExportSnapshot(args: {
  directoryHandle: RollingAutoExportDirectoryHandle;
  data: LandroidFileData;
  options?: LandroidFileExportOptions;
  now?: () => Date;
}): Promise<RollingAutoExportWriteResult> {
  await assertRollingAutoExportWritePermission(args.directoryHandle);
  const exportedAt = (args.now ?? (() => new Date()))();
  const fileName = buildRollingAutoExportFileName(
    args.data.projectName,
    exportedAt
  );
  const blob = await exportLandroidFile(args.data, args.options);
  const fileHandle = await args.directoryHandle.getFileHandle(fileName, {
    create: true,
  });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    if (writable.abort) {
      await writable.abort().catch(() => undefined);
    }
    throw error;
  }

  let prunedFileNames: string[] = [];
  let pruneWarning: string | undefined;
  try {
    const pruneResult = await pruneRollingAutoExportSnapshots({
      directoryHandle: args.directoryHandle,
      projectName: args.data.projectName,
    });
    prunedFileNames = pruneResult.deletedFileNames;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pruneWarning = `Auto-export snapshot was written, but old snapshot pruning failed: ${message}`;
  }

  return {
    exportedAt: exportedAt.toISOString(),
    fileName,
    size: blob.size,
    prunedFileNames,
    pruneWarning,
  };
}

function openHandleDb(
  idb: IDBFactory | undefined = getDefaultIndexedDB()
): Promise<IDBDatabase | null> {
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = idb.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        database.createObjectStore(HANDLE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function closeDb(database: IDBDatabase | null): void {
  database?.close();
}

async function withHandleStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
  const database = await openHandleDb();
  if (!database) return null;

  try {
    const transaction = database.transaction(HANDLE_STORE_NAME, mode);
    const store = transaction.objectStore(HANDLE_STORE_NAME);
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const result = await operation(store);
    await completed;
    return result;
  } finally {
    closeDb(database);
  }
}

function putRecord(
  store: IDBObjectStore,
  record: RollingAutoExportDirectoryRecord
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getRecord(
  store: IDBObjectStore
): Promise<RollingAutoExportDirectoryRecord | null> {
  return new Promise((resolve, reject) => {
    const request = store.get(DIRECTORY_HANDLE_ID);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? (result as RollingAutoExportDirectoryRecord) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(store: IDBObjectStore): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.delete(DIRECTORY_HANDLE_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveStoredRollingAutoExportDirectory(
  handle: RollingAutoExportDirectoryHandle,
  now = new Date().toISOString()
): Promise<void> {
  await withHandleStore('readwrite', async (store) => {
    await putRecord(store, {
      id: DIRECTORY_HANDLE_ID,
      directoryHandle: handle,
      directoryName: handle.name,
      lastAutoExportedAt: null,
      lastAutoExportFileName: null,
      updatedAt: now,
    });
  });
}

export async function updateStoredRollingAutoExportMetadata(args: {
  exportedAt: string;
  fileName: string;
  now?: string;
}): Promise<void> {
  await withHandleStore('readwrite', async (store) => {
    const existing = await getRecord(store);
    if (!existing) return;
    await putRecord(store, {
      ...existing,
      lastAutoExportedAt: args.exportedAt,
      lastAutoExportFileName: args.fileName,
      updatedAt: args.now ?? args.exportedAt,
    });
  });
}

export async function loadStoredRollingAutoExportDirectory(): Promise<
  StoredRollingAutoExportDirectory | null
> {
  const record = await withHandleStore('readonly', (store) => getRecord(store));
  if (!record) return null;

  return {
    directoryHandle: record.directoryHandle,
    directoryName: record.directoryName,
    lastAutoExportedAt: record.lastAutoExportedAt,
    lastAutoExportFileName: record.lastAutoExportFileName,
    updatedAt: record.updatedAt,
  };
}

export async function clearStoredRollingAutoExportDirectory(): Promise<void> {
  await withHandleStore('readwrite', async (store) => {
    await deleteRecord(store);
  });
}
