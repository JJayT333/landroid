/**
 * Workspace persistence — auto-save to IndexedDB, export/import .landroid files.
 */
import db, { type CanvasAssetRecord, type PdfAttachment, type WorkspaceRecord } from './db';
import {
  deserializeBlob,
  deserializePdfBlob,
  emptyPdfBlob,
  serializeBlob,
  type SerializedBlob,
} from './blob-serialization';
import { PDF_MIME_TYPE } from '../utils/pdf-validation';
import {
  isDocumentEntityKind,
  isDocumentArea,
  isDocumentOcrStatus,
  normalizeDocumentKind,
  type DocumentAttachment,
  type DocumentRecord,
} from '../types/document';
import { normalizeExternalRefs } from '../types/external-ref';
import {
  migratePdfsToDocuments,
  type DocumentMigrationDeps,
} from './document-migration';
import { sha256HexOfBlob } from './blob-hash';
import { PAGE_SIZE_DEFINITIONS } from '../engine/flowchart-pages';
import { Decimal } from '../engine/decimal';
import {
  validateOwnershipGraph,
  type ValidationIssue,
} from '../title-math';
import { createWorkspaceId } from '../utils/workspace-id';
import { assertFileSize, FILE_SIZE_LIMITS } from '../utils/file-validation';
import {
  normalizeDeskMap,
  normalizeOwnershipNode,
  type OwnershipNode,
  type DeskMap,
} from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';
import { withQuotaErrorReporting } from '../store/storage-health-store';
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
import {
  normalizeLease,
  DOC_CATEGORY_OPTIONS,
  type ContactLog,
  type Owner,
  type OwnerDoc,
} from '../types/owner';
import { normalizeLeasePurchaseReport } from '../types/lease-purchase-report';
import {
  normalizeMapExternalReference,
  MAP_ASSET_KIND_OPTIONS,
  MAP_REGION_STATUS_OPTIONS,
  type MapAsset,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';
import {
  normalizeResearchFormula,
  normalizeResearchProjectRecord,
  normalizeResearchQuestion,
  normalizeResearchSource,
  sanitizeResearchLinks,
  RESEARCH_IMPORT_FORMAT_OPTIONS,
  type ResearchFormula,
  type ResearchImport,
  type ResearchProjectRecord,
  type ResearchQuestion,
  type ResearchSource,
} from '../types/research';
import type { OwnerWorkspaceData } from './owner-persistence';
import type { MapWorkspaceData } from './map-persistence';
import type { ResearchWorkspaceData } from './research-persistence';
import type { CurativeWorkspaceData } from './curative-persistence';
import { normalizeTitleIssues, type TitleIssue } from '../types/title-issue';
import { resolveActiveUnitCode } from '../utils/desk-map-units';
import { getProjectIndexDbKey, getWorkspaceDbKey } from './active-workspace-key';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stampDbKeyWithStorageId,
  stripDbKeyAndStorageId,
  stripStorageScopedId,
} from './db-key-scope';
import { LANDROID_FILE_VERSION } from './landroid-file-version';
import { upsertSavedProjectFromWorkspace } from './saved-project-index';
import {
  type ActionRecord,
  type AuditEventRecord,
} from '../backend-spine/contracts';
import {
  appendActionLayerToRecordBundle,
  assertActionLayerExportAllowed,
} from '../project-records/action-layer/persistence';
import { verifyAuditChain } from '../project-records/action-layer/audit-chain';
import {
  buildProjectRecordBundle,
  ProjectRecordBundleSchema,
  type ProjectRecordBundle,
} from '../project-records/record-validation';
import { readWorkspaceFromShardRows } from './workspace-shard-reader';
import { buildWorkspaceShards } from './workspace-shards';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWritable,
} from './workspace-write-lease';
export { LANDROID_FILE_VERSION } from './landroid-file-version';
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
  activeUnitCode?: string | null;
  instrumentTypes: string[];
}

export interface LandroidFileData extends WorkspaceData {
  canvas?: CanvasSaveData | null;
  actionLedger?: ProjectRecordBundle;
  /**
   * Document payload introduced in v8 (Phase 5 / ADR 0004). v7 imports are
   * migrated inline by {@link importLandroidFile} so callers never see a
   * `pdfData`-only file.
   */
  documentData?: DocumentWorkspaceData;
  /**
   * Set by {@link importLandroidFile} when one or more imported documents
   * failed SHA-256 fixity verification (DA-H7). Surfaced as a dismissible
   * startup warning; the recomputed hashes are already stored.
   */
  documentFixityWarning?: string;
  ownerData?: OwnerWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  /**
   * Content-addressed image blobs referenced by flowchart image nodes (v15+).
   * Optional and additive: older `.landroid` files lack it and import fine; a
   * referenced-but-missing asset degrades to an "image unavailable" placeholder
   * rather than failing the import.
   */
  canvasAssetData?: CanvasAssetWorkspaceData;
}

export interface CanvasAssetWorkspaceData {
  assets: CanvasAssetRecord[];
}

export interface LandroidFileExportOptions {
  actionRecords?: readonly ActionRecord[];
  auditEvents?: readonly AuditEventRecord[];
}

export interface DocumentWorkspaceData {
  documents: DocumentRecord[];
  attachments: DocumentAttachment[];
}

export interface WorkspaceLoadResult {
  status: 'missing' | 'loaded' | 'corrupt';
  data: WorkspaceData | null;
  error: string | null;
  warning: string | null;
  source: 'shards' | 'monolith' | null;
}

interface SerializedOwnerDoc extends Omit<OwnerDoc, 'blob'> {
  blob: SerializedBlob;
}

export interface PdfWorkspaceData {
  pdfs: PdfAttachment[];
}

interface SerializedPdfAttachment extends Omit<PdfAttachment, 'blob'> {
  blob: SerializedBlob;
}

interface SerializedDocumentRecord extends Omit<DocumentRecord, 'blob'> {
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

interface SerializedResearchSource extends ResearchSource {}

interface SerializedResearchFormula extends ResearchFormula {}

interface SerializedResearchProjectRecord extends ResearchProjectRecord {}

interface SerializedResearchQuestion extends ResearchQuestion {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Audit M3: owner/contact normalization for .landroid import.
 *
 * The old import path spread raw owner/contact objects straight into
 * replaceOwnerWorkspaceData, which meant a corrupt or malicious file could
 * inject entries with missing IDs, non-string fields, or prototype-polluting
 * shapes. Now every record is coerced through a shape-checked normalizer:
 * records missing the required id are dropped, and string fields fall back
 * to '' so downstream code can trust their type.
 */
function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeOwnerRecord(
  raw: unknown,
  workspaceId: string
): Owner | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    name: stringOr(raw.name, ''),
    entityType: stringOr(raw.entityType, ''),
    county: stringOr(raw.county, ''),
    prospect: stringOr(raw.prospect, ''),
    mailingAddress: stringOr(raw.mailingAddress, ''),
    email: stringOr(raw.email, ''),
    phone: stringOr(raw.phone, ''),
    notes: stringOr(raw.notes, ''),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
}

function normalizeContactRecord(
  raw: unknown,
  workspaceId: string
): ContactLog | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  if (typeof raw.ownerId !== 'string' || raw.ownerId === '') return null;
  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    ownerId: raw.ownerId,
    contactDate: stringOr(raw.contactDate, ''),
    method: stringOr(raw.method, ''),
    subject: stringOr(raw.subject, ''),
    outcome: stringOr(raw.outcome, ''),
    notes: stringOr(raw.notes, ''),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
}

