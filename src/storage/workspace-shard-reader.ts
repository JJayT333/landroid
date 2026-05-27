import type { WorkspaceRecord } from './db';
import {
  parsePersistedWorkspaceData,
  type WorkspaceData,
} from './workspace-persistence';
import {
  restoreWorkspaceDataFromShards,
  type DeskMapShard,
  type LeaseholdStateShard,
  type OwnershipNodeCompatShard,
  type WorkspaceManifestShard,
  type WorkspaceShardSet,
  type WorkspaceUiStateShard,
} from './workspace-shards';

export interface WorkspaceShardRows {
  manifest?: WorkspaceManifestShard | null;
  deskMaps?: DeskMapShard[];
  nodes?: OwnershipNodeCompatShard[];
  leaseholdState?: LeaseholdStateShard | null;
  uiState?: WorkspaceUiStateShard | null;
  monolith?: WorkspaceRecord | null;
}

export type WorkspaceShardReadResult =
  | {
      status: 'missing';
      data: null;
      warning: null;
      error: null;
    }
  | {
      status: 'loaded_from_shards' | 'loaded_from_monolith' | 'fallback_to_monolith';
      data: WorkspaceData;
      warning: string | null;
      error: null;
    }
  | {
      status: 'corrupt';
      data: null;
      warning: null;
      error: string;
    };

function hasAnyShardRows(rows: WorkspaceShardRows): boolean {
  return Boolean(
    rows.manifest
    || rows.leaseholdState
    || rows.uiState
    || (rows.deskMaps?.length ?? 0) > 0
    || (rows.nodes?.length ?? 0) > 0
  );
}

function requireCompleteShardSet(rows: WorkspaceShardRows): WorkspaceShardSet {
  if (!rows.manifest) {
    throw new Error('workspace manifest shard is missing');
  }
  if (!rows.leaseholdState) {
    throw new Error('leasehold state shard is missing');
  }
  if (!rows.uiState) {
    throw new Error('workspace UI state shard is missing');
  }

  const workspaceId = rows.manifest.workspaceId;
  const deskMaps = rows.deskMaps ?? [];
  const nodes = rows.nodes ?? [];
  const allRows = [...deskMaps, ...nodes, rows.leaseholdState, rows.uiState];
  const mismatched = allRows.find((row) => row.workspaceId !== workspaceId);
  if (mismatched) {
    throw new Error(
      `shard ${mismatched.id} belongs to workspace ${mismatched.workspaceId}, expected ${workspaceId}`
    );
  }

  const expectedDeskMapCount =
    rows.manifest.backendRecord.recordCounts.desk_map ?? deskMaps.length;
  if (deskMaps.length !== expectedDeskMapCount) {
    throw new Error(
      `desk map shard count ${deskMaps.length} did not match manifest count ${expectedDeskMapCount}`
    );
  }

  return {
    manifest: rows.manifest,
    deskMaps,
    nodes,
    leaseholdState: rows.leaseholdState,
    uiState: rows.uiState,
  };
}

function readMonolith(
  record: WorkspaceRecord | null | undefined,
  warning: string | null
): WorkspaceShardReadResult {
  if (!record) {
    if (warning) {
      return {
        status: 'corrupt',
        data: null,
        warning: null,
        error: `${warning}; no monolithic workspace backup was available.`,
      };
    }
    return {
      status: 'missing',
      data: null,
      warning: null,
      error: null,
    };
  }

  try {
    return {
      status: warning ? 'fallback_to_monolith' : 'loaded_from_monolith',
      data: parsePersistedWorkspaceData(record.data),
      warning,
      error: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown corruption';
    return {
      status: 'corrupt',
      data: null,
      warning: null,
      error: warning
        ? `${warning}; monolithic workspace backup was corrupt: ${reason}.`
        : `Saved workspace could not be restored because ${reason}.`,
    };
  }
}

export function readWorkspaceFromShardRows(
  rows: WorkspaceShardRows
): WorkspaceShardReadResult {
  if (!hasAnyShardRows(rows)) {
    return readMonolith(rows.monolith, null);
  }

  try {
    const shards = requireCompleteShardSet(rows);
    const data = parsePersistedWorkspaceData(
      JSON.stringify(restoreWorkspaceDataFromShards(shards))
    );
    return {
      status: 'loaded_from_shards',
      data,
      warning: null,
      error: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown shard error';
    return readMonolith(
      rows.monolith,
      `Workspace shards could not be restored because ${reason}. LANDroid restored the preserved monolithic workspace instead`
    );
  }
}
