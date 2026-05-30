import type {
  BackendSpineRecordSource,
  BackendSpineSyncState,
} from '../backend-spine/contracts';
import type { WorkspaceRecord } from './db';
import {
  parsePersistedWorkspaceData,
  type WorkspaceData,
} from './workspace-persistence';
import {
  buildWorkspaceShards,
  restoreWorkspaceDataFromShards,
  type WorkspaceShardSet,
} from './workspace-shards';

export interface WorkspaceRecordShardMigrationOptions {
  projectId?: string;
  revision?: number;
  source?: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
  landroidFileVersion: number;
}

export interface WorkspaceRecordShardMigration {
  workspaceRecordId: string;
  savedAt: string;
  workspaceData: WorkspaceData;
  shards: WorkspaceShardSet;
  rollbackRecord: WorkspaceRecord;
}

export function restoreWorkspaceRecordFromShards(
  shards: WorkspaceShardSet,
  options: {
    id: string;
    savedAt: string;
  }
): WorkspaceRecord {
  const workspaceData = restoreWorkspaceDataFromShards(shards);
  return {
    id: options.id,
    projectName: workspaceData.projectName,
    data: JSON.stringify(workspaceData),
    savedAt: options.savedAt,
  };
}

export function migrateWorkspaceRecordToShards(
  record: WorkspaceRecord,
  options: WorkspaceRecordShardMigrationOptions
): WorkspaceRecordShardMigration {
  const workspaceData = parsePersistedWorkspaceData(record.data);
  const shards = buildWorkspaceShards(workspaceData, {
    projectId: options.projectId,
    lastModified: record.savedAt,
    revision: options.revision,
    source: options.source ?? 'migration',
    syncState: options.syncState,
    landroidFileVersion: options.landroidFileVersion,
    legacyWorkspaceDataJson: record.data,
  });

  return {
    workspaceRecordId: record.id,
    savedAt: record.savedAt,
    workspaceData,
    shards,
    rollbackRecord: restoreWorkspaceRecordFromShards(shards, {
      id: record.id,
      savedAt: record.savedAt,
    }),
  };
}