function nullableStringOr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function optionOr<T extends readonly string[]>(
  options: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? value
    : fallback;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * DA-L8 (pt 2): field-by-field normalizers for the blob-bearing side stores on
 * .landroid import. These previously raw-spread (`{ ...raw, workspaceId, blob }`),
 * so a hand-edited file could smuggle arbitrary extra keys into Dexie and back
 * out on re-export. Like normalizeOwnerRecord above, each returns a fresh object
 * with ONLY known fields (authoritative shape = the `createBlank*` factories in
 * types/*.ts); unknown keys are dropped and the blob is deserialized here.
 * Records missing a string `id` are filtered out by the callers.
 */
function normalizeImportedOwnerDoc(raw: unknown, workspaceId: string): OwnerDoc | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    ownerId: stringOr(raw.ownerId, ''),
    leaseId: nullableStringOr(raw.leaseId),
    fileName: stringOr(raw.fileName, ''),
    mimeType: stringOr(raw.mimeType, 'application/octet-stream'),
    category: optionOr(DOC_CATEGORY_OPTIONS, raw.category, 'Other'),
    notes: stringOr(raw.notes, ''),
    blob: deserializeSerializedBlob(raw.blob),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
}

function normalizeImportedMapAsset(raw: unknown, workspaceId: string): MapAsset | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    title: stringOr(raw.title, ''),
    kind: optionOr(MAP_ASSET_KIND_OPTIONS, raw.kind, 'Other'),
    fileName: stringOr(raw.fileName, ''),
    mimeType: stringOr(raw.mimeType, 'application/octet-stream'),
    notes: stringOr(raw.notes, ''),
    presentationSummary: stringOr(raw.presentationSummary, ''),
    isFeatured: raw.isFeatured === true,
    deskMapId: nullableStringOr(raw.deskMapId),
    nodeId: nullableStringOr(raw.nodeId),
    linkedOwnerId: nullableStringOr(raw.linkedOwnerId),
    leaseId: nullableStringOr(raw.leaseId),
    researchSourceId: nullableStringOr(raw.researchSourceId),
    researchProjectRecordId: nullableStringOr(raw.researchProjectRecordId),
    county: stringOr(raw.county, ''),
    prospect: stringOr(raw.prospect, ''),
    effectiveDate: stringOr(raw.effectiveDate, ''),
    source: stringOr(raw.source, ''),
    blob: deserializeSerializedBlob(raw.blob),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
}

function normalizeImportedMapRegion(raw: unknown, workspaceId: string): MapRegion | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const nowIso = new Date().toISOString();
  const rawRect = isRecord(raw.rect) ? raw.rect : {};
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    assetId: stringOr(raw.assetId, ''),
    title: stringOr(raw.title, ''),
    shortLabel: stringOr(raw.shortLabel, ''),
    status: optionOr(MAP_REGION_STATUS_OPTIONS, raw.status, 'Idea'),
    summary: stringOr(raw.summary, ''),
    notes: stringOr(raw.notes, ''),
    acreage: stringOr(raw.acreage, ''),
    color: stringOr(raw.color, '#9f6a2d'),
    geometryKind: 'rect',
    rect: {
      x: finiteOr(rawRect.x, 0.2),
      y: finiteOr(rawRect.y, 0.2),
      width: finiteOr(rawRect.width, 0.2),
      height: finiteOr(rawRect.height, 0.2),
      page: finiteOr(rawRect.page, 0),
    },
    deskMapId: nullableStringOr(raw.deskMapId),
    nodeId: nullableStringOr(raw.nodeId),
    linkedOwnerId: nullableStringOr(raw.linkedOwnerId),
    leaseId: nullableStringOr(raw.leaseId),
    researchSourceId: nullableStringOr(raw.researchSourceId),
    researchProjectRecordId: nullableStringOr(raw.researchProjectRecordId),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
}

function normalizeImportedResearchImport(
  raw: unknown,
  workspaceId: string
): ResearchImport | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null;
  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    workspaceId: stringOr(raw.workspaceId, workspaceId),
    datasetId: nullableStringOr(raw.datasetId),
    title: stringOr(raw.title, ''),
    fileName: stringOr(raw.fileName, ''),
    mimeType: stringOr(raw.mimeType, 'application/octet-stream'),
    detectedFormat: optionOr(RESEARCH_IMPORT_FORMAT_OPTIONS, raw.detectedFormat, 'Other'),
    notes: stringOr(raw.notes, ''),
    blob: deserializeSerializedBlob(raw.blob),
    createdAt: stringOr(raw.createdAt, nowIso),
    updatedAt: stringOr(raw.updatedAt, nowIso),
  };
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

function deserializeSerializedPdfBlob(
  serialized: unknown,
  label: string
): Blob {
  if (
    isRecord(serialized) &&
    typeof serialized.base64 === 'string' &&
    typeof serialized.mimeType === 'string'
  ) {
    return deserializePdfBlob(
      {
        base64: serialized.base64,
        mimeType: serialized.mimeType,
      },
      label
    );
  }

  return emptyPdfBlob();
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
        // Pre-overhaul `.landroid` files predate the Raven Forest pooled-unit
        // grouping and will not carry these keys. `normalizeDeskMap` drops
        // them when absent, so the pass-through is safe for backward compat.
        unitName: candidate.unitName,
        unitCode: candidate.unitCode,
        // ArcGIS / external-system links (Phase 5 ride-along). Same
        // pattern — `normalizeDeskMap` drops the field when absent.
        externalRefs: candidate.externalRefs,
      }),
    ];
  });
}

// Transient React Flow fields that should never round-trip through storage.
const TRANSIENT_CANVAS_NODE_FIELDS = ['selected', 'dragging', 'resizing', 'measured'];

/**
 * Validate persisted canvas nodes one element at a time, dropping any entry
 * that isn't a well-formed node and stripping transient interaction fields
 * (DA2-F6). One corrupt entry must not brick the whole canvas.
 */
function sanitizePersistedCanvasNodes(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const result: Record<string, unknown>[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== 'string') continue;
    if (
      !isRecord(entry.position) ||
      typeof entry.position.x !== 'number' ||
      !Number.isFinite(entry.position.x) ||
      typeof entry.position.y !== 'number' ||
      !Number.isFinite(entry.position.y)
    ) {
      continue;
    }
    const clean: Record<string, unknown> = { ...entry };
    for (const field of TRANSIENT_CANVAS_NODE_FIELDS) delete clean[field];
    result.push(clean);
  }
  return result;
}

