/**
 * Workspace persistence — auto-save to IndexedDB, export/import .landroid files.
 */
import db from './db';
import { deserializeBlob, serializeBlob, type SerializedBlob } from './blob-serialization';
import { PAGE_SIZE_DEFINITIONS } from '../engine/flowchart-pages';
import { Decimal } from '../engine/decimal';
import {
  validateOwnershipGraph,
  type ValidationIssue,
} from '../engine/math-engine';
import { createWorkspaceId } from '../utils/workspace-id';
import {
  normalizeDeskMap,
  normalizeOwnershipNode,
  type OwnershipNode,
  type DeskMap,
} from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';
import type { PageSizeId } from '../types/flowchart';
import {
  normalizeLeaseholdAssignments,
  normalizeLeaseholdOrris,
  normalizeLeaseholdTransferOrderEntries,
  normalizeLeaseholdUnit,
  type LeaseholdAssignment,
  type LeaseholdOrri,
  type LeaseholdTransferOrderEntry,
  type LeaseholdUnit,
} from '../types/leasehold';
import { normalizeLease, type OwnerDoc } from '../types/owner';
import {
  normalizeMapExternalReference,
  type MapAsset,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';
import type { ResearchImport } from '../types/research';
import type { OwnerWorkspaceData } from './owner-persistence';
import type { MapWorkspaceData } from './map-persistence';
import type { ResearchWorkspaceData } from './research-persistence';
import type { CurativeWorkspaceData } from './curative-persistence';
import { normalizeTitleIssues } from '../types/title-issue';

const WORKSPACE_ID = 'default';
const PAGE_SIZE_ID_SET = new Set<PageSizeId>(
  PAGE_SIZE_DEFINITIONS.map((definition) => definition.id)
);

export interface WorkspaceData {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit?: LeaseholdUnit;
  leaseholdAssignments?: LeaseholdAssignment[];
  leaseholdOrris?: LeaseholdOrri[];
  leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
}

export interface LandroidFileData extends WorkspaceData {
  canvas?: CanvasSaveData | null;
  ownerData?: OwnerWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
}

export interface WorkspaceLoadResult {
  status: 'missing' | 'loaded' | 'corrupt';
  data: WorkspaceData | null;
  error: string | null;
}

interface SerializedOwnerDoc extends Omit<OwnerDoc, 'blob'> {
  blob: SerializedBlob;
}

interface SerializedMapAsset extends Omit<MapAsset, 'blob'> {
  blob: SerializedBlob;
}

interface SerializedMapRegion extends MapRegion {}

interface SerializedMapExternalReference extends MapExternalReference {}

interface SerializedResearchImport extends Omit<ResearchImport, 'blob'> {
  blob: SerializedBlob;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function deserializeSerializedBlob(
  serialized: unknown,
  fallbackMimeType = 'application/octet-stream'
): Blob {
  if (
    isRecord(serialized) &&
    typeof serialized.base64 === 'string' &&
    typeof serialized.mimeType === 'string'
  ) {
    return deserializeBlob({
      base64: serialized.base64,
      mimeType: serialized.mimeType,
    });
  }

  return new Blob([], { type: fallbackMimeType });
}

function isPageSizeId(value: unknown): value is PageSizeId {
  return typeof value === 'string' && PAGE_SIZE_ID_SET.has(value as PageSizeId);
}

function normalizeDeskMaps(
  value: unknown,
  nodeIdSet: Set<string>
): DeskMap[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') {
      return [];
    }

    return [
      normalizeDeskMap({
        id: candidate.id,
        name:
          typeof candidate.name === 'string' && candidate.name.trim()
            ? candidate.name
            : `Tract ${index + 1}`,
        code: typeof candidate.code === 'string' ? candidate.code : '',
        tractId: typeof candidate.tractId === 'string' ? candidate.tractId : null,
        grossAcres: candidate.grossAcres,
        pooledAcres: candidate.pooledAcres,
        description: candidate.description,
        nodeIds: readStringArray(candidate.nodeIds).filter((nodeId) =>
          nodeIdSet.has(nodeId)
        ),
      }),
    ];
  });
}

