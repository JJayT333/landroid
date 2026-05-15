/**
 * Phase 5 / A5b: one-shot auto-`.landroid` v7 backup hook.
 *
 * The v7 → v8 Dexie migration (see {@link ./db.ts}) is non-destructive —
 * the old `pdfs` table is left in place read-only, the v8 `documents` +
 * `document_attachments` tables get a copy. The backup hook captures the
 * still-present v7 state into a downloadable `.landroid` file so the
 * user has a guaranteed rollback artifact, fired exactly once after the
 * first boot that crosses the v8 boundary.
 *
 * Design rules:
 * - Fires once. Tracked via a `localStorage` flag so a refresh inside the
 *   same session doesn't re-download.
 * - PDF-blob-only payload. Owner/map/research/curative tables are
 *   untouched by the schema bump, so they're preserved without copying.
 *   The user can re-export a full v8 `.landroid` from the app any time.
 * - One file per workspace. Local mode usually has one; hosted mode may
 *   have several (per Cognito `sub`).
 * - Errors are warnings, not failures. The flag still gets set on
 *   first-success-or-no-data so a transient localStorage hiccup doesn't
 *   block subsequent boots.
 *
 * The pure helper {@link buildV7BackupPayload} is testable without Dexie,
 * `localStorage`, or DOM access. The Dexie/DOM glue lives in
 * {@link runPostV8BackupIfNeeded}.
 */

import type { PdfAttachment, WorkspaceRecord } from './db';
import { serializePdfData } from './workspace-persistence';

export const POST_V8_BACKUP_FLAG = 'landroid:postV8BackupComplete';

export interface V7BackupInputs {
  workspace: Pick<WorkspaceRecord, 'id' | 'projectName' | 'data'>;
  pdfs: ReadonlyArray<PdfAttachment>;
}

/**
 * Build the v7 `.landroid` payload object from a workspace row + its
 * matching PDFs. Pure: no Dexie, no DOM, no `localStorage`.
 *
 * Returns `null` when the workspace's `data` JSON is unparseable or when
 * there are no PDFs to back up (in which case the caller should skip the
 * download but still mark the flag as set).
 */
export function buildV7BackupPayload(
  inputs: V7BackupInputs
): { version: 7; payload: Record<string, unknown> } | null {
  if (inputs.pdfs.length === 0) return null;
  let workspaceData: Record<string, unknown>;
  try {
    const parsed = JSON.parse(inputs.workspace.data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    workspaceData = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  return {
    version: 7,
    payload: {
      version: 7,
      exportedAt: new Date().toISOString(),
      ...workspaceData,
      pdfData: {
        // The base64 encoding happens in the Dexie-glue caller via
        // {@link serializePdfData}; the pure helper just passes the
        // already-serialized blob descriptors through (callers that want
        // a fully-serialized payload should call `serializeBackupPayload`).
        pdfs: inputs.pdfs.map((pdf) => ({
          nodeId: pdf.nodeId,
          fileName: pdf.fileName,
          mimeType: pdf.mimeType,
          createdAt: pdf.createdAt,
          // Blob placeholder — replaced by serializePdfData in the glue
          // layer. Pure callers can use the raw Blob; serialization
          // happens just-in-time before download.
          blob: pdf.blob,
        })),
      },
    },
  };
}

/**
 * Resolve which PDF rows belong to a given workspace by intersecting
 * `pdf.nodeId` with the workspace's nodes list (parsed from
 * `workspace.data`). Pure.
 */
export function pickPdfsForWorkspace(
  workspaceData: string,
  pdfs: ReadonlyArray<PdfAttachment>
): PdfAttachment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(workspaceData);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const nodes = (parsed as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (node && typeof node === 'object') {
      const id = (node as { id?: unknown }).id;
      if (typeof id === 'string') nodeIds.add(id);
    }
  }
  return pdfs.filter((pdf) => nodeIds.has(pdf.nodeId));
}

/**
 * Injection points so the Dexie/DOM glue can be tested without a real
 * IndexedDB or browser. Production callers use {@link runPostV8BackupIfNeeded}
 * which wires the real implementations.
 */
export interface PostV8BackupDeps {
  readFlag: () => string | null;
  writeFlag: (value: string) => void;
  listWorkspaces: () => Promise<WorkspaceRecord[]>;
  listPdfs: () => Promise<PdfAttachment[]>;
  downloadFile: (fileName: string, blob: Blob) => void;
  now: () => string;
}

/**
 * One-shot backup runner. Returns the number of `.landroid` files
 * triggered (0 when nothing to back up, or when the flag is already
 * set). Safe to call on every boot — short-circuits on the flag.
 */
export async function runBackupWithDeps(deps: PostV8BackupDeps): Promise<number> {
  if (deps.readFlag() != null) return 0;

  let pdfs: PdfAttachment[];
  let workspaces: WorkspaceRecord[];
  try {
    [pdfs, workspaces] = await Promise.all([deps.listPdfs(), deps.listWorkspaces()]);
  } catch (err) {
    console.warn('[landroid post-v8 backup] Dexie read failed:', err);
    return 0;
  }

  if (pdfs.length === 0 || workspaces.length === 0) {
    // No pre-migration data worth backing up. Still set the flag so
    // future boots don't re-probe.
    safelyWriteFlag(deps);
    return 0;
  }

  let written = 0;
  for (const workspace of workspaces) {
    try {
      const matchingPdfs = pickPdfsForWorkspace(workspace.data, pdfs);
      if (matchingPdfs.length === 0) continue;

      const parsed = JSON.parse(workspace.data) as Record<string, unknown>;
      const serializedPdfData = await serializePdfData({ pdfs: matchingPdfs });
      const payload = {
        version: 7,
        exportedAt: deps.now(),
        ...parsed,
        pdfData: serializedPdfData,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const stamp = deps.now().replace(/[:.]/g, '-');
      const projectSlug = (workspace.projectName || workspace.id || 'workspace')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .slice(0, 64);
      deps.downloadFile(`${projectSlug}-pre-v8-backup-${stamp}.landroid`, blob);
      written += 1;
    } catch (err) {
      console.warn(
        `[landroid post-v8 backup] workspace ${workspace.id} backup failed:`,
        err
      );
    }
  }

  safelyWriteFlag(deps);
  return written;
}

function safelyWriteFlag(deps: PostV8BackupDeps): void {
  try {
    deps.writeFlag(deps.now());
  } catch (err) {
    console.warn('[landroid post-v8 backup] could not set flag:', err);
  }
}

/**
 * Production entry point. Wires real `localStorage`, Dexie, and DOM
 * download. Call once at boot after `db.open()` resolves.
 */
export async function runPostV8BackupIfNeeded(): Promise<number> {
  const { default: db } = await import('./db');
  return runBackupWithDeps({
    readFlag: () => {
      try {
        return localStorage.getItem(POST_V8_BACKUP_FLAG);
      } catch {
        return null;
      }
    },
    writeFlag: (value) => {
      try {
        localStorage.setItem(POST_V8_BACKUP_FLAG, value);
      } catch {
        // Quota / private-mode failures aren't actionable here.
      }
    },
    listWorkspaces: () => db.workspaces.toArray(),
    listPdfs: () => db.pdfs.toArray(),
    downloadFile: (fileName, blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    now: () => new Date().toISOString(),
  });
}