/** Validate persisted canvas edges one element at a time (DA2-F6). */
function sanitizePersistedCanvasEdges(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const result: Record<string, unknown>[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (
      typeof entry.id !== 'string' ||
      typeof entry.source !== 'string' ||
      typeof entry.target !== 'string'
    ) {
      continue;
    }
    const clean: Record<string, unknown> = { ...entry };
    delete clean.selected;
    result.push(clean);
  }
  return result;
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
    nodes: sanitizePersistedCanvasNodes(value.nodes) as CanvasSaveData['nodes'],
    edges: sanitizePersistedCanvasEdges(value.edges) as CanvasSaveData['edges'],
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

const WORKSPACE_REVIEW_ISSUE_CODES = new Set([
  'missing_parent',
  'over_allocated_branch',
  'under_allocated_branch',
]);

function isBlockingWorkspaceValidationIssue(issue: ValidationIssue): boolean {
  return !WORKSPACE_REVIEW_ISSUE_CODES.has(issue.code);
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
  const blockingIssues = validation.issues.filter(isBlockingWorkspaceValidationIssue);
  if (blockingIssues.length > 0) {
    throw new Error(
      `${context}: invalid ownership graph (${describeValidationIssue(blockingIssues[0])})`
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
  const validUnitCodes = new Set(
    deskMaps.flatMap((deskMap) => (deskMap.unitCode ? [deskMap.unitCode] : []))
  );
  const activeDeskMapId =
    typeof value.activeDeskMapId === 'string' && validDeskMapIds.has(value.activeDeskMapId)
      ? value.activeDeskMapId
      : deskMaps[0]?.id ?? null;
  const activeUnitCode = resolveActiveUnitCode(
    deskMaps,
    typeof value.activeUnitCode === 'string' ? value.activeUnitCode : null,
    activeDeskMapId
  );

  return {
    workspaceId: value.workspaceId ?? createWorkspaceId(),
    projectName: value.projectName ?? 'Untitled Workspace',
    nodes,
    deskMaps,
    leaseholdUnit: normalizeLeaseholdUnit(value.leaseholdUnit),
    leaseholdAssignments: normalizeLeaseholdAssignments(value.leaseholdAssignments, {
      validDeskMapIds,
      validUnitCodes,
    }),
    leaseholdOrris: normalizeLeaseholdOrris(value.leaseholdOrris, {
      validDeskMapIds,
      validUnitCodes,
    }),
    leaseholdTransferOrderEntries: normalizeLeaseholdTransferOrderEntries(
      value.leaseholdTransferOrderEntries
    ),
    activeDeskMapId: activeUnitCode
      ? deskMaps.find((deskMap) => deskMap.unitCode === activeUnitCode)?.id ?? activeDeskMapId
      : activeDeskMapId,
    activeUnitCode,
    instrumentTypes: readStringArray(value.instrumentTypes),
  };
}

function sanitizeTitleIssueLinks(
  titleIssues: TitleIssue[],
  context: {
    deskMaps: DeskMap[];
    nodes: OwnershipNode[];
    ownerIds: Set<string>;
    leaseOwnerIds: Map<string, string>;
  }
): TitleIssue[] {
  const validDeskMapIds = new Set(context.deskMaps.map((deskMap) => deskMap.id));
  const validNodeIds = new Set(context.nodes.map((node) => node.id));
  const nodeDeskMapIds = new Map<string, Set<string>>();

  context.deskMaps.forEach((deskMap) => {
    deskMap.nodeIds.forEach((nodeId) => {
      const deskMapIds = nodeDeskMapIds.get(nodeId) ?? new Set<string>();
      deskMapIds.add(deskMap.id);
      nodeDeskMapIds.set(nodeId, deskMapIds);
    });
  });

  return titleIssues.map((issue) => {
    const affectedDeskMapId =
      issue.affectedDeskMapId && validDeskMapIds.has(issue.affectedDeskMapId)
        ? issue.affectedDeskMapId
        : null;
    let affectedNodeId =
      issue.affectedNodeId && validNodeIds.has(issue.affectedNodeId)
        ? issue.affectedNodeId
        : null;
    const affectedOwnerId =
      issue.affectedOwnerId && context.ownerIds.has(issue.affectedOwnerId)
        ? issue.affectedOwnerId
        : null;
    let affectedLeaseId =
      issue.affectedLeaseId && context.leaseOwnerIds.has(issue.affectedLeaseId)
        ? issue.affectedLeaseId
        : null;

    if (
      affectedDeskMapId &&
      affectedNodeId &&
      !nodeDeskMapIds.get(affectedNodeId)?.has(affectedDeskMapId)
    ) {
      affectedNodeId = null;
    }

    if (
      affectedOwnerId &&
      affectedLeaseId &&
      context.leaseOwnerIds.get(affectedLeaseId) !== affectedOwnerId
    ) {
      affectedLeaseId = null;
    }

    return {
      ...issue,
      affectedDeskMapId,
      affectedNodeId,
      affectedOwnerId,
      affectedLeaseId,
    };
  });
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

function parseWorkspaceRecord(
  record: WorkspaceRecord | null | undefined
): {
  data: WorkspaceData | null;
  error: string | null;
} {
  if (!record) {
    return { data: null, error: null };
  }
  try {
    return {
      data: parsePersistedWorkspaceData(record.data),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'unknown corruption',
    };
  }
}

type LoadedWorkspaceShardRows = Pick<
  Parameters<typeof readWorkspaceFromShardRows>[0],
  'manifest' | 'deskMaps' | 'nodes' | 'leaseholdState' | 'uiState'
>;

const EMPTY_SHARD_ROWS: LoadedWorkspaceShardRows = {
  manifest: null,
  deskMaps: [],
  nodes: [],
  leaseholdState: null,
  uiState: null,
};

function stripStoredDocId<T extends { docId: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'docId');
}

function stripStoredAttachmentId<
  T extends { attachmentId: string; dbKey?: string },
>(row: T): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'attachmentId');
}

function logicalDocId(doc: { docId: string; dbKey?: string }): string {
  return stripStorageScopedId(doc.docId, doc.dbKey);
}

async function getDocumentRows(
  docIds: ReadonlyArray<string>
): Promise<Array<DocumentRecord & { dbKey?: string }>> {
  const requested = [...new Set(docIds)].filter(Boolean);
  if (requested.length === 0) return [];
  const scopedIds = requested.map(activeStorageScopedId);
  const rows = await db.documents.bulkGet(scopedIds);
  const missingIds = requested.filter((_, index) => !rows[index]);
  const fallbackRows = missingIds.length > 0
    ? await db.documents.bulkGet(missingIds)
    : [];
  return [...rows, ...fallbackRows].filter(
    (row): row is DocumentRecord & { dbKey?: string } => Boolean(row)
  );
}

async function loadWorkspaceShardRows(args: {
  dbKey: string;
  monolithWorkspaceId: string | null;
}): Promise<LoadedWorkspaceShardRows> {
  const manifests = await db.workspaceManifestShards.toArray();
  // Prefer the manifest written under the active per-user DB key. Only fall
  // back to a legacy v10 manifest (written before the dbKey field existed) when
  // it matches THIS user's monolith workspace id — never adopt a foreign user's
  // manifest, which previously leaked another user's workspace to a fresh
  // hosted sign-in (Bug 001).
  const manifest =
    manifests.find((row) => row.dbKey === args.dbKey)
    ?? (args.monolithWorkspaceId
      ? manifests.find(
          (row) =>
            (row.dbKey === undefined || row.dbKey === null)
            && row.workspaceId === args.monolithWorkspaceId
        )
      : undefined)
    ?? null;

  if (!manifest) {
    return EMPTY_SHARD_ROWS;
  }

  const resolvedWorkspaceId = manifest.workspaceId;
  const scope = [args.dbKey, resolvedWorkspaceId] as [string, string];
  const [deskMaps, nodes, leaseholdStates, uiStates] = await Promise.all([
    db.deskMapShards.where('[dbKey+workspaceId]').equals(scope).toArray(),
    db.ownershipNodeCompatShards
      .where('[dbKey+workspaceId]')
      .equals(scope)
      .toArray(),
    db.leaseholdStateShards
      .where('[dbKey+workspaceId]')
      .equals(scope)
      .toArray(),
    db.workspaceUiStateShards
      .where('[dbKey+workspaceId]')
      .equals(scope)
      .toArray(),
  ]);

  return {
    manifest,
    deskMaps,
    nodes,
    leaseholdState: leaseholdStates[0] ?? null,
    uiState: uiStates[0] ?? null,
  };
}

// ── Auto-save to IndexedDB ─────────────────────────────

export interface SaveWorkspaceShardsResult {
  status: 'written' | 'blocked';
}

export interface SaveWorkspaceShardsDeps {
  /** Override the manifest `lastModified` timestamp source (tests). */
  now?: () => string;
  /** Override the single-writer lease gate (tests). */
  ensureWritable?: (workspaceId: string) => Promise<boolean>;
  /** Override the in-transaction fencing assertion (tests). */
  assertWritable?: (workspaceId: string) => Promise<void>;
}

function defaultShardTimestamp(): string {
  return new Date().toISOString();
}

/**
 * The workspace id the monolithic backup row for the active DB key currently
 * describes, tracked in-memory so the shard writer can re-anchor it exactly
 * once when the active workspace changes (import / CSV / fresh install).
 * `loadWorkspaceFromDb` seeds it from the row it reads; `undefined` means
 * "not yet observed this session".
 */
let anchoredMonolithWorkspaceId: string | null | undefined;

function isBlankDefaultProjectName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === 'Untitled Workspace';
}

function workspaceHasSavedProjectContent(data: WorkspaceData): boolean {
  return (
    data.nodes.length > 0
    || (data.leaseholdAssignments?.length ?? 0) > 0
    || (data.leaseholdOrris?.length ?? 0) > 0
    || (data.leaseholdTransferOrderEntries?.length ?? 0) > 0
  );
}

function shouldWriteSavedProjectIndex(
  data: WorkspaceData,
  dbKey: string
): boolean {
  if (dbKey !== getProjectIndexDbKey()) return true;
  return workspaceHasSavedProjectContent(data)
    || !isBlankDefaultProjectName(data.projectName);
}