export function normalizeCanvasSaveData(value: unknown): CanvasSaveData | null {
  if (!isRecord(value)) {
    return null;
  }

  const viewport = isRecord(value.viewport)
    && typeof value.viewport.x === 'number'
    && Number.isFinite(value.viewport.x)
    && typeof value.viewport.y === 'number'
    && Number.isFinite(value.viewport.y)
    && typeof value.viewport.zoom === 'number'
    && Number.isFinite(value.viewport.zoom)
      ? {
          x: value.viewport.x,
          y: value.viewport.y,
          zoom: value.viewport.zoom,
        }
      : undefined;

  return {
    nodes: Array.isArray(value.nodes) ? value.nodes : [],
    edges: Array.isArray(value.edges) ? value.edges : [],
    viewport,
    gridCols:
      typeof value.gridCols === 'number' && Number.isFinite(value.gridCols)
        ? value.gridCols
        : undefined,
    gridRows:
      typeof value.gridRows === 'number' && Number.isFinite(value.gridRows)
        ? value.gridRows
        : undefined,
    orientation:
      value.orientation === 'landscape' || value.orientation === 'portrait'
        ? value.orientation
        : undefined,
    pageSize: isPageSizeId(value.pageSize) ? value.pageSize : undefined,
    horizontalSpacingFactor:
      typeof value.horizontalSpacingFactor === 'number'
      && Number.isFinite(value.horizontalSpacingFactor)
        ? value.horizontalSpacingFactor
        : undefined,
    verticalSpacingFactor:
      typeof value.verticalSpacingFactor === 'number'
      && Number.isFinite(value.verticalSpacingFactor)
        ? value.verticalSpacingFactor
        : undefined,
    snapToGrid:
      typeof value.snapToGrid === 'boolean' ? value.snapToGrid : undefined,
    gridSize:
      typeof value.gridSize === 'number' && Number.isFinite(value.gridSize)
        ? value.gridSize
        : undefined,
  };
}

function isFiniteDecimalString(value: string): boolean {
  try {
    return new Decimal(value).isFinite();
  } catch {
    return false;
  }
}

function describeValidationIssue(issue: ValidationIssue | undefined): string {
  if (!issue) {
    return 'ownership graph failed validation';
  }

  const nodeLabel = issue.nodeId ? ` at node ${issue.nodeId}` : '';
  return `${issue.code}${nodeLabel}`;
}

function assertValidOwnershipGraph(
  nodes: OwnershipNode[],
  context: string
): OwnershipNode[] {
  nodes.forEach((node) => {
    if (!isFiniteDecimalString(node.fraction)) {
      throw new Error(`${context}: invalid fraction for node ${node.id}`);
    }
    if (!isFiniteDecimalString(node.initialFraction)) {
      throw new Error(`${context}: invalid initialFraction for node ${node.id}`);
    }
  });

  const validation = validateOwnershipGraph(nodes);
  if (!validation.valid) {
    throw new Error(
      `${context}: invalid ownership graph (${describeValidationIssue(validation.issues[0])})`
    );
  }

  return nodes;
}

function normalizeWorkspaceDataRecord(
  value: Partial<WorkspaceData>,
  context: string
): WorkspaceData {
  if (!Array.isArray(value.nodes)) {
    throw new Error(`${context}: missing nodes array`);
  }

  const rawNodes = value.nodes.filter(
    (node) => isRecord(node) && typeof node.id === 'string'
  );

  if (rawNodes.length !== value.nodes.length) {
    throw new Error(`${context}: nodes array contains invalid entries`);
  }

  const nodes = assertValidOwnershipGraph(
    rawNodes.map((node) =>
      normalizeOwnershipNode(node as Pick<OwnershipNode, 'id'> & Partial<OwnershipNode>)
    ),
    context
  );
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const deskMaps = normalizeDeskMaps(value.deskMaps, nodeIdSet);
  const validDeskMapIds = new Set(deskMaps.map((deskMap) => deskMap.id));
  const activeDeskMapId =
    typeof value.activeDeskMapId === 'string' && validDeskMapIds.has(value.activeDeskMapId)
      ? value.activeDeskMapId
      : deskMaps[0]?.id ?? null;

  return {
    workspaceId: value.workspaceId ?? createWorkspaceId(),
    projectName: value.projectName ?? 'Untitled Workspace',
    nodes,
    deskMaps,
    leaseholdUnit: normalizeLeaseholdUnit(value.leaseholdUnit),
    leaseholdAssignments: normalizeLeaseholdAssignments(value.leaseholdAssignments, {
      validDeskMapIds,
    }),
    leaseholdOrris: normalizeLeaseholdOrris(value.leaseholdOrris, { validDeskMapIds }),
    leaseholdTransferOrderEntries: normalizeLeaseholdTransferOrderEntries(
      value.leaseholdTransferOrderEntries
    ),
    activeDeskMapId,
    instrumentTypes: readStringArray(value.instrumentTypes),
  };
}

