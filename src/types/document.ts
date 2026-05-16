/**
 * Document attachment domain types for Phase 5
 * (see `docs/adr/0004-multi-doc-per-entity-persistence.md`).
 *
 * Two-table design:
 *   - {@link DocumentRecord}: the blob + metadata, workspace-scoped.
 *   - {@link DocumentAttachment}: polymorphic join from a document to any
 *     entity that wants to reference it.
 *
 * `entityKind: 'node'` is the only kind written by the original Phase 5 UI.
 * Owner / lease / curative / research surfaces share the same schema.
 *
 * Phase 7A (document registry build) adds optional metadata fields:
 * `area`, instrument identifiers, parties, dates, notes, source
 * reference. Every field is optional and unset documents read back with
 * `area` derived from `kind` via {@link deriveDocumentArea}.
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

export const DOCUMENT_ENTITY_KINDS = [
  'node',
  'owner',
  'lease',
  'curative',
  'research',
] as const;
export type DocumentEntityKind = (typeof DOCUMENT_ENTITY_KINDS)[number];

/**
 * Filing area for the document registry — separates the seven document
 * populations a landman actually works with so saved views and the
 * title-opinion packet builder can stay clean. The area is metadata; it
 * does not affect ownership math.
 */
export const DOCUMENT_AREA_OPTIONS = [
  'mineral_title',
  'project_support',
  'leasehold',
  'curative',
  'research',
  'gis_map_support',
  'federal_reference',
  'other',
] as const;
export type DocumentArea = (typeof DOCUMENT_AREA_OPTIONS)[number];

export const DEFAULT_DOCUMENT_AREA: DocumentArea = 'other';

export const DOCUMENT_AREA_LABELS: Record<DocumentArea, string> = {
  mineral_title: 'Mineral Title',
  project_support: 'Project Support',
  leasehold: 'Leasehold',
  curative: 'Curative',
  research: 'Research',
  gis_map_support: 'GIS / Map Support',
  federal_reference: 'Federal Reference',
  other: 'Other',
};

/**
 * Parties recorded against a document. The four common Texas roles are
 * documented; callers can leave any field unset.
 */
export interface DocumentParties {
  grantor?: string;
  grantee?: string;
  lessor?: string;
  lessee?: string;
  /** Free-form party notes (e.g. "et ux", "Trustee of …"). */
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
  createdAt: string;
  updatedAt: string;
  /**
   * External-system references (ArcGIS, file paths, deep-link URLs).
   * Schema hook only — no current consumer; see
   * `src/types/external-ref.ts`.
   */
  externalRefs?: ExternalRef[];
  /**
   * Filing area for the registry. When absent, callers should derive a
   * default via {@link deriveDocumentArea} so legacy v8 documents stay
   * sortable.
   */
  area?: DocumentArea;
  /** Optional human title separate from the filename. */
  displayTitle?: string;
  /** Free-form instrument-type label, e.g. "Mineral Deed". */
  instrumentType?: string;
  /** County (display string; no validated list). */
  county?: string;
  /** State (display string; no validated list). */
  state?: string;
  /** Instrument / execution date (ISO `YYYY-MM-DD`). */
  instrumentDate?: string;
  /** Recording / file date (ISO `YYYY-MM-DD`). */
  recordingDate?: string;
  /** Recording volume / book. */
  volume?: string;
  /** Recording page. */
  page?: string;
  /** Instrument number / clerk's file number. */
  instrumentNumber?: string;
  /** Optional grantor/grantee/lessor/lessee snapshot. */
  parties?: DocumentParties;
  /** Free-form notes — abstractor remarks, summary, or status. */
  notes?: string;
  /** Optional display-only source reference (Dropbox path, packet label). */
  sourceRef?: string;
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

export function isDocumentArea(value: unknown): value is DocumentArea {
  return (
    typeof value === 'string'
    && (DOCUMENT_AREA_OPTIONS as readonly string[]).includes(value)
  );
}

/**
 * Map a document `kind` to its most common filing area. Used when a
 * record lacks an explicit `area` so registry filters and saved views
 * still group sensibly.
 */
export function deriveDocumentArea(kind: DocumentKind): DocumentArea {
  switch (kind) {
    case 'deed':
    case 'obit':
    case 'affidavit':
    case 'probate':
      return 'mineral_title';
    case 'lease':
      return 'leasehold';
    case 'related':
      return 'research';
    case 'other':
    default:
      return 'other';
  }
}

/** Explicit `area` wins; otherwise fall back to the kind-derived default. */
export function effectiveDocumentArea(
  doc: Pick<DocumentRecord, 'area' | 'kind'>
): DocumentArea {
  return doc.area ?? deriveDocumentArea(doc.kind);
}

export function normalizeDocumentArea(
  value: unknown,
  fallbackKind: DocumentKind
): DocumentArea {
  if (isDocumentArea(value)) return value;
  return deriveDocumentArea(fallbackKind);
}
