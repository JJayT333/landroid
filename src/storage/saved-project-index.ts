import db, { type SavedProjectRecord } from './db';
import {
  getProjectIndexDbKey,
  getWorkspaceDbKey,
  makeProjectWorkspaceDbKey,
} from './active-workspace-key';
import { storageScopedId } from './db-key-scope';

export interface SavedProjectSummary {
  workspaceId: string;
  workspaceDbKey: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

interface SavedProjectUpsert {
  workspaceId: string;
  projectName: string;
  workspaceDbKey?: string;
  updatedAt?: string;
  openedAt?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function savedProjectStorageId(indexDbKey: string, workspaceId: string): string {
  return storageScopedId(workspaceId, indexDbKey);
}

export function normalizeSavedProjectName(
  value: string,
  fallback = 'Untitled Workspace'
): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toSummary(record: SavedProjectRecord): SavedProjectSummary {
  return {
    workspaceId: record.workspaceId,
    workspaceDbKey: record.workspaceDbKey,
    projectName: record.projectName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastOpenedAt: record.lastOpenedAt,
  };
}

function sortSavedProjects(
  left: SavedProjectRecord,
  right: SavedProjectRecord
): number {
  return right.lastOpenedAt.localeCompare(left.lastOpenedAt)
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.projectName.localeCompare(right.projectName);
}

export async function listSavedProjects(): Promise<SavedProjectSummary[]> {
  const indexDbKey = getProjectIndexDbKey();
  const rows = await db.savedProjects.where('indexDbKey').equals(indexDbKey).toArray();
  return rows.sort(sortSavedProjects).map(toSummary);
}

export async function getSavedProject(
  workspaceId: string
): Promise<SavedProjectSummary | null> {
  const indexDbKey = getProjectIndexDbKey();
  const row = await db.savedProjects.get(savedProjectStorageId(indexDbKey, workspaceId));
  return row && row.indexDbKey === indexDbKey ? toSummary(row) : null;
}

export async function getMostRecentSavedProject(): Promise<SavedProjectSummary | null> {
  const rows = await listSavedProjects();
  return rows[0] ?? null;
}

export async function createSavedProjectIndexRecord(
  workspaceId: string,
  projectName: string,
  timestamp = nowIso()
): Promise<SavedProjectSummary> {
  const indexDbKey = getProjectIndexDbKey();
  const record: SavedProjectRecord = {
    id: savedProjectStorageId(indexDbKey, workspaceId),
    indexDbKey,
    workspaceId,
    workspaceDbKey: makeProjectWorkspaceDbKey(workspaceId, indexDbKey),
    projectName: normalizeSavedProjectName(projectName),
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
  };
  await db.savedProjects.put(record);
  return toSummary(record);
}

export async function upsertSavedProjectFromWorkspace({
  workspaceId,
  projectName,
  workspaceDbKey,
  updatedAt = nowIso(),
  openedAt,
}: SavedProjectUpsert): Promise<SavedProjectSummary> {
  const indexDbKey = getProjectIndexDbKey();
  const id = savedProjectStorageId(indexDbKey, workspaceId);
  const existing = await db.savedProjects.get(id);
  const resolvedWorkspaceDbKey =
    workspaceDbKey
    ?? existing?.workspaceDbKey
    ?? getWorkspaceDbKey();
  const record: SavedProjectRecord = {
    id,
    indexDbKey,
    workspaceId,
    workspaceDbKey: resolvedWorkspaceDbKey,
    projectName: normalizeSavedProjectName(projectName),
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
    lastOpenedAt: openedAt ?? existing?.lastOpenedAt ?? updatedAt,
  };
  await db.savedProjects.put(record);
  return toSummary(record);
}

export async function markSavedProjectOpened(
  workspaceId: string,
  openedAt = nowIso()
): Promise<SavedProjectSummary | null> {
  const current = await getSavedProject(workspaceId);
  if (!current) return null;
  return upsertSavedProjectFromWorkspace({
    ...current,
    updatedAt: current.updatedAt,
    openedAt,
  });
}

export async function renameSavedProjectIndexRecord(
  workspaceId: string,
  projectName: string,
  updatedAt = nowIso()
): Promise<SavedProjectSummary | null> {
  const current = await getSavedProject(workspaceId);
  if (!current) return null;
  return upsertSavedProjectFromWorkspace({
    ...current,
    projectName: normalizeSavedProjectName(projectName),
    updatedAt,
  });
}

export async function deleteSavedProjectIndexRecord(
  workspaceId: string
): Promise<void> {
  const indexDbKey = getProjectIndexDbKey();
  await db.savedProjects.delete(savedProjectStorageId(indexDbKey, workspaceId));
}
