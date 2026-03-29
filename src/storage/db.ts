/**
 * Dexie database — IndexedDB storage for LANDroid v2.
 *
 * Tables:
 *   pdfs       — PDF file attachments keyed by nodeId
 *   workspaces — auto-saved workspace state
 */
import Dexie, { type EntityTable } from 'dexie';
import type { ContactLog, Lease, Owner, OwnerDoc } from '../types/owner';
import type { MapAsset } from '../types/map';

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

export interface CanvasRecord {
  id: string;
  data: string; // JSON-serialized canvas state
  savedAt: string;
}

const db = new Dexie('landroid-v2') as Dexie & {
  pdfs: EntityTable<PdfAttachment, 'nodeId'>;
  workspaces: EntityTable<WorkspaceRecord, 'id'>;
  canvases: EntityTable<CanvasRecord, 'id'>;
  owners: EntityTable<Owner, 'id'>;
  leases: EntityTable<Lease, 'id'>;
  contactLogs: EntityTable<ContactLog, 'id'>;
  ownerDocs: EntityTable<OwnerDoc, 'id'>;
  mapAssets: EntityTable<MapAsset, 'id'>;
};

db.version(1).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
});

db.version(2).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
});

db.version(3).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, workspaceId, name',
  leases: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  contactLogs: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  ownerDocs: 'id, workspaceId, ownerId, leaseId, [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, workspaceId, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
});

export default db;
