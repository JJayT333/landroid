import db from './db';
import { storageScopedId, stripStorageScopedId } from './db-key-scope';
import { LANDROID_FILE_VERSION } from './landroid-file-version';
import { parsePersistedCanvasData } from './canvas-persistence';
import {
  parsePersistedWorkspaceData,
  type WorkspaceData,
  type WorkspaceLoadResult,
} from './workspace-persistence';
import { readWorkspaceFromShardRows } from './workspace-shard-reader';
import { buildWorkspaceShards } from './workspace-shards';
import {
  deleteSavedProjectIndexRecord,
  upsertSavedProjectFromWorkspace,
  type SavedProjectSummary,
} from './saved-project-index';
import type { CanvasSaveData } from '../store/canvas-store';

type IdField = 'id' | 'docId' | 'attachmentId';
type RowWithDbKey = { dbKey?: string; workspaceId: string } & Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function projectCanvasDbKey(workspaceDbKey: string): string {
  return workspaceDbKey === 'default' ? 'active-canvas' : `${workspaceDbKey}-canvas`;
}

function scope(dbKey: string, workspaceId: string): [string, string] {
  return [dbKey, workspaceId];
}

function retargetStorageId(
  value: unknown,
  sourceDbKey: string,
  targetDbKey: string
): unknown {
  return typeof value === 'string'
    ? storageScopedId(stripStorageScopedId(value, sourceDbKey), targetDbKey)
    : value;
}

function retargetRow<T extends RowWithDbKey>(
  row: T,
  sourceDbKey: string,
  targetDbKey: string,
  targetWorkspaceId: string,
  idField: IdField
): T {
  return {
    ...row,
    dbKey: targetDbKey,
    workspaceId: targetWorkspaceId,
    [idField]: retargetStorageId(row[idField], sourceDbKey, targetDbKey),
  } as T;
}

async function copyWorkspaceRows<T extends RowWithDbKey>(
  table: {
    where(index: string): {
      equals(value: [string, string]): { toArray(): Promise<T[]>; delete(): Promise<number> };
    };
    bulkPut(rows: T[]): Promise<unknown>;
  },
  source: SavedProjectSummary,
  targetDbKey: string,
  targetWorkspaceId: string,
  idField: IdField
): Promise<void> {
  const rows = await table
    .where('[dbKey+workspaceId]')
    .equals(scope(source.workspaceDbKey, source.workspaceId))
    .toArray();
  if (rows.length === 0) return;
  await table.bulkPut(
    rows.map((row) =>
      retargetRow(row, source.workspaceDbKey, targetDbKey, targetWorkspaceId, idField)
    )
  );
}

async function clearWorkspaceRows(
  table: {
    where(index: string): {
      equals(value: [string, string]): { delete(): Promise<number> };
    };
  },
  workspaceDbKey: string,
  workspaceId: string
): Promise<void> {
  await table.where('[dbKey+workspaceId]').equals(scope(workspaceDbKey, workspaceId)).delete();
}