/**
 * Autosave path (Phase 0.5): rebuild the workspace shard set from the current
 * {@link WorkspaceData} and write all five shard tables in a single Dexie
 * transaction so a mid-write failure cannot leave an incomplete set. The write
 * is gated by the single-writer lease — a read-only tab returns
 * `{ status: 'blocked' }` without touching storage.
 *
 * The monolithic `workspaces` row is not rewritten on every autosave (that
 * would preserve the scale bottleneck Phase 0.5 removes). It is re-anchored at
 * most once per workspace change so the frozen backup always describes the
 * CURRENT workspace: after a `.landroid` import replaces workspace A with B, a
 * later shard corruption must fall back to B, not the stale pre-import A. For a
 * migrated workspace edited in place, the workspace id is unchanged so the
 * migration-time backup is left untouched.
 */
export async function saveWorkspaceShardsToDb(
  data: WorkspaceData,
  deps: SaveWorkspaceShardsDeps = {}
): Promise<SaveWorkspaceShardsResult> {
  const ensureWritable = deps.ensureWritable ?? ensureWorkspaceWritable;
  const assertWritable = deps.assertWritable
    ?? (deps.ensureWritable ? async () => undefined : assertWorkspaceWriteFence);
  if (!(await ensureWritable(data.workspaceId))) {
    return { status: 'blocked' };
  }

  const dbKey = getWorkspaceDbKey();
  const lastModified = (deps.now ?? defaultShardTimestamp)();
  const shards = buildWorkspaceShards(data, {
    lastModified,
    landroidFileVersion: LANDROID_FILE_VERSION,
    source: 'local',
    syncState: 'local_only',
  });
  const manifest = stampDbKeyWithStorageId(shards.manifest, 'id', dbKey);
  const deskMapShards = shards.deskMaps.map((row) =>
    stampDbKeyWithStorageId(row, 'id', dbKey)
  );
  const nodeShards = shards.nodes.map((row) =>
    stampDbKeyWithStorageId(row, 'id', dbKey)
  );
  const leaseholdState = stampDbKeyWithStorageId(shards.leaseholdState, 'id', dbKey);
  const uiState = stampDbKeyWithStorageId(shards.uiState, 'id', dbKey);
  const { workspaceId } = data;
  // Re-anchor the monolithic backup only when it does not already describe this
  // workspace (a fresh install, or an import/CSV that swapped the workspace).
  const shouldAnchorMonolith = anchoredMonolithWorkspaceId !== workspaceId;

  await withQuotaErrorReporting('Workspace save', () => db.transaction(
    'rw',
    [
      db.workspaces,
      db.workspaceWriteLeases,
      db.workspaceManifestShards,
      db.deskMapShards,
      db.ownershipNodeCompatShards,
      db.leaseholdStateShards,
      db.workspaceUiStateShards,
    ],
    async () => {
      await assertWritable(workspaceId);
      // Replace the per-workspace child rows wholesale so removed desk maps or
      // nodes cannot linger as orphans, then write the fresh complete set. A
      // throw anywhere here rolls the whole transaction back, leaving the prior
      // complete shard set intact.
      await db.deskMapShards
        .where('[dbKey+workspaceId]')
        .equals(activeWorkspaceScope(workspaceId))
        .delete();
      await db.ownershipNodeCompatShards
        .where('[dbKey+workspaceId]')
        .equals(activeWorkspaceScope(workspaceId))
        .delete();
      await db.workspaceManifestShards
        .where('[dbKey+workspaceId]')
        .equals(activeWorkspaceScope(workspaceId))
        .delete();
      await db.leaseholdStateShards
        .where('[dbKey+workspaceId]')
        .equals(activeWorkspaceScope(workspaceId))
        .delete();
      await db.workspaceUiStateShards
        .where('[dbKey+workspaceId]')
        .equals(activeWorkspaceScope(workspaceId))
        .delete();
      await db.workspaceManifestShards.put(manifest);
      if (deskMapShards.length > 0) {
        await db.deskMapShards.bulkPut(deskMapShards);
      }
      if (nodeShards.length > 0) {
        await db.ownershipNodeCompatShards.bulkPut(nodeShards);
      }
      await db.leaseholdStateShards.put(leaseholdState);
      await db.workspaceUiStateShards.put(uiState);
      if (shouldAnchorMonolith) {
        await db.workspaces.put({
          id: dbKey,
          projectName: data.projectName,
          data: JSON.stringify(data),
          savedAt: lastModified,
        });
      }
    }
  ));

  if (shouldAnchorMonolith) {
    anchoredMonolithWorkspaceId = workspaceId;
  }
  if (shouldWriteSavedProjectIndex(data, dbKey)) {
    await upsertSavedProjectFromWorkspace({
      workspaceId,
      projectName: data.projectName,
      workspaceDbKey: dbKey,
      updatedAt: lastModified,
    });
  }
  return { status: 'written' };
}

/**
 * Drop every workspace shard row written under the active per-user DB key.
 * Called on workspace replacement / sign-out so the next workspace (or hosted
 * user) starts from a clean shard set instead of inheriting stale rows. Legacy
 * rows without a dbKey are left untouched because they may belong to another
 * hosted user on the same browser profile.
 */
export async function clearWorkspaceShardsForActiveKey(): Promise<void> {
  const dbKey = getWorkspaceDbKey();
  const manifests = await db.workspaceManifestShards.toArray();
  const workspaceIds = manifests
    .filter((row) => row.dbKey === dbKey)
    .map((row) => row.workspaceId);
  if (workspaceIds.length === 0) {
    return;
  }

  await db.transaction(
    'rw',
    [
      db.workspaceManifestShards,
      db.deskMapShards,
      db.ownershipNodeCompatShards,
      db.leaseholdStateShards,
      db.workspaceUiStateShards,
    ],
    async () => {
      for (const workspaceId of workspaceIds) {
        const scope = [dbKey, workspaceId] as [string, string];
        await db.workspaceManifestShards
          .where('[dbKey+workspaceId]')
          .equals(scope)
          .delete();
        await db.deskMapShards
          .where('[dbKey+workspaceId]')
          .equals(scope)
          .delete();
        await db.ownershipNodeCompatShards
          .where('[dbKey+workspaceId]')
          .equals(scope)
          .delete();
        await db.leaseholdStateShards
          .where('[dbKey+workspaceId]')
          .equals(scope)
          .delete();
        await db.workspaceUiStateShards
          .where('[dbKey+workspaceId]')
          .equals(scope)
          .delete();
      }
    }
  );
}

