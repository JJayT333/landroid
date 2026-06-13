/**
 * Canvas asset store — content-addressed binary blobs for flowchart image
 * nodes. Deliberately separate from the `documents` evidence vault (those are
 * fixity-checked chain-of-custody records; these are illustrative images).
 *
 * Identity is the SHA-256 of the blob within a workspace, so the same image
 * dropped twice dedupes to one row. Image nodes store only the hash + display
 * size, keeping the canvas JSON small no matter how many images.
 */
import db, { type CanvasAssetRecord } from './db';
import { sha256HexOfBlob } from './blob-hash';
import { activeWorkspaceScope, stampActiveDbKeyWithStorageId } from './db-key-scope';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWriteFence,
} from './workspace-write-lease';

/** Cap a single canvas image at 8 MB (post-downscale) to protect storage. */
export const MAX_CANVAS_ASSET_BYTES = 8 * 1024 * 1024;

export interface SaveCanvasAssetResult {
  contentHash: string;
  mimeType: string;
  byteLength: number;
}

async function findAssetRow(
  workspaceId: string,
  contentHash: string
): Promise<CanvasAssetRecord | undefined> {
  return db.canvasAssets
    .where('[dbKey+workspaceId+contentHash]')
    .equals([...activeWorkspaceScope(workspaceId), contentHash])
    .first();
}

/**
 * Persist an image blob and return its content hash. Deduplicates: if the same
 * bytes already exist for this workspace, no new row is written.
 */
export async function saveCanvasAsset(
  blob: Blob,
  workspaceId: string,
  fileName?: string
): Promise<SaveCanvasAssetResult> {
  if (blob.size > MAX_CANVAS_ASSET_BYTES) {
    throw new Error(
      `Image is too large (${(blob.size / (1024 * 1024)).toFixed(1)} MB; limit is ${(MAX_CANVAS_ASSET_BYTES / (1024 * 1024)).toFixed(0)} MB).`
    );
  }
  const contentHash = await sha256HexOfBlob(blob);
  const mimeType = blob.type || 'application/octet-stream';

  await ensureWorkspaceWriteFence(workspaceId);
  await db.transaction('rw', db.workspaceWriteLeases, db.canvasAssets, async () => {
    await assertWorkspaceWriteFence(workspaceId);
    const existing = await findAssetRow(workspaceId, contentHash);
    if (existing) return;
    const record: CanvasAssetRecord = {
      id: contentHash, // scoped below
      workspaceId,
      contentHash,
      mimeType,
      byteLength: blob.size,
      blob,
      fileName,
      createdAt: new Date().toISOString(),
    };
    await db.canvasAssets.add(stampActiveDbKeyWithStorageId(record, 'id'));
  });

  return { contentHash, mimeType, byteLength: blob.size };
}

/** Fetch an asset blob by content hash, or undefined if missing. */
export async function getCanvasAssetBlob(
  contentHash: string,
  workspaceId: string
): Promise<Blob | undefined> {
  const row = await findAssetRow(workspaceId, contentHash);
  return row?.blob;
}

/** All asset rows for a workspace (used by .landroid export). */
export async function listCanvasAssets(
  workspaceId: string
): Promise<CanvasAssetRecord[]> {
  return db.canvasAssets
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
}

/** Insert an imported asset row if absent (used by .landroid import). */
export async function putImportedCanvasAsset(
  record: Omit<CanvasAssetRecord, 'id'>
): Promise<void> {
  const existing = await findAssetRow(record.workspaceId, record.contentHash);
  if (existing) return;
  await db.canvasAssets.add(
    stampActiveDbKeyWithStorageId({ ...record, id: record.contentHash }, 'id')
  );
}
