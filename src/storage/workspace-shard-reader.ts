import type { WorkspaceData } from './workspace-persistence';
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
  monolithData?: WorkspaceData | null;
  monolithError?: string | null;
  /** ISO timestamp of the preserved monolithic backup row, for the recency guard. */
  monolithSavedAt?: string | null;
}

export interface WorkspaceShardReaderOptions {
  validateWorkspaceData?: (data: WorkspaceData) => WorkspaceData;
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

  // Node compat rows have no `recordCounts` entry (not a backend record type),
  // so the integrity count lives on the manifest wrapper. The `?? nodes.length`
  // fallback keeps pre-existing v10 manifests (written without `nodeCount`)
  // loading rather than failing closed.
  const expectedNodeCount = rows.manifest.nodeCount ?? nodes.length;
  if (nodes.length !== expectedNodeCount) {
    throw new Error(
      `ownership node shard count ${nodes.length} did not match manifest count ${expectedNodeCount}`
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
  data: WorkspaceData | null | undefined,
  monolithError: string | null | undefined,
  warning: string | null
): WorkspaceShardReadResult {
  if (!data) {
    if (warning) {
      return {
        status: 'corrupt',
        data: null,
        warning: null,
        error: monolithError
          ? `${warning}; monolithic workspace backup was corrupt: ${monolithError}.`
          : `${warning}; no monolithic workspace backup was available.`,
      };
    }
    if (monolithError) {
      return {
        status: 'corrupt',
        data: null,
        warning: null,
        error: `Saved workspace could not be restored because ${monolithError}.`,
      };
    }
    return {
      status: 'missing',
      data: null,
      warning: null,
      error: null,
    };
  }

  return {
    status: warning ? 'fallback_to_monolith' : 'loaded_from_monolith',
    data,
    warning,
    error: null,
  };
}

export function readWorkspaceFromShardRows(
  rows: WorkspaceShardRows,
  options: WorkspaceShardReaderOptions = {}
): WorkspaceShardReadResult {
  if (!hasAnyShardRows(rows)) {
    return readMonolith(rows.monolithData, rows.monolithError, null);
  }

  try {
    const shards = requireCompleteShardSet(rows);
    // Recency guard. Autosave writes shards, not the monolith, so shards are
    // normally at least as fresh as the preserved backup. If the monolith is
    // strictly newer, the shards are stale (e.g. an older monolith-only build
    // saved after these shards were written). Prefer the newer monolith and
    // warn loudly rather than silently reloading a stale pre-edit snapshot.
    if (
      rows.monolithData
      && rows.monolithSavedAt
      && shards.manifest.backendRecord.lastModified < rows.monolithSavedAt
    ) {
      return readMonolith(
        rows.monolithData,
        rows.monolithError,
        'Workspace shards were older than the preserved monolithic workspace backup. '
          + 'LANDroid restored the newer saved workspace instead'
      );
    }
    const restored = restoreWorkspaceDataFromShards(shards);
    const data = options.validateWorkspaceData
      ? options.validateWorkspaceData(restored)
      : restored;
    return {
      status: 'loaded_from_shards',
      data,
      warning: null,
      error: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown shard error';
    return readMonolith(
      rows.monolithData,
      rows.monolithError,
      `Workspace shards could not be restored because ${reason}. LANDroid restored the preserved monolithic workspace instead`
    );
  }
}
