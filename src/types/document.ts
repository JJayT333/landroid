/**
 * Document attachment domain types for Phase 5
 * (see `docs/adr/0004-multi-doc-per-entity-persistence.md`).
 *
 * Two-table design:
 *   - {@link DocumentRecord}: the blob + metadata, workspace-scoped.
 *   - {@link DocumentAttachment}: polymorphic join from a document to any
 *     entity that wants to reference it.
 *
 * `entityKind: 'node'` is the only kind written by Phase 5 UI. Owner / lease
 * / curative / research surfaces use the same schema when they light up
 * later — no further migration needed.
 */

import type { ExternalRef } from './external-ref';

export const DOCUMENT_KIND_OPTIONS = [
  'deed',
  'lease',
  'obit',
  'affidavit',
  'probate',
  'related',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KIND_OPTIONS)[number];

export const DEFAULT_DOCUMENT_KIND: DocumentKind = 'other';

export const DOCUMENT_AREA_OPTIONS = [
  'inbox',
  'runsheet_mineral_title',
  'leasehold',
  'curative',
  'research',
  'gis_map_support',
  'federal_reference',
] as const;
export type DocumentArea = (typeof DOCUMENT_AREA_OPTIONS)[number];

export const DEFAULT_DOCUMENT_AREA: DocumentArea = 'inbox';

export const DOCUMENT_OCR_STATUS_OPTIONS = [
  'unknown',
  'not_started',
  'not_needed',
  'complete',
  'failed',
] as const;
export type DocumentOcrStatus = (typeof DOCUMENT_OCR_STATUS_OPTIONS)[number];

export const DOCUMENT_ENTITY_KINDS = [
  'node',
  'owner',
  'lease',
  'curative',
  'research',
] as const;
export type DocumentEntityKind = (typeof DOCUMENT_ENTITY_KINDS)[number];

export interface DocumentParties {
  grantor?: string;
  grantee?: string;
  lessor?: string;
  lessee?: string;
  notes?: string;
}

export interface DocumentRecord {
  /** Stable UUID. Primary key. */
  docId: string;
  /** Workspace scoping. Fixes the v7 audit gap of unscoped PDF rows. */
  workspaceId: string;
  /** User-visible filename. */
  fileName: string;
  /** MIME type. `application/pdf` is the only currently-supported type. */
  mimeType: string;
  /** Byte size of the stored blob. For future quota / display surfaces. */
  byteLength: number;
  /** sha-256 hex digest of the blob. Recorded for future dedup logic. */
  contentHash: string;
  /** The file itself. */
  blob: Blob;
  /** Document-type tag (deed/lease/obit/etc.). */
  kind: DocumentKind;
  /** Canonical saved-view area for the document registry. */
  area?: DocumentArea;
  /** Registry title. Defaults to `fileName` when blank. */
  displayTitle?: string;
  /**
   * Legacy Phase 7A field name. Import/read compatibility only; new writes
   * should use `area`.
   */
  documentArea?: DocumentArea;
  /** Registry metadata. Optional so v8 rows do not need a migration. */
  instrumentType?: string;
  county?: string;
  state?: string;
  instrumentNumber?: string;
  volume?: string;
  page?: string;
  /** Canonical instrument/execution date. */
  instrumentDate?: string;
  /** Legacy Phase 7A field name for `instrumentDate`. */
  effectiveDate?: string;
  recordingDate?: string;
  /** Canonical parties model. */
  parties?: DocumentParties;
  /** Legacy Phase 7A grantor/grantee fields. */
  grantor?: string;
  grantee?: string;
  notes?: string;
  /** Canonical source reference field. */
  sourceRef?: string;
  /** Legacy Phase 7A field name for `sourceRef`. */
  sourceReference?: string;
  /** OCR tracking hook only. Phase 7A does not extract text. */
  ocrStatus?: DocumentOcrStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * External-system references (ArcGIS, file paths, deep-link URLs).
   * Schema hook only — no current consumer; see
   * `src/types/external-ref.ts`.
   */
  externalRefs?: ExternalRef[];
}

