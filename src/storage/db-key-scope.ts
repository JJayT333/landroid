import { getWorkspaceDbKey } from './active-workspace-key';

export interface DbKeyScopedRow {
  dbKey?: string;
  workspaceId: string;
}

export type StoredWorkspaceRow<T extends { workspaceId: string }> = T & {
  dbKey?: string;
};

type StorageIdField = 'id' | 'docId' | 'attachmentId';

const STORAGE_ID_SEPARATOR = '::';

export function activeDbKey(): string {
  return getWorkspaceDbKey();
}

export function activeWorkspaceScope(workspaceId: string): [string, string] {
  return [activeDbKey(), workspaceId];
}

export function stampActiveDbKey<T extends { workspaceId: string }>(
  row: T
): StoredWorkspaceRow<T> {
  return { ...row, dbKey: activeDbKey() };
}

export function stampDbKey<T extends { workspaceId: string }>(
  row: T,
  dbKey: string
): StoredWorkspaceRow<T> {
  return { ...row, dbKey };
}

export function storageScopedId(id: string, dbKey: string): string {
  const prefix = `${dbKey}${STORAGE_ID_SEPARATOR}`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

export function activeStorageScopedId(id: string): string {
  return storageScopedId(id, activeDbKey());
}

export function stripStorageScopedId(id: string, dbKey?: string): string {
  if (!dbKey) return id;
  const prefix = `${dbKey}${STORAGE_ID_SEPARATOR}`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

export function stampDbKeyWithStorageId<
  T extends { workspaceId: string } & Record<K, string>,
  K extends StorageIdField,
>(row: T, idField: K, dbKey: string): StoredWorkspaceRow<T> {
  return {
    ...row,
    dbKey,
    [idField]: storageScopedId(row[idField], dbKey),
  };
}

export function stampActiveDbKeyWithStorageId<
  T extends { workspaceId: string } & Record<K, string>,
  K extends StorageIdField,
>(row: T, idField: K): StoredWorkspaceRow<T> {
  return stampDbKeyWithStorageId(row, idField, activeDbKey());
}

export function stripDbKey<T extends { dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  const { dbKey: _dbKey, ...clean } = row;
  return clean;
}

export function stripDbKeyAndStorageId<
  T extends { dbKey?: string } & Record<K, string>,
  K extends StorageIdField,
>(row: T, idField: K): Omit<T, 'dbKey'> {
  const clean = stripDbKey(row) as Omit<T, 'dbKey'>;
  return {
    ...clean,
    [idField]: stripStorageScopedId(row[idField], row.dbKey),
  };
}

export function rowBelongsToActiveDbKey(row: { dbKey?: string }): boolean {
  return row.dbKey === activeDbKey();
}
