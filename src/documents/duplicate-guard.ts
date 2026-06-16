/**
 * Ingest dedup guard — warn-and-choose, never automatic.
 *
 * The operator's rule: a duplicate file (byte-identical bytes already in the
 * workspace) must surface a *warning* and let the user decide — never be
 * silently skipped, deduplicated, or merged. So this module only *detects*: it
 * hashes a candidate file the same way `saveDoc` will (normalize → SHA-256),
 * looks up existing documents that share those exact bytes, and reports the
 * matches. The decision (attach a copy anyway / cancel) stays in the UI.
 *
 * Pairs with the registry "Duplicates" view (`buildDuplicateMap`), which flags
 * the same byte-identity after the fact; this catches it at the moment of
 * ingest, before a second copy is written.
 */
import { normalizePdfBlob } from '../utils/pdf-validation';
import { sha256HexOfBlob } from '../storage/blob-hash';
import { findDocsByContentHash } from '../storage/document-store';
import type { DocumentKind } from '../types/document';

export interface DuplicateMatch {
  docId: string;
  /** The existing document's filename (registry display). */
  fileName: string;
  kind: DocumentKind;
  createdAt: string;
}

export interface DuplicateInspection {
  /** The content hash of the (normalized) candidate file. */
  contentHash: string;
  /** Existing workspace documents that are byte-identical to the candidate. */
  matches: DuplicateMatch[];
}

/** A document shape carrying just what the warning needs (no blob). */
type DuplicateCandidateDoc = Pick<
  DuplicateMatch,
  'docId' | 'fileName' | 'kind' | 'createdAt'
>;

/**
 * Pure: from a candidate hash + the existing same-hash documents, build the
 * inspection the UI renders. Kept separate from the Dexie/hash I/O so it is
 * trivially unit-testable.
 */
export function buildDuplicateInspection(
  contentHash: string,
  existing: ReadonlyArray<DuplicateCandidateDoc>
): DuplicateInspection {
  return {
    contentHash,
    matches: existing.map((doc) => ({
      docId: doc.docId,
      fileName: doc.fileName,
      kind: doc.kind,
      createdAt: doc.createdAt,
    })),
  };
}

/** True when the inspection found at least one byte-identical existing document. */
export function hasDuplicates(inspection: DuplicateInspection): boolean {
  return inspection.matches.length > 0;
}

/**
 * Hash a candidate file the same way `saveDoc` will (normalize the PDF blob,
 * then SHA-256) so a match here guarantees a byte-identical stored document.
 */
export async function hashCandidateFile(file: File): Promise<string> {
  const blob = await normalizePdfBlob(file, file.name);
  return sha256HexOfBlob(blob);
}

/**
 * Inspect a candidate file for byte-identical duplicates already in the
 * workspace. Detection only — the caller decides what to do with the result.
 */
export async function inspectFileForDuplicates(
  workspaceId: string,
  file: File
): Promise<DuplicateInspection> {
  const contentHash = await hashCandidateFile(file);
  const existing = await findDocsByContentHash(workspaceId, contentHash);
  return buildDuplicateInspection(contentHash, existing);
}