export interface DocumentAttachment {
  /** Stable UUID. Primary key. */
  attachmentId: string;
  docId: string;
  entityKind: DocumentEntityKind;
  entityId: string;
  /** Display order within the entity's attachment row. Lower = earlier. */
  position: number;
  createdAt: string;
}

export function isDocumentKind(value: unknown): value is DocumentKind {
  return (
    typeof value === 'string'
    && (DOCUMENT_KIND_OPTIONS as readonly string[]).includes(value)
  );
}

export function normalizeDocumentKind(value: unknown): DocumentKind {
  return isDocumentKind(value) ? value : DEFAULT_DOCUMENT_KIND;
}

export function isDocumentArea(value: unknown): value is DocumentArea {
  return (
    typeof value === 'string'
    && (DOCUMENT_AREA_OPTIONS as readonly string[]).includes(value)
  );
}

export function normalizeDocumentArea(value: unknown): DocumentArea {
  return isDocumentArea(value) ? value : DEFAULT_DOCUMENT_AREA;
}

export function isDocumentOcrStatus(value: unknown): value is DocumentOcrStatus {
  return (
    typeof value === 'string'
    && (DOCUMENT_OCR_STATUS_OPTIONS as readonly string[]).includes(value)
  );
}

export function normalizeDocumentOcrStatus(value: unknown): DocumentOcrStatus {
  return isDocumentOcrStatus(value) ? value : 'unknown';
}

export function isDocumentEntityKind(value: unknown): value is DocumentEntityKind {
  return (
    typeof value === 'string'
    && (DOCUMENT_ENTITY_KINDS as readonly string[]).includes(value)
  );
}

function cleanOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeDocumentParties(value: unknown): DocumentParties | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<Record<keyof DocumentParties, unknown>>;
  const parties: DocumentParties = {};
  for (const key of ['grantor', 'grantee', 'lessor', 'lessee', 'notes'] as const) {
    const cleaned = cleanOptionalString(record[key]);
    if (cleaned) parties[key] = cleaned;
  }
  return Object.keys(parties).length > 0 ? parties : undefined;
}

export function getDocumentAreaMetadata(
  doc: Pick<DocumentRecord, 'area' | 'documentArea'>
): DocumentArea | undefined {
  if (isDocumentArea(doc.area)) return doc.area;
  if (isDocumentArea(doc.documentArea)) return doc.documentArea;
  return undefined;
}

export function getDocumentParties(
  doc: Pick<DocumentRecord, 'parties' | 'grantor' | 'grantee'>
): DocumentParties {
  const parties = normalizeDocumentParties(doc.parties) ?? {};
  if (!parties.grantor) {
    const grantor = cleanOptionalString(doc.grantor);
    if (grantor) parties.grantor = grantor;
  }
  if (!parties.grantee) {
    const grantee = cleanOptionalString(doc.grantee);
    if (grantee) parties.grantee = grantee;
  }
  return parties;
}

export function getDocumentSourceRef(
  doc: Pick<DocumentRecord, 'sourceRef' | 'sourceReference'>
): string {
  return cleanOptionalString(doc.sourceRef)
    ?? cleanOptionalString(doc.sourceReference)
    ?? '';
}

export function getDocumentInstrumentDate(
  doc: Pick<DocumentRecord, 'instrumentDate' | 'effectiveDate'>
): string {
  return cleanOptionalString(doc.instrumentDate)
    ?? cleanOptionalString(doc.effectiveDate)
    ?? '';
}

export function documentNeedsOcr(
  doc: Pick<DocumentRecord, 'ocrStatus'>
): boolean {
  return doc.ocrStatus === 'not_started' || doc.ocrStatus === 'failed';
}