function parseMonolithRecord(
  data: string | undefined
): { data: WorkspaceData | null; error: string | null } {
  if (!data) return { data: null, error: null };
  try {
    return { data: parsePersistedWorkspaceData(data), error: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown corruption';
    return { data: null, error: reason };
  }
}

export async function loadProjectWorkspace(
  project: SavedProjectSummary
): Promise<WorkspaceLoadResult> {
  const record = await db.workspaces.get(project.workspaceDbKey);
  const monolith = parseMonolithRecord(record?.data);
  const shardRows = await loadProjectShardRows(project);
  const readResult = readWorkspaceFromShardRows(
    {
      ...shardRows,
      monolithData: monolith.data,
      monolithError: monolith.error,
      monolithSavedAt: record?.savedAt ?? null,
    },
    {
      validateWorkspaceData: (data) =>
        parsePersistedWorkspaceData(JSON.stringify(data)),
    }
  );

  if (readResult.status === 'missing') {
    return { status: 'missing', data: null, error: null, warning: null, source: null };
  }
  if (readResult.status !== 'corrupt') {
    return {
      status: 'loaded',
      data: readResult.data,
      error: null,
      warning: readResult.warning,
      source: readResult.status === 'loaded_from_shards' ? 'shards' : 'monolith',
    };
  }
  return {
    status: 'corrupt',
    data: null,
    error: `${readResult.error} LANDroid opened a fresh workspace instead.`,
    warning: null,
    source: null,
  };
}

async function loadProjectShardRows(project: SavedProjectSummary) {
  const [manifests, deskMaps, nodes, leaseholdStates, uiStates] = await Promise.all([
    db.workspaceManifestShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
    db.deskMapShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
    db.ownershipNodeCompatShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
    db.leaseholdStateShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
    db.workspaceUiStateShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
  ]);

  return {
    manifest: manifests[0] ?? null,
    deskMaps,
    nodes,
    leaseholdState: leaseholdStates[0] ?? null,
    uiState: uiStates[0] ?? null,
  };
}

export async function saveProjectWorkspaceSnapshot(
  data: WorkspaceData,
  workspaceDbKey: string,
  savedAt = nowIso()
): Promise<void> {
  const shards = buildWorkspaceShards(data, {
    lastModified: savedAt,
    landroidFileVersion: LANDROID_FILE_VERSION,
    source: 'local',
    syncState: 'local_only',
  });
  const manifest = {
    ...shards.manifest,
    id: storageScopedId(shards.manifest.id, workspaceDbKey),
    dbKey: workspaceDbKey,
  };
  const deskMaps = shards.deskMaps.map((row) => ({
    ...row,
    id: storageScopedId(row.id, workspaceDbKey),
    dbKey: workspaceDbKey,
  }));
  const nodes = shards.nodes.map((row) => ({
    ...row,
    id: storageScopedId(row.id, workspaceDbKey),
    dbKey: workspaceDbKey,
  }));
  const leaseholdState = {
    ...shards.leaseholdState,
    id: storageScopedId(shards.leaseholdState.id, workspaceDbKey),
    dbKey: workspaceDbKey,
  };
  const uiState = {
    ...shards.uiState,
    id: storageScopedId(shards.uiState.id, workspaceDbKey),
    dbKey: workspaceDbKey,
  };

  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.workspaceManifestShards,
      db.deskMapShards,
      db.ownershipNodeCompatShards,
      db.leaseholdStateShards,
      db.workspaceUiStateShards,
    ],
    async () => {
      await clearWorkspaceRows(db.workspaceManifestShards, workspaceDbKey, data.workspaceId);
      await clearWorkspaceRows(db.deskMapShards, workspaceDbKey, data.workspaceId);
      await clearWorkspaceRows(db.ownershipNodeCompatShards, workspaceDbKey, data.workspaceId);
      await clearWorkspaceRows(db.leaseholdStateShards, workspaceDbKey, data.workspaceId);
      await clearWorkspaceRows(db.workspaceUiStateShards, workspaceDbKey, data.workspaceId);
      await db.workspaceManifestShards.put(manifest);
      if (deskMaps.length > 0) await db.deskMapShards.bulkPut(deskMaps);
      if (nodes.length > 0) await db.ownershipNodeCompatShards.bulkPut(nodes);
      await db.leaseholdStateShards.put(leaseholdState);
      await db.workspaceUiStateShards.put(uiState);
      await db.workspaces.put({
        id: workspaceDbKey,
        projectName: data.projectName,
        data: JSON.stringify(data),
        savedAt,
      });
    }
  );

  await upsertSavedProjectFromWorkspace({
    workspaceId: data.workspaceId,
    projectName: data.projectName,
    workspaceDbKey,
    updatedAt: savedAt,
  });
}

export async function loadProjectCanvas(
  project: SavedProjectSummary
): Promise<CanvasSaveData | null> {
  const record = await db.canvases.get(projectCanvasDbKey(project.workspaceDbKey));
  if (!record) return null;
  return parsePersistedCanvasData(record.data);
}

export async function saveProjectCanvas(
  data: CanvasSaveData,
  workspaceDbKey: string,
  savedAt = nowIso()
): Promise<void> {
  await db.canvases.put({
    id: projectCanvasDbKey(workspaceDbKey),
    data: JSON.stringify(data),
    savedAt,
  });
}

