/**
 * Dexie database — IndexedDB storage for LANDroid v2.
 *
 * Tables:
 *   pdfs       — PDF file attachments keyed by nodeId
 *   workspaces — auto-saved workspace state
 */
import Dexie, { type EntityTable } from 'dexie';
import type { ContactLog, Lease, Owner, OwnerDoc } from '../types/owner';
import type { MapAsset, MapExternalReference, MapRegion } from '../types/map';
import type {
  ResearchFormula,
  ResearchImport,
  ResearchProjectRecord,
  ResearchQuestion,
  ResearchSource,
} from '../types/research';
import type { TitleIssue } from '../types/title-issue';

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
  mapRegions: EntityTable<MapRegion, 'id'>;
  mapExternalReferences: EntityTable<MapExternalReference, 'id'>;
  researchImports: EntityTable<ResearchImport, 'id'>;
  researchSources: EntityTable<ResearchSource, 'id'>;
  researchFormulas: EntityTable<ResearchFormula, 'id'>;
  researchProjectRecords: EntityTable<ResearchProjectRecord, 'id'>;
  researchQuestions: EntityTable<ResearchQuestion, 'id'>;
  titleIssues: EntityTable<TitleIssue, 'id'>;
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

db.version(4).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, workspaceId, name',
  leases: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  contactLogs: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  ownerDocs: 'id, workspaceId, ownerId, leaseId, [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapRegions:
    'id, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapExternalReferences:
    'id, workspaceId, assetId, regionId, source, [workspaceId+assetId], [workspaceId+regionId]',
});

db.version(5).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, workspaceId, name',
  leases: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  contactLogs: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  ownerDocs:
    'id, workspaceId, ownerId, leaseId, [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapRegions:
    'id, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapExternalReferences:
    'id, workspaceId, assetId, regionId, source, [workspaceId+assetId], [workspaceId+regionId]',
  researchImports:
    'id, workspaceId, datasetId, detectedFormat, [workspaceId+datasetId], [workspaceId+detectedFormat]',
});

db.version(6).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, workspaceId, name',
  leases: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  contactLogs: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  ownerDocs:
    'id, workspaceId, ownerId, leaseId, [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapRegions:
    'id, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId]',
  mapExternalReferences:
    'id, workspaceId, assetId, regionId, source, [workspaceId+assetId], [workspaceId+regionId]',
  researchImports:
    'id, workspaceId, datasetId, detectedFormat, [workspaceId+datasetId], [workspaceId+detectedFormat]',
  titleIssues:
    'id, workspaceId, status, priority, issueType, affectedDeskMapId, affectedNodeId, affectedOwnerId, affectedLeaseId, [workspaceId+status], [workspaceId+priority]',
});

db.version(7).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, workspaceId, name',
  leases: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  contactLogs: 'id, workspaceId, ownerId, [workspaceId+ownerId]',
  ownerDocs:
    'id, workspaceId, ownerId, leaseId, [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapRegions:
    'id, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapExternalReferences:
    'id, workspaceId, assetId, regionId, source, [workspaceId+assetId], [workspaceId+regionId]',
  researchImports:
    'id, workspaceId, datasetId, detectedFormat, [workspaceId+datasetId], [workspaceId+detectedFormat]',
  researchSources:
    'id, workspaceId, sourceType, context, [workspaceId+sourceType], [workspaceId+context]',
  researchFormulas:
    'id, workspaceId, category, status, [workspaceId+category], [workspaceId+status]',
  researchProjectRecords:
    'id, workspaceId, recordType, jurisdiction, status, [workspaceId+recordType], [workspaceId+jurisdiction], [workspaceId+status]',
  researchQuestions:
    'id, workspaceId, status, [workspaceId+status]',
  titleIssues:
    'id, workspaceId, status, priority, issueType, affectedDeskMapId, affectedNodeId, affectedOwnerId, affectedLeaseId, [workspaceId+status], [workspaceId+priority]',
});

export default db;