export function parsePersistedWorkspaceData(raw: string): WorkspaceData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('saved workspace is not valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new Error('saved workspace payload must be an object');
  }

  return normalizeWorkspaceDataRecord(parsed as Partial<WorkspaceData>, 'Invalid saved workspace');
}

// ── Auto-save to IndexedDB ─────────────────────────────

export async function saveWorkspaceToDb(data: WorkspaceData): Promise<void> {
  await db.workspaces.put({
    id: WORKSPACE_ID,
    projectName: data.projectName,
    data: JSON.stringify(data),
    savedAt: new Date().toISOString(),
  });
}

export async function loadWorkspaceFromDb(): Promise<WorkspaceLoadResult> {
  const record = await db.workspaces.get(WORKSPACE_ID);
  if (!record) {
    return {
      status: 'missing',
      data: null,
      error: null,
    };
  }

  try {
    return {
      status: 'loaded',
      data: parsePersistedWorkspaceData(record.data),
      error: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown corruption';
    return {
      status: 'corrupt',
      data: null,
      error: `Saved workspace could not be restored because ${reason}. LANDroid opened a fresh workspace instead.`,
    };
  }
}

// ── Export .landroid file ───────────────────────────────

async function serializeOwnerData(
  ownerData: OwnerWorkspaceData | undefined
): Promise<
  | undefined
  | {
      owners: OwnerWorkspaceData['owners'];
      leases: OwnerWorkspaceData['leases'];
      contacts: OwnerWorkspaceData['contacts'];
      docs: SerializedOwnerDoc[];
    }
> {
  if (!ownerData) return undefined;

  return {
    owners: ownerData.owners,
    leases: ownerData.leases,
    contacts: ownerData.contacts,
    docs: await Promise.all(
      ownerData.docs.map(async (doc) => ({
        ...doc,
        blob: await serializeBlob(doc.blob),
      }))
    ),
  };
}

async function serializeMapData(
  mapData: MapWorkspaceData | undefined
): Promise<
  | undefined
  | {
      mapAssets: SerializedMapAsset[];
      mapRegions: SerializedMapRegion[];
      mapReferences: SerializedMapExternalReference[];
    }
> {
  if (!mapData) return undefined;

  return {
    mapAssets: await Promise.all(
      mapData.mapAssets.map(async (asset) => ({
        ...asset,
        blob: await serializeBlob(asset.blob),
      }))
    ),
    mapRegions: mapData.mapRegions,
    mapReferences: mapData.mapReferences,
  };
}

async function serializeResearchData(
  researchData: ResearchWorkspaceData | undefined
): Promise<
  | undefined
  | {
      imports: SerializedResearchImport[];
    }
> {
  if (!researchData) return undefined;

  return {
    imports: await Promise.all(
      researchData.imports.map(async (researchImport) => ({
        ...researchImport,
        blob: await serializeBlob(researchImport.blob),
      }))
    ),
  };
}

export async function exportLandroidFile(data: LandroidFileData): Promise<Blob> {
  const payload = {
    version: 6,
    exportedAt: new Date().toISOString(),
    ...data,
    ownerData: await serializeOwnerData(data.ownerData),
    mapData: await serializeMapData(data.mapData),
    researchData: await serializeResearchData(data.researchData),
  };
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function downloadLandroidFile(data: LandroidFileData) {
  const blob = await exportLandroidFile(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.projectName || 'workspace'}.landroid`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import .landroid file ──────────────────────────────

export async function importLandroidFile(file: File): Promise<LandroidFileData> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid .landroid file: not valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid .landroid file: root payload must be an object');
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Invalid .landroid file: missing nodes array');
  }
  const core = normalizeWorkspaceDataRecord(
    parsed as Partial<WorkspaceData>,
    'Invalid .landroid file'
  );
  const workspaceId = core.workspaceId;
  const ownerData =
    isRecord(parsed.ownerData)
      ? {
          owners: Array.isArray(parsed.ownerData.owners) ? parsed.ownerData.owners : [],
          leases: Array.isArray(parsed.ownerData.leases)
            ? parsed.ownerData.leases
                .filter(
                  (
                    lease
                  ): lease is Pick<
                    NonNullable<LandroidFileData['ownerData']>['leases'][number],
                    'id'
                  > &
                    Partial<NonNullable<LandroidFileData['ownerData']>['leases'][number]> =>
                    isRecord(lease) && typeof lease.id === 'string'
                )
                .map((lease) => normalizeLease(lease, { workspaceId }))
            : [],
          contacts: Array.isArray(parsed.ownerData.contacts) ? parsed.ownerData.contacts : [],
          docs: Array.isArray(parsed.ownerData.docs)
            ? parsed.ownerData.docs
                .filter(
                  (doc): doc is SerializedOwnerDoc =>
                    isRecord(doc) && typeof doc.id === 'string'
                )
                .map((doc) => ({
                  ...doc,
                  workspaceId:
                    typeof doc.workspaceId === 'string' ? doc.workspaceId : workspaceId,
                  blob: deserializeSerializedBlob(doc.blob),
                }))
            : [],
        }
      : { owners: [], leases: [], contacts: [], docs: [] };

  const mapData =
    isRecord(parsed.mapData)
      ? {
          mapAssets: Array.isArray(parsed.mapData.mapAssets)
            ? parsed.mapData.mapAssets
                .filter(
                  (asset): asset is SerializedMapAsset =>
                    isRecord(asset) && typeof asset.id === 'string'
                )
                .map((asset) => ({
                  ...asset,
                  workspaceId:
                    typeof asset.workspaceId === 'string'
                      ? asset.workspaceId
                      : workspaceId,
                  blob: deserializeSerializedBlob(asset.blob),
                }))
            : [],
          mapRegions: Array.isArray(parsed.mapData.mapRegions)
            ? parsed.mapData.mapRegions
                .filter(
                  (region): region is SerializedMapRegion =>
                    isRecord(region) && typeof region.id === 'string'
                )
                .map((region) => ({
                  ...region,
                  workspaceId:
                    typeof region.workspaceId === 'string'
                      ? region.workspaceId
                      : workspaceId,
                }))
            : [],
          mapReferences: Array.isArray(parsed.mapData.mapReferences)
            ? parsed.mapData.mapReferences
                .filter(
                  (reference): reference is SerializedMapExternalReference =>
                    isRecord(reference) && typeof reference.id === 'string'
                )
                .map((reference) =>
                  normalizeMapExternalReference({
                    ...reference,
                    workspaceId:
                      typeof reference.workspaceId === 'string'
                        ? reference.workspaceId
                        : workspaceId,
                  })
                )
            : [],
        }
      : { mapAssets: [], mapRegions: [], mapReferences: [] };

  const researchData =
    isRecord(parsed.researchData)
      ? {
          imports: Array.isArray(parsed.researchData.imports)
            ? parsed.researchData.imports
                .filter(
                  (researchImport): researchImport is SerializedResearchImport =>
                    isRecord(researchImport) && typeof researchImport.id === 'string'
                )
                .map((researchImport) => ({
                  ...researchImport,
                  workspaceId:
                    typeof researchImport.workspaceId === 'string'
                      ? researchImport.workspaceId
                      : workspaceId,
                  blob: deserializeSerializedBlob(researchImport.blob),
                }))
            : [],
        }
      : { imports: [] };

  const curativeData =
    isRecord(parsed.curativeData)
      ? {
          titleIssues: normalizeTitleIssues(parsed.curativeData.titleIssues, {
            workspaceId,
          }),
        }
      : { titleIssues: [] };
  return {
    ...core,
    canvas: normalizeCanvasSaveData(parsed.canvas),
    ownerData,
    mapData,
    researchData,
    curativeData,
  };
}