export async function loadWorkspaceFromDb(): Promise<WorkspaceLoadResult> {
  const dbKey = getWorkspaceDbKey();
  const record = await db.workspaces.get(dbKey);
  const monolith = parseWorkspaceRecord(record);
  // Seed the anchor tracker from the row we just read so the next shard write
  // only re-anchors the backup if the active workspace actually changes.
  anchoredMonolithWorkspaceId = monolith.data?.workspaceId ?? null;
  const shardRows = await loadWorkspaceShardRows({
    dbKey,
    monolithWorkspaceId: monolith.data?.workspaceId ?? null,
  });
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
    return {
      status: 'missing',
      data: null,
      error: null,
      warning: null,
      source: null,
    };
  }

  if (readResult.status !== 'corrupt') {
    return {
      status: 'loaded',
      data: readResult.data,
      error: null,
      warning: readResult.warning,
      source:
        readResult.status === 'loaded_from_shards'
          ? 'shards'
          : 'monolith',
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

// ── Export .landroid file ───────────────────────────────

async function serializeOwnerData(
  ownerData: OwnerWorkspaceData | undefined
): Promise<
  | undefined
  | {
      owners: OwnerWorkspaceData['owners'];
      leases: OwnerWorkspaceData['leases'];
      leasePurchaseReports: NonNullable<
        OwnerWorkspaceData['leasePurchaseReports']
      >;
      contacts: OwnerWorkspaceData['contacts'];
      docs: SerializedOwnerDoc[];
    }
> {
  if (!ownerData) return undefined;

  return {
    owners: ownerData.owners,
    leases: ownerData.leases,
    leasePurchaseReports: ownerData.leasePurchaseReports ?? [],
    contacts: ownerData.contacts,
    docs: await Promise.all(
      ownerData.docs.map(async (doc) => ({
        ...doc,
        blob: await serializeBlob(doc.blob),
      }))
    ),
  };
}

/**
 * Serialize a v7-shape PDF payload. Retained (and exported) for the A5b
 * auto-`.landroid` v7 backup hook, which needs the v7 wire format even
 * though normal export is v8.
 */
export async function serializePdfData(
  pdfData: PdfWorkspaceData | undefined
): Promise<
  | undefined
  | {
      pdfs: SerializedPdfAttachment[];
    }
> {
  if (!pdfData) return undefined;

  return {
    pdfs: await Promise.all(
      pdfData.pdfs.map(async (pdf) => ({
        ...pdf,
        blob: await serializeBlob(pdf.blob),
      }))
    ),
  };
}

async function serializeDocumentData(
  documentData: DocumentWorkspaceData | undefined
): Promise<
  | undefined
  | {
      documents: SerializedDocumentRecord[];
      attachments: DocumentAttachment[];
    }
> {
  if (!documentData) return undefined;
  return {
    documents: await Promise.all(
      documentData.documents.map(async (doc) => ({
        ...doc,
        // DA-H7 (cheap insurance): recompute the hash from the bytes being
        // written so an exported `.landroid` always carries a self-consistent
        // fixity value, even if a stored hash had drifted. The import side
        // re-verifies on the way back in regardless.
        contentHash: await sha256HexOfBlob(doc.blob),
        blob: await serializeBlob(doc.blob),
      }))
    ),
    attachments: [...documentData.attachments],
  };
}

function isDocumentRecordRow(value: unknown): value is SerializedDocumentRecord {
  return (
    isRecord(value)
    && typeof (value as { docId?: unknown }).docId === 'string'
    && typeof (value as { workspaceId?: unknown }).workspaceId === 'string'
  );
}

function isDocumentAttachmentRow(value: unknown): value is DocumentAttachment {
  return (
    isRecord(value)
    && typeof (value as { attachmentId?: unknown }).attachmentId === 'string'
    && typeof (value as { docId?: unknown }).docId === 'string'
    && typeof (value as { entityId?: unknown }).entityId === 'string'
    && isDocumentEntityKind((value as { entityKind?: unknown }).entityKind)
  );
}

/**
 * DA-H7: the import never trusts the file's recorded document hash. Every
 * decoded blob is re-hashed (SHA-256) and the recomputed digest is what gets
 * stored. A non-empty stored hash that disagrees is a fixity mismatch — the
 * bytes don't match the claim, i.e. corruption or tampering — and the file is
 * collected into `fixityMismatches` so the caller can warn (never block,
 * recomputed value wins). A blank stored hash is a legacy unhashed import and
 * is healed silently.
 */
async function deserializeDocumentData(value: unknown): Promise<{
  documents: DocumentRecord[];
  attachments: DocumentAttachment[];
  fixityMismatches: string[];
}> {
  if (!isRecord(value)) {
    return { documents: [], attachments: [], fixityMismatches: [] };
  }
  const fixityMismatches: string[] = [];

  const rawDocs = Array.isArray((value as { documents?: unknown }).documents)
    ? ((value as { documents: unknown[] }).documents)
    : [];
  const rawAttachments = Array.isArray((value as { attachments?: unknown }).attachments)
    ? ((value as { attachments: unknown[] }).attachments)
    : [];

  const builtDocs = await Promise.all(
    rawDocs.filter(isDocumentRecordRow).map(
      async (raw): Promise<DocumentRecord | null> => {
      const fileName = typeof raw.fileName === 'string' ? raw.fileName : '';
      const blob = deserializeSerializedPdfBlob(
        raw.blob,
        `Imported document ${fileName || raw.docId}`
      );
      if (blob.size === 0) return null;
      const recomputedHash = await sha256HexOfBlob(blob);
      const storedHash =
        typeof raw.contentHash === 'string' ? raw.contentHash : '';
      if (storedHash !== '' && storedHash !== recomputedHash) {
        fixityMismatches.push(fileName || raw.docId);
      }
      const now = new Date().toISOString();
      return (
        {
          docId: raw.docId,
          workspaceId: raw.workspaceId,
          fileName,
          mimeType: PDF_MIME_TYPE,
          byteLength: blob.size,
          contentHash: recomputedHash,
          blob,
          kind: normalizeDocumentKind(raw.kind),
          displayTitle:
            typeof raw.displayTitle === 'string' ? raw.displayTitle : undefined,
          documentArea: isDocumentArea(raw.documentArea)
            ? raw.documentArea
            : undefined,
          instrumentType:
            typeof raw.instrumentType === 'string' ? raw.instrumentType : undefined,
          county: typeof raw.county === 'string' ? raw.county : undefined,
          instrumentNumber:
            typeof raw.instrumentNumber === 'string'
              ? raw.instrumentNumber
              : undefined,
          volume: typeof raw.volume === 'string' ? raw.volume : undefined,
          page: typeof raw.page === 'string' ? raw.page : undefined,
          effectiveDate:
            typeof raw.effectiveDate === 'string' ? raw.effectiveDate : undefined,
          recordingDate:
            typeof raw.recordingDate === 'string' ? raw.recordingDate : undefined,
          grantor: typeof raw.grantor === 'string' ? raw.grantor : undefined,
          grantee: typeof raw.grantee === 'string' ? raw.grantee : undefined,
          notes: typeof raw.notes === 'string' ? raw.notes : undefined,
          sourceReference:
            typeof raw.sourceReference === 'string'
              ? raw.sourceReference
              : undefined,
          ocrStatus: isDocumentOcrStatus(raw.ocrStatus)
            ? raw.ocrStatus
            : undefined,
          externalRefs: normalizeExternalRefs(raw.externalRefs),
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
        }
      );
    })
  );
  const documents = builtDocs.filter(
    (doc): doc is DocumentRecord => doc !== null
  );

  const docIdSet = new Set(documents.map((d) => d.docId));
  const workspaceByDocId = new Map(documents.map((d) => [d.docId, d.workspaceId]));
  const attachments: DocumentAttachment[] = rawAttachments
    .filter(isDocumentAttachmentRow)
    .filter((row) => docIdSet.has(row.docId))
    .map((row) => ({
      attachmentId: row.attachmentId,
      workspaceId:
        typeof row.workspaceId === 'string'
          ? row.workspaceId
          : (workspaceByDocId.get(row.docId) ?? ''),
      docId: row.docId,
      entityKind: row.entityKind,
      entityId: row.entityId,
      position: typeof row.position === 'number' ? row.position : 0,
      createdAt:
        typeof row.createdAt === 'string'
          ? row.createdAt
          : new Date().toISOString(),
    }));

  return { documents, attachments, fixityMismatches };
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

interface SerializedCanvasAsset {
  contentHash: string;
  workspaceId: string;
  mimeType: string;
  byteLength: number;
  fileName?: string;
  createdAt: string;
  blob: SerializedBlob;
}

async function serializeCanvasAssetData(
  canvasAssetData: CanvasAssetWorkspaceData | undefined
): Promise<undefined | { assets: SerializedCanvasAsset[] }> {
  if (!canvasAssetData) return undefined;
  return {
    assets: await Promise.all(
      canvasAssetData.assets.map(async (asset) => ({
        // Recompute the hash from the bytes being written so the exported file
        // is always self-consistent (mirrors the document vault's DA-H7).
        contentHash: await sha256HexOfBlob(asset.blob),
        workspaceId: asset.workspaceId,
        mimeType: asset.mimeType,
        byteLength: asset.byteLength,
        fileName: asset.fileName,
        createdAt: asset.createdAt,
        blob: await serializeBlob(asset.blob),
      }))
    ),
  };
}

/**
 * Decode canvas image assets from an imported file. Each blob is re-hashed and
 * the recomputed digest becomes the canonical content hash (these are
 * illustrative images, not evidence, so a drift is healed silently rather than
 * surfaced as a fixity warning). A blob that is corrupt or over the per-blob
 * cap is skipped individually so one bad image never aborts the whole import.
 */
async function deserializeCanvasAssetData(
  value: unknown,
  workspaceId: string
): Promise<CanvasAssetWorkspaceData> {
  if (!isRecord(value) || !Array.isArray((value as { assets?: unknown }).assets)) {
    return { assets: [] };
  }
  const rawAssets = (value as { assets: unknown[] }).assets;
  const built = await Promise.all(
    rawAssets
      .filter((raw): raw is Record<string, unknown> => isRecord(raw) && isRecord(raw.blob))
      .map(async (raw): Promise<CanvasAssetRecord | null> => {
        let blob: Blob;
        try {
          blob = deserializeSerializedBlob(raw.blob);
        } catch (error) {
          console.warn('[landroid] Skipping unreadable canvas image asset:', error);
          return null;
        }
        if (blob.size === 0) return null;
        const contentHash = await sha256HexOfBlob(blob);
        return {
          id: contentHash, // re-scoped on write by replaceCanvasAssetWorkspaceData
          workspaceId:
            typeof raw.workspaceId === 'string' ? raw.workspaceId : workspaceId,
          contentHash,
          mimeType:
            blob.type ||
            (typeof raw.mimeType === 'string' ? raw.mimeType : 'application/octet-stream'),
          byteLength: blob.size,
          fileName: typeof raw.fileName === 'string' ? raw.fileName : undefined,
          createdAt:
            typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
          blob,
        };
      })
  );
  return { assets: built.filter((asset): asset is CanvasAssetRecord => asset !== null) };
}

async function serializeResearchData(
  researchData: ResearchWorkspaceData | undefined
): Promise<
  | undefined
  | {
      imports: SerializedResearchImport[];
      sources: SerializedResearchSource[];
      formulas: SerializedResearchFormula[];
      projectRecords: SerializedResearchProjectRecord[];
      questions: SerializedResearchQuestion[];
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
    sources: researchData.sources,
    formulas: researchData.formulas,
    projectRecords: researchData.projectRecords,
    questions: researchData.questions,
  };
}

function ledgerWarningReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function validateImportedActionLedger(
  raw: unknown
): Promise<ProjectRecordBundle | undefined> {
  const parsed = ProjectRecordBundleSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      `[landroid] Dropping invalid actionLedger: ${parsed.error.message}`
    );
    return undefined;
  }

  const nonLedgerRecord = parsed.data.records.find(
    (record) => record.recordType !== 'action_record' && record.recordType !== 'audit_event'
  );
  if (nonLedgerRecord) {
    console.warn(
      `[landroid] Dropping invalid actionLedger: record ${nonLedgerRecord.recordId} ` +
        `has non-ledger type ${nonLedgerRecord.recordType}.`
    );
    return undefined;
  }

  const auditEvents = parsed.data.records.filter(
    (record): record is AuditEventRecord => record.recordType === 'audit_event'
  );
  try {
    const verification = await verifyAuditChain(auditEvents);
    if (!verification.valid) {
      console.warn(
        `[landroid] Dropping invalid actionLedger: audit chain failed at index ` +
          `${verification.brokenAtIndex} (${verification.reason}).`
      );
      return undefined;
    }
  } catch (error) {
    console.warn(
      `[landroid] Dropping invalid actionLedger: ${ledgerWarningReason(error)}`
    );
    return undefined;
  }

  return parsed.data;
}

