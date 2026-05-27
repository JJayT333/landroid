import {
  BACKEND_SPINE_CONTRACT_VERSION,
  DeskMapRecordSchema,
  WorkspaceManifestRecordSchema,
  type BackendSpineRecordSource,
  type BackendSpineSyncState,
  type DeskMapRecord,
  type WorkspaceManifestRecord,
} from '../backend-spine/contracts';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
  LeaseholdUnit,
} from '../types/leasehold';
import type { DeskMap, OwnershipNode } from '../types/node';
import type { WorkspaceData } from './workspace-persistence';

export type WorkspaceShardKind =
  | 'workspace_manifest'
  | 'desk_map'
  | 'ownership_node_compat'
  | 'leasehold_state'
  | 'workspace_ui_state';

export interface WorkspaceShardBuildOptions {
  projectId?: string;
  lastModified: string;
  revision?: number;
  source?: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
  landroidFileVersion: number;
  legacyWorkspaceDataJson?: string;
}

export interface WorkspaceManifestShard {
  id: string;
  shardKind: 'workspace_manifest';
  workspaceId: string;
  projectId: string;
  backendRecord: WorkspaceManifestRecord;
  legacyWorkspaceDataJson?: string;
}

export interface DeskMapShard {
  id: string;
  shardKind: 'desk_map';
  workspaceId: string;
  projectId: string;
  position: number;
  backendRecord: DeskMapRecord;
  deskMap: DeskMap;
}

export interface OwnershipNodeCompatShard {
  id: string;
  shardKind: 'ownership_node_compat';
  workspaceId: string;
  projectId: string;
  position: number;
  localOnly: true;
  node: OwnershipNode;
}

export interface LeaseholdStateShard {
  id: string;
  shardKind: 'leasehold_state';
  workspaceId: string;
  projectId: string;
  localOnly: true;
  leaseholdUnit?: LeaseholdUnit;
  leaseholdAssignments?: LeaseholdAssignment[];
  leaseholdOrris?: LeaseholdOrri[];
  leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
}

export interface WorkspaceUiStateShard {
  id: string;
  shardKind: 'workspace_ui_state';
  workspaceId: string;
  projectId: string;
  localOnly: true;
  activeDeskMapId: string | null;
  activeUnitCode?: string | null;
  instrumentTypes: string[];
}

export interface WorkspaceShardSet {
  manifest: WorkspaceManifestShard;
  deskMaps: DeskMapShard[];
  nodes: OwnershipNodeCompatShard[];
  leaseholdState: LeaseholdStateShard;
  uiState: WorkspaceUiStateShard;
}

export const WORKSPACE_SHARD_STORE_DEFINITIONS = {
  workspaceManifestShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
  deskMapShards:
    'id, workspaceId, projectId, [workspaceId+position], [workspaceId+projectId]',
  ownershipNodeCompatShards:
    'id, workspaceId, projectId, [workspaceId+position], [workspaceId+projectId]',
  leaseholdStateShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
  workspaceUiStateShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
  workspaceWriteLeases: 'workspaceId, ownerTabId, expiresAt',
} as const;

export type WorkspaceShardStoreName = keyof typeof WORKSPACE_SHARD_STORE_DEFINITIONS;

function cloneDeskMap(deskMap: DeskMap): DeskMap {
  return {
    ...deskMap,
    nodeIds: [...deskMap.nodeIds],
    externalRefs: deskMap.externalRefs ? [...deskMap.externalRefs] : undefined,
  };
}

function cloneOwnershipNode(node: OwnershipNode): OwnershipNode {
  return {
    ...node,
    attachments: node.attachments.map((attachment) => ({ ...attachment })),
  };
}

function cloneLeaseholdAssignments(
  entries: LeaseholdAssignment[] | undefined
): LeaseholdAssignment[] | undefined {
  return entries?.map((entry) => ({ ...entry }));
}

function cloneLeaseholdOrris(
  entries: LeaseholdOrri[] | undefined
): LeaseholdOrri[] | undefined {
  return entries?.map((entry) => ({ ...entry }));
}

function cloneLeaseholdTransferOrderEntries(
  entries: LeaseholdTransferOrderEntry[] | undefined
): LeaseholdTransferOrderEntry[] | undefined {
  return entries?.map((entry) => ({ ...entry }));
}

function buildManifestRecord(
  data: WorkspaceData,
  options: Required<
    Pick<
      WorkspaceShardBuildOptions,
      'projectId' | 'lastModified' | 'revision' | 'source' | 'landroidFileVersion'
    >
  > &
    Pick<WorkspaceShardBuildOptions, 'syncState'>
): WorkspaceManifestRecord {
  return WorkspaceManifestRecordSchema.parse({
    recordId: `${data.workspaceId}:workspace-manifest`,
    recordType: 'workspace_manifest',
    workspaceId: data.workspaceId,
    projectId: options.projectId,
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: options.lastModified,
    revision: options.revision,
    source: options.source,
    syncState: options.syncState,
    landroidFileVersion: options.landroidFileVersion,
    projectName: data.projectName || 'Untitled Workspace',
    generatedAt: options.lastModified,
    recordCounts: {
      workspace_manifest: 1,
      desk_map: data.deskMaps.length,
    },
  });
}

