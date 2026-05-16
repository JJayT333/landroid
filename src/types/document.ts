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
  /** Registry title. Defaults to `fileName` when blank. */
  displayTitle?: string;
  /** Saved-view area for the document registry. */
  documentArea?: DocumentArea;
  /** Registry metadata. Optional so v8 rows do not need a migration. */
  instrumentType?: string;
  county?: string;
  instrumentNumber?: string;
  volume?: string;
  page?: string;
  effectiveDate?: string;
  recordingDate?: string;
  grantor?: string;
  grantee?: string;
  notes?: string;
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
  return isDocumentOcrStatus(value) ? value : 'not_started';
}

export function isDocumentEntityKind(value: unknown): value is DocumentEntityKind {
  return (
    typeof value === 'string'
    && (DOCUMENT_ENTITY_KINDS as readonly string[]).includes(value)
  );
}
