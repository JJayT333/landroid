/**
 * Persistence for federal lease documents (FED1/FED2).
 *
 * The reference-only BLM Form 3100-11 detail records used to live in an in-memory
 * `Map` (`federal-lease-seed.ts`) that died on reload, so "View Lease Document"
 * showed nothing after a refresh. These helpers persist them in a workspace-scoped
 * Dexie side-store; the in-memory `Map` is kept as the synchronous read cache,
 * hydrated from here on workspace open (so render-path callers stay sync).
 *
 * Federal records are reference-only and never feed Texas leasehold / Desk Map
 * math. There is no runtime create/edit path, so this is load / replace-all /
 * clear only — populated by the demo seed and (later) by `.landroid` import.
 */
import db from './db';
import {
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
} from './db-key-scope';
import type { FederalLeaseDocument } from './federal-lease-seed';

type FederalLeaseDocumentRow = FederalLeaseDocument & { id: string; workspaceId: string };

/** Load every federal lease document for the active-profile workspace. */
export async function loadFederalLeaseDocuments(
  workspaceId: string
): Promise<FederalLeaseDocument[]> {
  const rows = await db.federalLeaseDocuments
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
  return rows.map((row) => {
    const stripped = stripDbKeyAndStorageId(row, 'id') as FederalLeaseDocumentRow;
    const { id: _id, workspaceId: _ws, ...doc } = stripped;
    return doc as FederalLeaseDocument;
  });
}

/** Replace ALL federal lease documents for the workspace (demo seed / import). */
export async function replaceFederalLeaseDocuments(
  workspaceId: string,
  documents: FederalLeaseDocument[]
): Promise<void> {
  await db.transaction('rw', db.federalLeaseDocuments, async () => {
    await db.federalLeaseDocuments
      .where('[dbKey+workspaceId]')
      .equals(activeWorkspaceScope(workspaceId))
      .delete();
    if (documents.length > 0) {
      await db.federalLeaseDocuments.bulkPut(
        documents.map((doc) =>
          stampActiveDbKeyWithStorageId(
            { ...doc, id: doc.recordId, workspaceId } as FederalLeaseDocumentRow,
            'id'
          )
        )
      );
    }
  });
}

/** Drop every federal lease document for the workspace (workspace replace). */
export async function clearFederalLeaseDocumentsForWorkspace(
  workspaceId: string
): Promise<void> {
  await db.federalLeaseDocuments
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .delete();
}
