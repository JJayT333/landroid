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
  createdAt: string;
  updatedAt: string;
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

export function isDocumentEntityKind(value: unknown): value is DocumentEntityKind {
  return (
    typeof value === 'string'
    && (DOCUMENT_ENTITY_KINDS as readonly string[]).includes(value)
  );
}