function buildDeskMapRecord(
  data: WorkspaceData,
  deskMap: DeskMap,
  options: Required<
    Pick<WorkspaceShardBuildOptions, 'projectId' | 'lastModified' | 'revision' | 'source'>
  > &
    Pick<WorkspaceShardBuildOptions, 'syncState'>
): DeskMapRecord {
  return DeskMapRecordSchema.parse({
    recordId: `${data.workspaceId}:desk-map:${deskMap.id}`,
    recordType: 'desk_map',
    workspaceId: data.workspaceId,
    projectId: options.projectId,
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: options.lastModified,
    revision: options.revision,
    source: options.source,
    syncState: options.syncState,
  });
}

export function buildWorkspaceShards(
  data: WorkspaceData,
  options: WorkspaceShardBuildOptions
): WorkspaceShardSet {
  const projectId = options.projectId ?? data.workspaceId;
  const revision = options.revision ?? 0;
  const source = options.source ?? 'migration';
  const buildOptions = {
    projectId,
    lastModified: options.lastModified,
    revision,
    source,
    syncState: options.syncState,
    landroidFileVersion: options.landroidFileVersion,
  };

  return {
    manifest: {
      id: `${data.workspaceId}:workspace-manifest`,
      shardKind: 'workspace_manifest',
      workspaceId: data.workspaceId,
      projectId,
      backendRecord: buildManifestRecord(data, buildOptions),
      legacyWorkspaceDataJson: options.legacyWorkspaceDataJson,
    },
    deskMaps: data.deskMaps.map((deskMap, position) => ({
      id: `${data.workspaceId}:desk-map:${deskMap.id}`,
      shardKind: 'desk_map',
      workspaceId: data.workspaceId,
      projectId,
      position,
      backendRecord: buildDeskMapRecord(data, deskMap, buildOptions),
      deskMap: cloneDeskMap(deskMap),
    })),
    nodes: data.nodes.map((node, position) => ({
      id: `${data.workspaceId}:ownership-node-compat:${node.id}`,
      shardKind: 'ownership_node_compat',
      workspaceId: data.workspaceId,
      projectId,
      position,
      localOnly: true,
      node: cloneOwnershipNode(node),
    })),
    leaseholdState: {
      id: `${data.workspaceId}:leasehold-state`,
      shardKind: 'leasehold_state',
      workspaceId: data.workspaceId,
      projectId,
      localOnly: true,
      leaseholdUnit: data.leaseholdUnit ? { ...data.leaseholdUnit } : undefined,
      leaseholdAssignments: cloneLeaseholdAssignments(data.leaseholdAssignments),
      leaseholdOrris: cloneLeaseholdOrris(data.leaseholdOrris),
      leaseholdTransferOrderEntries: cloneLeaseholdTransferOrderEntries(
        data.leaseholdTransferOrderEntries
      ),
    },
    uiState: {
      id: `${data.workspaceId}:workspace-ui-state`,
      shardKind: 'workspace_ui_state',
      workspaceId: data.workspaceId,
      projectId,
      localOnly: true,
      activeDeskMapId: data.activeDeskMapId,
      activeUnitCode: data.activeUnitCode,
      instrumentTypes: [...data.instrumentTypes],
    },
  };
}

export function restoreWorkspaceDataFromShards(
  shards: WorkspaceShardSet
): WorkspaceData {
  return {
    workspaceId: shards.manifest.workspaceId,
    projectName: shards.manifest.backendRecord.projectName,
    nodes: [...shards.nodes]
      .sort((left, right) => left.position - right.position)
      .map((row) => cloneOwnershipNode(row.node)),
    deskMaps: [...shards.deskMaps]
      .sort((left, right) => left.position - right.position)
      .map((row) => cloneDeskMap(row.deskMap)),
    leaseholdUnit: shards.leaseholdState.leaseholdUnit
      ? { ...shards.leaseholdState.leaseholdUnit }
      : undefined,
    leaseholdAssignments: cloneLeaseholdAssignments(
      shards.leaseholdState.leaseholdAssignments
    ),
    leaseholdOrris: cloneLeaseholdOrris(shards.leaseholdState.leaseholdOrris),
    leaseholdTransferOrderEntries: cloneLeaseholdTransferOrderEntries(
      shards.leaseholdState.leaseholdTransferOrderEntries
    ),
    activeDeskMapId: shards.uiState.activeDeskMapId,
    activeUnitCode: shards.uiState.activeUnitCode,
    instrumentTypes: [...shards.uiState.instrumentTypes],
  };
}
