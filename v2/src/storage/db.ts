/**
 * Dexie database — IndexedDB storage for LANDroid v2.
 *
 * Tables:
 *   pdfs       — PDF file attachments keyed by nodeId
 *   workspaces — auto-saved workspace state
 */
import Dexie, { type EntityTable } from 'dexie';

export interface PdfAttachment {
  nodeId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  projectName: string;
  data: string; // JSON-serialized workspace state
  savedAt: string;
}

const db = new Dexie('landroid-v2') as Dexie & {
  pdfs: EntityTable<PdfAttachment, 'nodeId'>;
  workspaces: EntityTable<WorkspaceRecord, 'id'>;
};

db.version(1).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
});

export default db;