export async function renameProjectInStorage(
  project: SavedProjectSummary,
  projectName: string,
  updatedAt = nowIso()
): Promise<SavedProjectSummary> {
  const cleanName = projectName.trim() || 'Untitled Workspace';
  const [manifestRows, workspaceRecord] = await Promise.all([
    db.workspaceManifestShards
      .where('[dbKey+workspaceId]')
      .equals(scope(project.workspaceDbKey, project.workspaceId))
      .toArray(),
    db.workspaces.get(project.workspaceDbKey),
  ]);

  await db.transaction('rw', db.workspaceManifestShards, db.workspaces, async () => {
    for (const manifest of manifestRows) {
      await db.workspaceManifestShards.put({
        ...manifest,
        backendRecord: {
          ...manifest.backendRecord,
          projectName: cleanName,
          lastModified: updatedAt,
        },
      });
    }
    if (workspaceRecord) {
      const monolith = parseMonolithRecord(workspaceRecord.data).data;
      await db.workspaces.put({
        ...workspaceRecord,
        projectName: cleanName,
        data: monolith
          ? JSON.stringify({ ...monolith, projectName: cleanName })
          : workspaceRecord.data,
        savedAt: updatedAt,
      });
    }
  });

  return upsertSavedProjectFromWorkspace({
    workspaceId: project.workspaceId,
    workspaceDbKey: project.workspaceDbKey,
    projectName: cleanName,
    updatedAt,
  });
}

export async function deleteProjectStorage(project: SavedProjectSummary): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.canvases,
      db.savedProjects,
      db.workspaceWriteLeases,
      db.workspaceManifestShards,
      db.deskMapShards,
      db.ownershipNodeCompatShards,
      db.leaseholdStateShards,
      db.workspaceUiStateShards,
      db.owners,
      db.leases,
      db.contactLogs,
      db.ownerDocs,
      db.mapAssets,
      db.mapRegions,
      db.mapExternalReferences,
      db.researchImports,
      db.researchSources,
      db.researchFormulas,
      db.researchProjectRecords,
      db.researchQuestions,
      db.titleIssues,
      db.documents,
      db.document_attachments,
      db.titleActionRecords,
      db.titleAuditEvents,
    ],
    async () => {
      await clearWorkspaceRows(db.workspaceManifestShards, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.deskMapShards, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.ownershipNodeCompatShards, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.leaseholdStateShards, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.workspaceUiStateShards, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.owners, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.leases, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.contactLogs, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.ownerDocs, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.mapAssets, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.mapRegions, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.mapExternalReferences, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.researchImports, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.researchSources, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.researchFormulas, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.researchProjectRecords, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.researchQuestions, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.titleIssues, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.documents, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.document_attachments, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.titleActionRecords, project.workspaceDbKey, project.workspaceId);
      await clearWorkspaceRows(db.titleAuditEvents, project.workspaceDbKey, project.workspaceId);
      await db.workspaces.delete(project.workspaceDbKey);
      await db.canvases.delete(projectCanvasDbKey(project.workspaceDbKey));
      await db.workspaceWriteLeases.delete(project.workspaceId);
    }
  );
  await deleteSavedProjectIndexRecord(project.workspaceId);
}

export async function duplicateProjectStorage(
  source: SavedProjectSummary,
  target: SavedProjectSummary,
  workspace: WorkspaceData,
  canvas: CanvasSaveData | null,
  createdAt = nowIso()
): Promise<void> {
  await saveProjectWorkspaceSnapshot(workspace, target.workspaceDbKey, createdAt);
  if (canvas) await saveProjectCanvas(canvas, target.workspaceDbKey, createdAt);

  await copyWorkspaceRows(db.owners, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.leases, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.contactLogs, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.ownerDocs, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.mapAssets, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.mapRegions, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.mapExternalReferences, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.researchImports, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.researchSources, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.researchFormulas, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.researchProjectRecords, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.researchQuestions, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.titleIssues, source, target.workspaceDbKey, target.workspaceId, 'id');
  await copyWorkspaceRows(db.documents, source, target.workspaceDbKey, target.workspaceId, 'docId');
  await copyWorkspaceRows(
    db.document_attachments,
    source,
    target.workspaceDbKey,
    target.workspaceId,
    'attachmentId'
  );
}