/**
 * Current `.landroid` schema version. v9 keeps the v8 snapshot authoritative
 * and may add an optional validated action/audit ledger. Imports of v7 (or
 * earlier) files are migrated inline by {@link importLandroidFile}.
 */
export async function exportLandroidFile(
  data: LandroidFileData,
  options: LandroidFileExportOptions = {}
): Promise<Blob> {
  const exportedAt = new Date().toISOString();
  const snapshotData = { ...data };
  delete snapshotData.actionLedger;
  const payload: Record<string, unknown> & { actionLedger?: ProjectRecordBundle } = {
    version: LANDROID_FILE_VERSION,
    exportedAt,
    ...snapshotData,
    documentData: await serializeDocumentData(data.documentData),
    ownerData: await serializeOwnerData(data.ownerData),
    mapData: await serializeMapData(data.mapData),
    researchData: await serializeResearchData(data.researchData),
    canvasAssetData: await serializeCanvasAssetData(data.canvasAssetData),
  };
  const actionRecords = options.actionRecords ?? [];
  const auditEvents = options.auditEvents ?? [];
  if (actionRecords.length > 0 || auditEvents.length > 0) {
    assertActionLayerExportAllowed(LANDROID_FILE_VERSION);
    const emptyBundle = buildProjectRecordBundle({
      workspaceId: data.workspaceId,
      projectId: data.workspaceId,
      generatedAt: exportedAt,
      records: [],
    });
    payload.actionLedger = await appendActionLayerToRecordBundle({
      bundle: emptyBundle,
      actionRecords,
      auditEvents,
    });
  }
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function downloadLandroidFile(
  data: LandroidFileData,
  options?: LandroidFileExportOptions
) {
  const blob = await exportLandroidFile(data, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.projectName || 'workspace'}.landroid`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPdfWorkspaceData(
  workspaceId: string,
  nodes: OwnershipNode[]
): Promise<PdfWorkspaceData> {
  // Phase 5: read from the v8 `documents` + `document_attachments`
  // tables. The v8 `.landroid` shape (added in A5) will serialize
  // documents directly; for now we keep emitting v7-compatible
  // `pdfs: PdfAttachment[]` so existing .landroid round-trips still work.
  // Each node contributes its first attachment (single-doc UX is still
  // the only path in A4; Phase B's multi-doc surface plus A5's v8
  // export are where multi-attachment-per-node lands properly).
  const nodeIds = nodes.map((node) => node.id);
  if (nodeIds.length === 0) return { pdfs: [] };

  const attachments = await db.document_attachments
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .and((row) => row.entityKind === 'node' && nodeIds.includes(row.entityId))
    .toArray();
  if (attachments.length === 0) return { pdfs: [] };

  // Pick the lowest-position attachment per node for the v7-shape export.
  const firstByNode = new Map<string, typeof attachments[number]>();
  for (const a of attachments) {
    const existing = firstByNode.get(a.entityId);
    if (!existing || a.position < existing.position) {
      firstByNode.set(a.entityId, a);
    }
  }

  const docIds = [...new Set([...firstByNode.values()].map((a) => a.docId))];
  const docs = await getDocumentRows(docIds);
  const docById = new Map<string, NonNullable<typeof docs[number]>>();
  for (const doc of docs) {
    if (
      doc
      && doc.workspaceId === workspaceId
      && doc.dbKey === activeWorkspaceScope(workspaceId)[0]
      && doc.blob.size > 0
    ) {
      docById.set(logicalDocId(doc), doc);
    }
  }

  const pdfs: PdfAttachment[] = [];
  for (const [nodeId, attachment] of firstByNode) {
    const doc = docById.get(attachment.docId);
    if (!doc) continue;
    pdfs.push({
      nodeId,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      blob: doc.blob,
      createdAt: attachment.createdAt,
    });
  }
  return { pdfs };
}

/**
 * Read EVERY document + attachment in the given workspace, with their blobs,
 * for `.landroid` export and for the side-store / AI-undo snapshots that
 * restore through {@link replaceDocumentWorkspaceData}.
 *
 * DA-H6: this is workspace-scoped, NOT node-joined. A detached document, or
 * one attached to a non-node entity, is an advertised "Unlinked" state and is
 * still the workspace's evidence — it must survive export → import and any
 * undo/rollback. The earlier node-join silently omitted those originals, and
 * because the restore side ({@link replaceDocumentWorkspaceData}) wipes the
 * entire workspace document scope before re-adding the supplied set, an
 * incomplete snapshot meant permanent loss of original PDFs through routine
 * flows. The scope queried here (`[dbKey+workspaceId]`) is identical to that
 * delete scope, so the round trip is provably complete.
 *
 * `_legacyNodes` is retained only for call-site stability and is deliberately
 * ignored. Reintroducing a node filter here would resurrect DA-H6 — the
 * round-trip completeness test guards against exactly that.
 */
export async function exportDocumentWorkspaceData(
  workspaceId: string,
  _legacyNodes?: OwnershipNode[]
): Promise<DocumentWorkspaceData> {
  const scope = activeWorkspaceScope(workspaceId);

  const storedDocs = await db.documents
    .where('[dbKey+workspaceId]')
    .equals(scope)
    .toArray();
  const documents: DocumentRecord[] = [];
  const docIdSeen = new Set<string>();
  for (const doc of storedDocs) {
    // Empty-blob rows are degenerate placeholders the restore side drops
    // anyway (replaceDocumentWorkspaceData filters blob.size > 0).
    if (doc.blob.size > 0) {
      const cleanDoc = stripStoredDocId(doc);
      documents.push(cleanDoc);
      docIdSeen.add(cleanDoc.docId);
    }
  }

  const storedAttachments = await db.document_attachments
    .where('[dbKey+workspaceId]')
    .equals(scope)
    .toArray();
  const attachments = storedAttachments
    .map(stripStoredAttachmentId)
    .filter((attachment) => docIdSeen.has(attachment.docId));

  return { documents, attachments };
}

/**
 * Replace every document + attachment for the given workspace with the
 * supplied set. Used by `.landroid` import after `importLandroidFile`
 * resolves to the current documentData shape (either directly or via inline v7
 * migration).
 *
 * Workspace scoping protects other workspaces' data when a user imports
 * a file into a fresh workspace alongside existing local data.
 */
export async function replaceDocumentWorkspaceData(
  data: DocumentWorkspaceData,
  workspaceId: string
): Promise<void> {
  // Filter incoming data to the target workspace + non-empty blobs.
  const documents = data.documents
    .filter((d) => d.workspaceId === workspaceId && d.blob.size > 0);
  const docIdSet = new Set(documents.map((d) => d.docId));
  const attachments = data.attachments
    .filter((a) => docIdSet.has(a.docId))
    .map((a) => ({ ...a, workspaceId }));

  const writable = await ensureWorkspaceWritable(workspaceId);
  if (!writable) {
    throw new Error('Workspace is read-only because another tab holds the write lease.');
  }
  await db.transaction('rw', db.workspaceWriteLeases, db.documents, db.document_attachments, async () => {
    await assertWorkspaceWriteFence(workspaceId);
    // Drop every document scoped to this workspace.
    const existingDocs = await db.documents
      .where('[dbKey+workspaceId]')
      .equals(activeWorkspaceScope(workspaceId))
      .toArray();
    const existingStoredDocIds = existingDocs.map((d) => d.docId);
    const existingLogicalDocIds = existingDocs.map(logicalDocId);
    if (existingStoredDocIds.length > 0) {
      await db.documents.bulkDelete(existingStoredDocIds);
      // Cascade-delete attachments pointing at those docs.
      const existingAttachmentIds = await db.document_attachments
        .where('[dbKey+workspaceId+docId]')
        .anyOf(existingLogicalDocIds.map((docId) => [
          ...activeWorkspaceScope(workspaceId),
          docId,
        ]))
        .primaryKeys();
      if (existingAttachmentIds.length > 0) {
        await db.document_attachments.bulkDelete(existingAttachmentIds);
      }
    }
    if (documents.length > 0) {
      await db.documents.bulkAdd(
        documents.map((doc) => stampActiveDbKeyWithStorageId(doc, 'docId'))
      );
      await db.document_attachments.bulkAdd(
        attachments.map((attachment) =>
          stampActiveDbKeyWithStorageId(attachment, 'attachmentId')
        )
      );
    }
  });
}

export async function replacePdfWorkspaceData(
  data: PdfWorkspaceData,
  nodes: OwnershipNode[],
  workspaceId: string
): Promise<void> {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const pdfs = data.pdfs.filter(
    (pdf) => validNodeIds.has(pdf.nodeId) && pdf.blob.size > 0
  );

  const writable = await ensureWorkspaceWritable(workspaceId);
  if (!writable) {
    throw new Error('Workspace is read-only because another tab holds the write lease.');
  }
  await db.transaction('rw', db.workspaceWriteLeases, db.pdfs, async () => {
    await assertWorkspaceWriteFence(workspaceId);
    await db.pdfs.bulkDelete([...validNodeIds]);
    if (pdfs.length > 0) {
      await db.pdfs.bulkPut(pdfs);
    }
  });
}

// ── Import .landroid file ──────────────────────────────

export async function importLandroidFile(file: File): Promise<LandroidFileData> {
  assertFileSize(file, FILE_SIZE_LIMITS.LANDROID, '.landroid file');
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

  const versionIsValidNumber =
    typeof parsed.version === 'number' && Number.isFinite(parsed.version);

  if (versionIsValidNumber && (parsed.version as number) > LANDROID_FILE_VERSION) {
    throw new Error(
      `Unsupported .landroid file version ${parsed.version}. This LANDroid build supports up to version ${LANDROID_FILE_VERSION}.`
    );
  }

  // DA-L8: the future-version gate above only fires for numeric versions, so a
  // crafted file could dodge it with a non-numeric version (e.g. `"99"`) or no
  // version at all and fall through to the legacy v0/v7 path. A genuine pre-v8
  // legacy file predates the version field — but it also predates the
  // `documentData` (v8) and `actionLedger` (v9) structures. A file that carries
  // either of those yet has no valid numeric version is malformed or a bypass
  // attempt; reject it instead of silently importing it as legacy.
  const hasV8PlusMarkers =
    isRecord(parsed.documentData) || isRecord(parsed.actionLedger);
  if (!versionIsValidNumber && hasV8PlusMarkers) {
    throw new Error(
      'Invalid .landroid file: document/ledger data requires a numeric version field.'
    );
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
          owners: Array.isArray(parsed.ownerData.owners)
            ? parsed.ownerData.owners
                .map((raw) => normalizeOwnerRecord(raw, workspaceId))
                .filter((owner): owner is Owner => owner !== null)
            : [],
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
          leasePurchaseReports: Array.isArray(
            parsed.ownerData.leasePurchaseReports
          )
            ? parsed.ownerData.leasePurchaseReports
                .filter(
                  (
                    report
                  ): report is Pick<
                    NonNullable<
                      NonNullable<LandroidFileData['ownerData']>['leasePurchaseReports']
                    >[number],
                    'id'
                  > &
                    Partial<
                      NonNullable<
                        NonNullable<LandroidFileData['ownerData']>['leasePurchaseReports']
                      >[number]
                    > =>
                    isRecord(report) && typeof report.id === 'string'
                )
                .map((report) =>
                  normalizeLeasePurchaseReport(report, { workspaceId })
                )
            : [],
          contacts: Array.isArray(parsed.ownerData.contacts)
            ? parsed.ownerData.contacts
                .map((raw) => normalizeContactRecord(raw, workspaceId))
                .filter((contact): contact is ContactLog => contact !== null)
            : [],
          docs: Array.isArray(parsed.ownerData.docs)
            ? parsed.ownerData.docs
                .filter(
                  (doc): doc is SerializedOwnerDoc =>
                    isRecord(doc) && typeof doc.id === 'string'
                )
                .map((doc) => normalizeImportedOwnerDoc(doc, workspaceId))
                .filter((doc): doc is OwnerDoc => doc !== null)
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
                .map((asset) => normalizeImportedMapAsset(asset, workspaceId))
                .filter((asset): asset is MapAsset => asset !== null)
            : [],
          mapRegions: Array.isArray(parsed.mapData.mapRegions)
            ? parsed.mapData.mapRegions
                .filter(
                  (region): region is SerializedMapRegion =>
                    isRecord(region) && typeof region.id === 'string'
                )
                .map((region) => normalizeImportedMapRegion(region, workspaceId))
                .filter((region): region is MapRegion => region !== null)
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

  const researchImports =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.imports)
      ? parsed.researchData.imports
          .filter(
            (researchImport): researchImport is SerializedResearchImport =>
              isRecord(researchImport) && typeof researchImport.id === 'string'
          )
          .map((researchImport) => normalizeImportedResearchImport(researchImport, workspaceId))
          .filter((researchImport): researchImport is ResearchImport => researchImport !== null)
      : [];
  const researchSources =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.sources)
      ? parsed.researchData.sources
          .filter(
            (source): source is SerializedResearchSource =>
              isRecord(source) && typeof source.id === 'string'
          )
          .map((source) =>
            normalizeResearchSource({
              ...source,
              workspaceId:
                typeof source.workspaceId === 'string' ? source.workspaceId : workspaceId,
            })
          )
      : [];
  const researchFormulas =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.formulas)
      ? parsed.researchData.formulas
          .filter(
            (formula): formula is SerializedResearchFormula =>
              isRecord(formula) && typeof formula.id === 'string'
          )
          .map((formula) =>
            normalizeResearchFormula({
              ...formula,
              workspaceId:
                typeof formula.workspaceId === 'string'
                  ? formula.workspaceId
                  : workspaceId,
            })
          )
      : [];
  const researchProjectRecords =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.projectRecords)
      ? parsed.researchData.projectRecords
          .filter(
            (projectRecord): projectRecord is SerializedResearchProjectRecord =>
              isRecord(projectRecord) && typeof projectRecord.id === 'string'
          )
          .map((projectRecord) =>
            normalizeResearchProjectRecord({
              ...projectRecord,
              workspaceId:
                typeof projectRecord.workspaceId === 'string'
                  ? projectRecord.workspaceId
                  : workspaceId,
            })
          )
      : [];
  const researchQuestions =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.questions)
      ? parsed.researchData.questions
          .filter(
            (question): question is SerializedResearchQuestion =>
              isRecord(question) && typeof question.id === 'string'
          )
          .map((question) =>
            normalizeResearchQuestion({
              ...question,
              workspaceId:
                typeof question.workspaceId === 'string'
                  ? question.workspaceId
                  : workspaceId,
            })
          )
      : [];
  const sanitizedResearchLinks = sanitizeResearchLinks(
    {
      sources: researchSources,
      formulas: researchFormulas,
      projectRecords: researchProjectRecords,
      questions: researchQuestions,
    },
    {
      deskMapIds: new Set(core.deskMaps.map((deskMap) => deskMap.id)),
      nodeIds: new Set(core.nodes.map((node) => node.id)),
      ownerIds: new Set(
        ownerData.owners
          .filter((owner) => isRecord(owner) && typeof owner.id === 'string')
          .map((owner) => owner.id)
      ),
      leaseIds: new Set(ownerData.leases.map((lease) => lease.id)),
      mapAssetIds: new Set(mapData.mapAssets.map((asset) => asset.id)),
      mapRegionIds: new Set(mapData.mapRegions.map((region) => region.id)),
      importIds: new Set(researchImports.map((researchImport) => researchImport.id)),
      sourceIds: new Set(researchSources.map((source) => source.id)),
      formulaIds: new Set(researchFormulas.map((formula) => formula.id)),
      projectRecordIds: new Set(
        researchProjectRecords.map((projectRecord) => projectRecord.id)
      ),
    }
  );
  const researchData = {
    imports: researchImports,
    ...sanitizedResearchLinks,
  };

  // Phase 5 / A5: dispatch on `version` so legacy files arrive at the
  // canonical documentData shape (documents + document_attachments).
  const fileVersion =
    typeof parsed.version === 'number' && Number.isFinite(parsed.version)
      ? parsed.version
      : 0;

  const pdfData =
    isRecord(parsed.pdfData)
      ? {
          pdfs: Array.isArray(parsed.pdfData.pdfs)
            ? parsed.pdfData.pdfs
                .filter(
                  (pdf): pdf is SerializedPdfAttachment =>
                    isRecord(pdf) && typeof pdf.nodeId === 'string'
                )
                .map((pdf) => ({
                  nodeId: pdf.nodeId,
                  fileName: typeof pdf.fileName === 'string' ? pdf.fileName : '',
                  mimeType: PDF_MIME_TYPE,
                  blob: deserializeSerializedPdfBlob(
                    pdf.blob,
                    `Legacy PDF ${typeof pdf.fileName === 'string' ? pdf.fileName : pdf.nodeId}`
                  ),
                  createdAt:
                    typeof pdf.createdAt === 'string'
                      ? pdf.createdAt
                      : new Date().toISOString(),
                }))
                .filter((pdf) => pdf.blob.size > 0)
            : [],
        }
      : { pdfs: [] };

  let documentData: DocumentWorkspaceData;
  let documentFixityWarning: string | undefined;
  if (fileVersion >= 8) {
    const deserialized = await deserializeDocumentData(parsed.documentData);
    if (deserialized.fixityMismatches.length > 0) {
      documentFixityWarning = formatDocumentFixityWarning(
        deserialized.fixityMismatches
      );
    }
    // Re-scope every doc to the file's workspaceId so callers that
    // import into a fresh workspace don't accidentally inherit a stale
    // workspaceId from the file.
    documentData = {
      documents: deserialized.documents.map((doc) => ({
        ...doc,
        workspaceId,
      })),
      attachments: deserialized.attachments,
    };
  } else if (pdfData.pdfs.length > 0) {
    // v7 (or earlier) inline migration: synthesize document/attachment
    // rows from the v7 PDF payload so the rest of the pipeline only
    // ever sees v8 shape.
    const nodeIdToWorkspaceId = new Map<string, string>(
      core.nodes.map((node) => [node.id, workspaceId])
    );
    const migrationDeps: DocumentMigrationDeps = {
      generateId: () => crypto.randomUUID(),
      hashBlob: sha256HexOfBlob,
      now: () => new Date().toISOString(),
    };
    const migrated = await migratePdfsToDocuments(
      pdfData.pdfs,
      nodeIdToWorkspaceId,
      workspaceId,
      migrationDeps
    );
    documentData = {
      documents: migrated.documents,
      attachments: migrated.attachments,
    };
  } else {
    documentData = { documents: [], attachments: [] };
  }
  const nodes = core.nodes;

  const curativeData =
    isRecord(parsed.curativeData)
      ? {
          titleIssues: sanitizeTitleIssueLinks(
            normalizeTitleIssues(parsed.curativeData.titleIssues, {
              workspaceId,
            }),
            {
              deskMaps: core.deskMaps,
              nodes,
              ownerIds: new Set(
                ownerData.owners
                  .filter((owner) => isRecord(owner) && typeof owner.id === 'string')
                  .map((owner) => owner.id)
              ),
              leaseOwnerIds: new Map(
                ownerData.leases.map((lease) => [lease.id, lease.ownerId])
              ),
            }
          ),
        }
      : { titleIssues: [] };
  const actionLedger =
    parsed.actionLedger === undefined
      ? undefined
      : await validateImportedActionLedger(parsed.actionLedger);
  const canvasAssetData = await deserializeCanvasAssetData(
    parsed.canvasAssetData,
    workspaceId
  );
  return {
    ...core,
    nodes,
    canvas: normalizeCanvasSaveData(parsed.canvas),
    documentData,
    documentFixityWarning,
    ownerData,
    mapData,
    researchData,
    curativeData,
    canvasAssetData,
    actionLedger,
  };
}

/**
 * Human-readable warning for documents whose stored hash did not match their
 * decoded bytes on import (DA-H7). The recomputed hash is what gets stored;
 * this only surfaces the discrepancy so the operator can review the originals.
 */
function formatDocumentFixityWarning(fileNames: string[]): string {
  const shown = fileNames.slice(0, 5);
  const more = fileNames.length - shown.length;
  const list = shown.join(', ') + (more > 0 ? `, +${more} more` : '');
  return (
    `${fileNames.length} imported document${fileNames.length === 1 ? '' : 's'} `
    + `failed fixity verification — the recorded hash did not match the file `
    + `contents (${list}). The recomputed hashes were stored; review these `
    + `originals before relying on them as evidence.`
  );
}
