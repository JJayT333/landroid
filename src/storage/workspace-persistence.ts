/**
 * Workspace persistence — auto-save to IndexedDB, export/import .landroid files.
 */
import db, { type PdfAttachment } from './db';
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
} from '../engine/math-engine';
import { createWorkspaceId } from '../utils/workspace-id';
import { assertFileSize, FILE_SIZE_LIMITS } from '../utils/file-validation';
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
import {
  normalizeLease,
  type ContactLog,
  type Owner,
  type OwnerDoc,
} from '../types/owner';
import {
  normalizeMapExternalReference,
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
import { getWorkspaceDbKey } from './active-workspace-key';
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
  /**
   * v8 document payload (Phase 5 / ADR 0004). v7 imports are migrated
   * inline by {@link importLandroidFile} so callers never see a
   * `pdfData`-only file — by the time the import resolves, the v8 shape
   * is what the rest of the app consumes.
   */
  documentData?: DocumentWorkspaceData;
  ownerData?: OwnerWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
}

export interface DocumentWorkspaceData {
  documents: DocumentRecord[];
  attachments: DocumentAttachment[];
}

export interface WorkspaceLoadResult {
  status: 'missing' | 'loaded' | 'corrupt';
  data: WorkspaceData | null;
  error: string | null;
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

// ── Auto-save to IndexedDB ─────────────────────────────

export async function saveWorkspaceToDb(data: WorkspaceData): Promise<void> {
  await db.workspaces.put({
    id: getWorkspaceDbKey(),
    projectName: data.projectName,
    data: JSON.stringify(data),
    savedAt: new Date().toISOString(),
  });
}

export async function loadWorkspaceFromDb(): Promise<WorkspaceLoadResult> {
  const record = await db.workspaces.get(getWorkspaceDbKey());
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

function deserializeDocumentData(value: unknown): DocumentWorkspaceData {
  if (!isRecord(value)) return { documents: [], attachments: [] };

  const rawDocs = Array.isArray((value as { documents?: unknown }).documents)
    ? ((value as { documents: unknown[] }).documents)
    : [];
  const rawAttachments = Array.isArray((value as { attachments?: unknown }).attachments)
    ? ((value as { attachments: unknown[] }).attachments)
    : [];

  const documents: DocumentRecord[] = rawDocs.filter(isDocumentRecordRow).flatMap(
    (raw) => {
      const fileName = typeof raw.fileName === 'string' ? raw.fileName : '';
      const blob = deserializeSerializedPdfBlob(
        raw.blob,
        `Imported document ${fileName || raw.docId}`
      );
      if (blob.size === 0) return [];
      const now = new Date().toISOString();
      return [
        {
          docId: raw.docId,
          workspaceId: raw.workspaceId,
          fileName,
          mimeType: PDF_MIME_TYPE,
          byteLength: blob.size,
          contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : '',
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
        },
      ];
    }
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

  return { documents, attachments };
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

/**
 * Current `.landroid` schema version. Bumped to 8 in Phase 5
 * (multi-doc-per-entity); see ADR 0004. v8 emits `documentData` and
 * omits the legacy `pdfData` field. Imports of v7 (or earlier) files
 * are migrated inline by {@link importLandroidFile}.
 */
export const LANDROID_FILE_VERSION = 8;

export async function exportLandroidFile(data: LandroidFileData): Promise<Blob> {
  const payload = {
    version: LANDROID_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
    documentData: await serializeDocumentData(data.documentData),
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

export async function exportPdfWorkspaceData(
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
    .where('entityKind')
    .equals('node')
    .and((row) => nodeIds.includes(row.entityId))
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
  const docs = await db.documents.bulkGet(docIds);
  const docById = new Map<string, NonNullable<typeof docs[number]>>();
  for (const doc of docs) {
    if (doc && doc.blob.size > 0) docById.set(doc.docId, doc);
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
 * Read every document + attachment touching the given nodes, with their
 * blobs, ready for v8 `.landroid` export. Workspace-scoped — only
 * documents that share the workspace ID with at least one of the
 * touched nodes are emitted.
 */
export async function exportDocumentWorkspaceData(
  workspaceId: string,
  nodes: OwnershipNode[]
): Promise<DocumentWorkspaceData> {
  const nodeIds = nodes.map((node) => node.id);
  if (nodeIds.length === 0) return { documents: [], attachments: [] };

  const attachments = await db.document_attachments
    .where('entityKind')
    .equals('node')
    .and((row) => nodeIds.includes(row.entityId))
    .toArray();
  const scopedAttachments = attachments.filter(
    (row) => row.workspaceId === workspaceId
  );
  if (scopedAttachments.length === 0) return { documents: [], attachments: [] };

  const docIds = [...new Set(scopedAttachments.map((a) => a.docId))];
  const docs = await db.documents.bulkGet(docIds);
  const documents: DocumentRecord[] = [];
  const docIdSeen = new Set<string>();
  for (const doc of docs) {
    if (doc && doc.workspaceId === workspaceId && doc.blob.size > 0) {
      documents.push(doc);
      docIdSeen.add(doc.docId);
    }
  }
  return {
    documents,
    attachments: scopedAttachments.filter((a) => docIdSeen.has(a.docId)),
  };
}

/**
 * Replace every document + attachment for the given workspace with the
 * supplied set. Used by `.landroid` import after `importLandroidFile`
 * resolves to v8 shape (either directly or via inline v7 migration).
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

  await db.transaction('rw', db.documents, db.document_attachments, async () => {
    // Drop every document scoped to this workspace.
    const existingDocs = await db.documents
      .where('workspaceId')
      .equals(workspaceId)
      .toArray();
    const existingDocIds = existingDocs.map((d) => d.docId);
    if (existingDocIds.length > 0) {
      await db.documents.bulkDelete(existingDocIds);
      // Cascade-delete attachments pointing at those docs.
      const existingAttachmentIds = await db.document_attachments
        .where('docId')
        .anyOf(existingDocIds)
        .primaryKeys();
      if (existingAttachmentIds.length > 0) {
        await db.document_attachments.bulkDelete(existingAttachmentIds);
      }
    }
    if (documents.length > 0) {
      await db.documents.bulkAdd(documents);
      await db.document_attachments.bulkAdd(attachments);
    }
  });
}

export async function replacePdfWorkspaceData(
  data: PdfWorkspaceData,
  nodes: OwnershipNode[]
): Promise<void> {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const pdfs = data.pdfs.filter(
    (pdf) => validNodeIds.has(pdf.nodeId) && pdf.blob.size > 0
  );

  await db.transaction('rw', db.pdfs, async () => {
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

  if (
    typeof parsed.version === 'number'
    && Number.isFinite(parsed.version)
    && parsed.version > LANDROID_FILE_VERSION
  ) {
    throw new Error(
      `Unsupported .landroid file version ${parsed.version}. This LANDroid build supports up to version ${LANDROID_FILE_VERSION}.`
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

  const researchImports =
    isRecord(parsed.researchData) && Array.isArray(parsed.researchData.imports)
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

  // Phase 5 / A5: dispatch on `version` so v7 files and v8 files both
  // arrive at the canonical v8 in-memory shape (documents +
  // document_attachments).
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
  if (fileVersion >= 8) {
    documentData = deserializeDocumentData(parsed.documentData);
    // Re-scope every doc to the file's workspaceId so callers that
    // import into a fresh workspace don't accidentally inherit a stale
    // workspaceId from the file.
    documentData = {
      documents: documentData.documents.map((doc) => ({
        ...doc,
        workspaceId,
      })),
      attachments: documentData.attachments,
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
  return {
    ...core,
    nodes,
    canvas: normalizeCanvasSaveData(parsed.canvas),
    documentData,
    ownerData,
    mapData,
    researchData,
    curativeData,
  };
}
