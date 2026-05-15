/**
 * Pure migration helpers for the v7 `pdfs` → v8 `documents` + `document_attachments`
 * Dexie bump (Phase 5 / ADR 0004).
 *
 * Pulled out of `document-store.ts` so this logic is unit-testable without
 * a Dexie/IndexedDB harness. The Dexie `.upgrade()` callback wires these
 * pure helpers to the real `tx.table(...)` reads/writes.
 */

import type { PdfAttachment } from './db';
import {
  DEFAULT_DOCUMENT_KIND,
  type DocumentAttachment,
  type DocumentRecord,
} from '../types/document';

/**
 * Inject everything that touches `crypto`, time, or the global async hash
 * API so tests can assert deterministic output. The Dexie upgrade callback
 * supplies real implementations.
 */
export interface DocumentMigrationDeps {
  generateId: () => string;
  hashBlob: (blob: Blob) => Promise<string>;
  now: () => string;
}

export interface MigrationResult {
  documents: DocumentRecord[];
  attachments: DocumentAttachment[];
  /** Node IDs in `pdfs` that did not appear in any workspace's nodes list. */
  orphans: string[];
}

/**
 * Translate every row in the v7 `pdfs` table into a (`DocumentRecord`,
 * `DocumentAttachment`) pair, scoped to the workspace whose nodes list
 * contains the node ID.
 *
 * A node ID that does not appear in any workspace falls back to
 * `fallbackWorkspaceId` (typically the first workspace's ID) and is
 * reported in `orphans` so callers can surface a warning. Returning the
 * blob anyway is preferable to silently dropping user data; an orphan is
 * recoverable, a deleted blob is not.
 *
 * Attachments are emitted with `entityKind: 'node'` and `position: 0`. The
 * v7 schema only ever attached one PDF per node, so all migrated rows are
 * the first in their entity's attachment list.
 */
export async function migratePdfsToDocuments(
  pdfs: ReadonlyArray<PdfAttachment>,
  nodeIdToWorkspaceId: ReadonlyMap<string, string>,
  fallbackWorkspaceId: string,
  deps: DocumentMigrationDeps
): Promise<MigrationResult> {
  const documents: DocumentRecord[] = [];
  const attachments: DocumentAttachment[] = [];
  const orphans: string[] = [];

  for (const pdf of pdfs) {
    if (!pdf || !pdf.blob || pdf.blob.size === 0) {
      // v7 had a guard that empty blobs were never written; skip defensively.
      continue;
    }

    const resolvedWorkspaceId =
      nodeIdToWorkspaceId.get(pdf.nodeId) ?? fallbackWorkspaceId;
    if (!nodeIdToWorkspaceId.has(pdf.nodeId)) {
      orphans.push(pdf.nodeId);
    }

    const docId = deps.generateId();
    const createdAt = pdf.createdAt || deps.now();
    const contentHash = await deps.hashBlob(pdf.blob);

    documents.push({
      docId,
      workspaceId: resolvedWorkspaceId,
      fileName: pdf.fileName,
      mimeType: pdf.mimeType || 'application/pdf',
      byteLength: pdf.blob.size,
      contentHash,
      blob: pdf.blob,
      // No deed-text signal at migration time. `'other'` is the safe default;
      // the user can re-tag in the per-modal attachments section.
      kind: DEFAULT_DOCUMENT_KIND,
      createdAt,
      updatedAt: createdAt,
    });

    attachments.push({
      attachmentId: deps.generateId(),
      docId,
      entityKind: 'node',
      entityId: pdf.nodeId,
      position: 0,
      createdAt,
    });
  }

  return { documents, attachments, orphans };
}

/**
 * Build a `nodeId → workspaceId` map from the v7 `workspaces` table.
 * Each row's `data` field is a JSON-serialized workspace state whose
 * `nodes` array carries node IDs. Workspaces whose JSON is unparseable or
 * malformed are skipped — the migration falls back to the orphan path for
 * any nodes they would have owned.
 */
export function buildNodeWorkspaceIndex(
  workspaceRows: ReadonlyArray<{ id: string; data: string }>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of workspaceRows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') {
      continue;
    }
    const nodes = (parsed as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) {
      continue;
    }
    for (const node of nodes) {
      if (
        node
        && typeof node === 'object'
        && typeof (node as { id?: unknown }).id === 'string'
      ) {
        const nodeId = (node as { id: string }).id;
        if (!index.has(nodeId)) {
          // First workspace wins — node IDs are globally unique in v7, so
          // collisions imply duplicate workspaces and we keep the earliest.
          index.set(nodeId, row.id);
        }
      }
    }
  }
  return index;
}
