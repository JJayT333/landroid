/**
 * Source-citation hook (Phase 5 ride-along).
 *
 * Lightweight pointer from a LANDroid fact back to the document
 * evidence that supports it. The shape is defined here so future
 * consumers — curative issues, leasehold warnings, AI extraction
 * results, attorney review packets — have a canonical type to import,
 * without re-litigating field names later.
 *
 * **No record currently carries `citations[]`.** This file is shape-only.
 * Optional fields can be added to any record later without a Dexie
 * schema migration or a `.landroid` version bump.
 *
 * Future uses (from the Phase 5 brainstorm):
 *   - "This ownership fraction came from this deed."
 *   - "This lease royalty came from page 2 of this lease."
 *   - "This curative issue came from this title opinion paragraph."
 *   - "This warning is tied to this affidavit/probate document."
 *   - "This AI extraction was approved from this PDF page."
 */

export interface SourceCitation {
  /**
   * The {@link import('./document').DocumentRecord} that supports the
   * fact. Stable UUID across export/import.
   */
  docId: string;
  /** 1-indexed page number, when the citation is page-specific. */
  page?: number;
  /** Short human-readable label (e.g., `'page 2, royalty clause'`). */
  label?: string;
  /** Reviewer note attached to the citation. */
  note?: string;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 1) return undefined;
  return Math.floor(value);
}

/**
 * Coerce arbitrary input to a {@link SourceCitation}, or return `null`
 * when the docId is missing or non-string. A citation without a docId
 * has no business link and is dropped.
 */
export function normalizeSourceCitation(value: unknown): SourceCitation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as {
    docId?: unknown;
    page?: unknown;
    label?: unknown;
    note?: unknown;
  };
  if (typeof raw.docId !== 'string' || raw.docId.trim().length === 0) {
    return null;
  }
  const citation: SourceCitation = { docId: raw.docId };
  const page = asOptionalPositiveInt(raw.page);
  if (page !== undefined) citation.page = page;
  const label = asOptionalString(raw.label);
  if (label !== undefined) citation.label = label;
  const note = asOptionalString(raw.note);
  if (note !== undefined) citation.note = note;
  return citation;
}

/**
 * Normalize an optional array of citations. Returns `undefined` (not an
 * empty array) when the input would be empty so records stay
 * byte-identical on round-trip serialization when no citations are set.
 */
export function normalizeSourceCitations(
  value: unknown
): SourceCitation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SourceCitation[] = [];
  for (const entry of value) {
    const normalized = normalizeSourceCitation(entry);
    if (normalized) out.push(normalized);
  }
  return out.length > 0 ? out : undefined;
}
