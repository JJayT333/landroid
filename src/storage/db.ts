/**
 * Dexie database — IndexedDB storage for LANDroid v2.
 *
 * Tables:
 *   pdfs                 — v7 single-PDF-per-node attachments. Kept
 *                          read-only for one rollback version; new writes
 *                          go through `documents` + `document_attachments`.
 *   documents            — v8 workspace-scoped document blobs (Phase 5).
 *   document_attachments — v8 polymorphic join (node | owner | lease |
 *                          curative | research). Only `'node'` rows are
 *                          written by this pass.
 *   workspaces           — pre-shard monolithic workspace row. As of the
 *                          Phase 0.5 shard writer it is a frozen migration-time
 *                          backup: autosave writes shards, not this row.
 *   workspace*Shards     — v10 Phase 0.5 workspace-sharding rows. These are now
 *                          the live load/save source of truth; the monolith is
 *                          a fallback only.
 *   workspaceWriteLeases — single-writer lease rows guarding shard writes.
 */
import Dexie, { type EntityTable, type Transaction } from 'dexie';
import type {
  DocumentAttachment,
  DocumentRecord,
} from '../types/document';
import type { LedgerBaselineProvenance } from '../backend-spine/contracts';
import {
  buildNodeWorkspaceIndex,
  migratePdfsToDocuments,
  type DocumentMigrationDeps,
} from './document-migration';
import { sha256HexOfBlob } from './blob-hash';
import type { ContactLog, Lease, Owner, OwnerDoc } from '../types/owner';
import type { LeasePurchaseReport } from '../types/lease-purchase-report';
import type { MapAsset, MapExternalReference, MapRegion } from '../types/map';
import type { MapTractFeature } from '../types/map-tract-feature';
import type { FederalLeaseDocument } from './federal-lease-seed';
import type {
  ResearchFormula,
  ResearchImport,
  ResearchProjectRecord,
  ResearchQuestion,
  ResearchSource,
} from '../types/research';
import type {
  StoredTitleActionRecord,
  StoredTitleAuditEvent,
  StoredTitleLedgerHeadMarker,
  StoredTitleLedgerQuarantine,
} from './title-ledger-stores';
import {
  TITLE_LEDGER_HEAD_MARKER_STORE_DEFINITION,
  TITLE_LEDGER_QUARANTINE_STORE_DEFINITION,
  TITLE_LEDGER_STORE_DEFINITIONS,
} from './title-ledger-stores';
import type { TitleIssue } from '../types/title-issue';
import { LANDROID_FILE_VERSION } from './landroid-file-version';
import {
  WORKSPACE_SHARD_STORE_DEFINITIONS,
  type DeskMapShard,
  type LeaseholdStateShard,
  type OwnershipNodeCompatShard,
  type WorkspaceManifestShard,
  type WorkspaceUiStateShard,
} from './workspace-shards';
import type { WorkspaceWriteLease } from './workspace-write-lock';
import { stampDbKeyWithStorageId, storageScopedId } from './db-key-scope';

type DbScoped<T extends { workspaceId: string }> = T & { dbKey?: string };

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

/**
 * Content-addressed binary asset referenced by a flowchart image node.
 *
 * Deliberately separate from the `documents` evidence vault: these are
 * illustrative canvas images (logos, map snippets, seals), NOT fixity-checked
 * evidence, so they must not co-mingle with chain-of-custody documents. Keyed
 * by SHA-256 so identical images dedupe to one blob within a workspace.
 */
export interface CanvasAssetRecord {
  id: string;
  workspaceId: string;
  contentHash: string;
  mimeType: string;
  byteLength: number;
  blob: Blob;
  fileName?: string;
  createdAt: string;
}

export interface SavedProjectRecord {
  id: string;
  indexDbKey: string;
  workspaceId: string;
  workspaceDbKey: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  /**
   * Lineage for a project created via Duplicate. Local convenience metadata
   * (not indexed, no migration) carried until the duplicate's first open seals
   * it into the genesis ledger baseline. Absent for non-duplicated projects.
   */
  derivedFrom?: LedgerBaselineProvenance;
}

const SAVED_PROJECTS_STORE_DEFINITION =
  'id, indexDbKey, workspaceId, workspaceDbKey, projectName, [indexDbKey+workspaceId], [indexDbKey+workspaceDbKey], [indexDbKey+lastOpenedAt], [indexDbKey+updatedAt], [indexDbKey+projectName]';

const db = new Dexie('landroid-v2') as Dexie & {
  pdfs: EntityTable<PdfAttachment, 'nodeId'>;
  documents: EntityTable<DbScoped<DocumentRecord>, 'docId'>;
  document_attachments: EntityTable<DbScoped<DocumentAttachment>, 'attachmentId'>;
  workspaces: EntityTable<WorkspaceRecord, 'id'>;
  canvases: EntityTable<CanvasRecord, 'id'>;
  canvasAssets: EntityTable<DbScoped<CanvasAssetRecord>, 'id'>;
  owners: EntityTable<DbScoped<Owner>, 'id'>;
  leases: EntityTable<DbScoped<Lease>, 'id'>;
  leasePurchaseReports: EntityTable<DbScoped<LeasePurchaseReport>, 'id'>;
  contactLogs: EntityTable<DbScoped<ContactLog>, 'id'>;
  ownerDocs: EntityTable<DbScoped<OwnerDoc>, 'id'>;
  mapAssets: EntityTable<DbScoped<MapAsset>, 'id'>;
  mapRegions: EntityTable<DbScoped<MapRegion>, 'id'>;
  mapExternalReferences: EntityTable<DbScoped<MapExternalReference>, 'id'>;
  mapTractFeatures: EntityTable<DbScoped<MapTractFeature>, 'id'>;
  federalLeaseDocuments: EntityTable<
    DbScoped<FederalLeaseDocument & { id: string; workspaceId: string }>,
    'id'
  >;
  researchImports: EntityTable<DbScoped<ResearchImport>, 'id'>;
  researchSources: EntityTable<DbScoped<ResearchSource>, 'id'>;
  researchFormulas: EntityTable<DbScoped<ResearchFormula>, 'id'>;
  researchProjectRecords: EntityTable<DbScoped<ResearchProjectRecord>, 'id'>;
  researchQuestions: EntityTable<DbScoped<ResearchQuestion>, 'id'>;
  titleIssues: EntityTable<DbScoped<TitleIssue>, 'id'>;
  workspaceManifestShards: EntityTable<WorkspaceManifestShard, 'id'>;
  deskMapShards: EntityTable<DeskMapShard, 'id'>;
  ownershipNodeCompatShards: EntityTable<OwnershipNodeCompatShard, 'id'>;
  leaseholdStateShards: EntityTable<LeaseholdStateShard, 'id'>;
  workspaceUiStateShards: EntityTable<WorkspaceUiStateShard, 'id'>;
  titleActionRecords: EntityTable<StoredTitleActionRecord, 'id'>;
  titleAuditEvents: EntityTable<StoredTitleAuditEvent, 'id'>;
  titleLedgerQuarantine: EntityTable<StoredTitleLedgerQuarantine, 'id'>;
  titleLedgerHeadMarkers: EntityTable<StoredTitleLedgerHeadMarker, 'id'>;
  workspaceWriteLeases: EntityTable<WorkspaceWriteLease, 'workspaceId'>;
  savedProjects: EntityTable<SavedProjectRecord, 'id'>;
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

/**
 * v8 (Phase 5 — multi-doc-per-entity persistence; see ADR 0004).
 *
 * Adds:
 *   - `documents` — workspace-scoped document blobs.
 *   - `document_attachments` — polymorphic join from a document to any
 *     entity that wants to reference it.
 *
 * Keeps:
 *   - `pdfs` is left in place (read-only for new code) so the v8 → v7
 *     rollback path remains intact for one release. The next Dexie bump
 *     can drop the table once the migration is field-proven.
 *
 * Migration:
 *   Each existing `pdfs` row becomes a (`documents`, `document_attachments`)
 *   pair. Pure logic lives in `./document-migration.ts` so the same
 *   transformation can be unit-tested without a Dexie/IndexedDB harness.
 *
 * Auto-`.landroid` v7 backup before the upgrade is wired separately in
 * Phase A4 (where it integrates with `workspace-persistence.ts`).
 */
db.version(8)
  .stores({
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
    documents:
      'docId, workspaceId, contentHash, [workspaceId+kind], [workspaceId+createdAt]',
    document_attachments:
      'attachmentId, docId, [entityKind+entityId], [docId+entityKind+entityId]',
  })
  .upgrade(async (tx) => {
    await runV7ToV8PdfMigration(tx);
  });

/**
 * v9 (main-readiness cleanup) scopes attachment rows directly by workspace.
 *
 * v8 could derive workspace through `documents.docId`, but the join rows did
 * not carry their own scope. Storing `workspaceId` on every attachment makes
 * entity-link queries explicit and prevents same-entity-id links from another
 * workspace from ever entering the result set.
 */
db.version(9)
  .stores({
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
    documents:
      'docId, workspaceId, contentHash, [workspaceId+kind], [workspaceId+createdAt]',
    document_attachments:
      'attachmentId, workspaceId, docId, [workspaceId+entityKind+entityId], [entityKind+entityId], [docId+entityKind+entityId]',
  })
  .upgrade(async (tx) => {
    await runV9DocumentAttachmentBackfill(tx);
  });

/**
 * v10 (Phase 0.5 — workspace shard table introduction).
 *
 * Adds backend-spine-shaped workspace manifest and Desk Map shard rows, plus
 * local-only compatibility rows for current title, leasehold, and UI state.
 * The monolithic `workspaces` row is preserved as a frozen rollback/diagnostic
 * backup; the shard reader/writer and write-lease gate are the live path.
 */
db.version(10)
  .stores({
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
    documents:
      'docId, workspaceId, contentHash, [workspaceId+kind], [workspaceId+createdAt]',
    document_attachments:
      'attachmentId, workspaceId, docId, [workspaceId+entityKind+entityId], [entityKind+entityId], [docId+entityKind+entityId]',
    ...WORKSPACE_SHARD_STORE_DEFINITIONS,
  })
  .upgrade(async (tx) => {
    await runV9ToV10WorkspaceShardMigration(tx);
  });

/**
 * v11 (LLA-H01 — per-user workspace row isolation).
 *
 * The v10 manifest was keyed by `dbKey`, but workspace child shards and
 * side-store tables still queried by `workspaceId` alone. v11 adds `dbKey`
 * to every workspace-scoped row plus `[dbKey+workspaceId]` indexes so hosted
 * users sharing one browser profile cannot read or delete one another's rows
 * when a `.landroid` import carries the same workspace id.
 */
db.version(11)
  .stores({
    pdfs: 'nodeId',
    workspaces: 'id',
    canvases: 'id',
    owners: 'id, dbKey, workspaceId, name, [dbKey+workspaceId], [dbKey+workspaceId+name]',
    leases:
      'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
    contactLogs:
      'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
    ownerDocs:
      'id, dbKey, workspaceId, ownerId, leaseId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [dbKey+workspaceId+leaseId], [workspaceId+ownerId], [workspaceId+leaseId]',
    mapAssets:
      'id, dbKey, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+isFeatured], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
    mapRegions:
      'id, dbKey, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
    mapExternalReferences:
      'id, dbKey, workspaceId, assetId, regionId, source, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+regionId], [workspaceId+assetId], [workspaceId+regionId]',
    researchImports:
      'id, dbKey, workspaceId, datasetId, detectedFormat, [dbKey+workspaceId], [dbKey+workspaceId+datasetId], [dbKey+workspaceId+detectedFormat], [workspaceId+datasetId], [workspaceId+detectedFormat]',
    researchSources:
      'id, dbKey, workspaceId, sourceType, context, [dbKey+workspaceId], [dbKey+workspaceId+sourceType], [dbKey+workspaceId+context], [workspaceId+sourceType], [workspaceId+context]',
    researchFormulas:
      'id, dbKey, workspaceId, category, status, [dbKey+workspaceId], [dbKey+workspaceId+category], [dbKey+workspaceId+status], [workspaceId+category], [workspaceId+status]',
    researchProjectRecords:
      'id, dbKey, workspaceId, recordType, jurisdiction, status, [dbKey+workspaceId], [dbKey+workspaceId+recordType], [dbKey+workspaceId+jurisdiction], [dbKey+workspaceId+status], [workspaceId+recordType], [workspaceId+jurisdiction], [workspaceId+status]',
    researchQuestions:
      'id, dbKey, workspaceId, status, [dbKey+workspaceId], [dbKey+workspaceId+status], [workspaceId+status]',
    titleIssues:
      'id, dbKey, workspaceId, status, priority, issueType, affectedDeskMapId, affectedNodeId, affectedOwnerId, affectedLeaseId, [dbKey+workspaceId], [dbKey+workspaceId+status], [dbKey+workspaceId+priority], [workspaceId+status], [workspaceId+priority]',
    documents:
      'docId, dbKey, workspaceId, contentHash, [dbKey+workspaceId], [dbKey+workspaceId+kind], [dbKey+workspaceId+createdAt], [workspaceId+kind], [workspaceId+createdAt]',
    document_attachments:
      'attachmentId, dbKey, workspaceId, docId, [dbKey+workspaceId], [dbKey+workspaceId+entityKind+entityId], [dbKey+workspaceId+docId], [workspaceId+entityKind+entityId], [entityKind+entityId], [docId+entityKind+entityId]',
    ...WORKSPACE_SHARD_STORE_DEFINITIONS,
  })
  .upgrade(async (tx) => {
    await runV10ToV11DbKeyBackfill(tx);
  });

/**
 * v12 (ACT-H03 runtime storage half).
 *
 * Adds title-runtime ledger stores for backend-spine `action_record` and
 * `audit_event` rows. The stored `id`, `dbKey`, and `position` fields are
 * Dexie-only metadata; `recordId` and audit hashes stay untouched so the
 * persisted chain can still be verified after hydration. Runtime flush/hydrate
 * is intentionally left to the lifecycle slice.
 */
db.version(12).stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, dbKey, workspaceId, name, [dbKey+workspaceId], [dbKey+workspaceId+name]',
  leases:
    'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
  contactLogs:
    'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
  ownerDocs:
    'id, dbKey, workspaceId, ownerId, leaseId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [dbKey+workspaceId+leaseId], [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, dbKey, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+isFeatured], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapRegions:
    'id, dbKey, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapExternalReferences:
    'id, dbKey, workspaceId, assetId, regionId, source, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+regionId], [workspaceId+assetId], [workspaceId+regionId]',
  researchImports:
    'id, dbKey, workspaceId, datasetId, detectedFormat, [dbKey+workspaceId], [dbKey+workspaceId+datasetId], [dbKey+workspaceId+detectedFormat], [workspaceId+datasetId], [workspaceId+detectedFormat]',
  researchSources:
    'id, dbKey, workspaceId, sourceType, context, [dbKey+workspaceId], [dbKey+workspaceId+sourceType], [dbKey+workspaceId+context], [workspaceId+sourceType], [workspaceId+context]',
  researchFormulas:
    'id, dbKey, workspaceId, category, status, [dbKey+workspaceId], [dbKey+workspaceId+category], [dbKey+workspaceId+status], [workspaceId+category], [workspaceId+status]',
  researchProjectRecords:
    'id, dbKey, workspaceId, recordType, jurisdiction, status, [dbKey+workspaceId], [dbKey+workspaceId+recordType], [dbKey+workspaceId+jurisdiction], [dbKey+workspaceId+status], [workspaceId+recordType], [workspaceId+jurisdiction], [workspaceId+status]',
  researchQuestions:
    'id, dbKey, workspaceId, status, [dbKey+workspaceId], [dbKey+workspaceId+status], [workspaceId+status]',
  titleIssues:
    'id, dbKey, workspaceId, status, priority, issueType, affectedDeskMapId, affectedNodeId, affectedOwnerId, affectedLeaseId, [dbKey+workspaceId], [dbKey+workspaceId+status], [dbKey+workspaceId+priority], [workspaceId+status], [workspaceId+priority]',
  documents:
    'docId, dbKey, workspaceId, contentHash, [dbKey+workspaceId], [dbKey+workspaceId+kind], [dbKey+workspaceId+createdAt], [workspaceId+kind], [workspaceId+createdAt]',
  document_attachments:
    'attachmentId, dbKey, workspaceId, docId, [dbKey+workspaceId], [dbKey+workspaceId+entityKind+entityId], [dbKey+workspaceId+docId], [workspaceId+entityKind+entityId], [entityKind+entityId], [docId+entityKind+entityId]',
  ...WORKSPACE_SHARD_STORE_DEFINITIONS,
  ...TITLE_LEDGER_STORE_DEFINITIONS,
});

/**
 * v13 (project picker landing).
 *
 * Adds a per-user saved-project index. Existing single-project rows keep their
 * current workspace DB key; newly-created projects can use an isolated DB key
 * recorded in this index without changing the exported `.landroid` format.
 */
db.version(13)
  .stores({
  pdfs: 'nodeId',
  workspaces: 'id',
  canvases: 'id',
  owners: 'id, dbKey, workspaceId, name, [dbKey+workspaceId], [dbKey+workspaceId+name]',
  leases:
    'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
  contactLogs:
    'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
  ownerDocs:
    'id, dbKey, workspaceId, ownerId, leaseId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [dbKey+workspaceId+leaseId], [workspaceId+ownerId], [workspaceId+leaseId]',
  mapAssets:
    'id, dbKey, workspaceId, isFeatured, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+isFeatured], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+isFeatured], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapRegions:
    'id, dbKey, workspaceId, assetId, deskMapId, nodeId, linkedOwnerId, leaseId, researchSourceId, researchProjectRecordId, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+deskMapId], [dbKey+workspaceId+nodeId], [dbKey+workspaceId+linkedOwnerId], [dbKey+workspaceId+leaseId], [workspaceId+assetId], [workspaceId+deskMapId], [workspaceId+nodeId], [workspaceId+linkedOwnerId], [workspaceId+leaseId], [workspaceId+researchSourceId], [workspaceId+researchProjectRecordId]',
  mapExternalReferences:
    'id, dbKey, workspaceId, assetId, regionId, source, [dbKey+workspaceId], [dbKey+workspaceId+assetId], [dbKey+workspaceId+regionId], [workspaceId+assetId], [workspaceId+regionId]',
  researchImports:
    'id, dbKey, workspaceId, datasetId, detectedFormat, [dbKey+workspaceId], [dbKey+workspaceId+datasetId], [dbKey+workspaceId+detectedFormat], [workspaceId+datasetId], [workspaceId+detectedFormat]',
  researchSources:
    'id, dbKey, workspaceId, sourceType, context, [dbKey+workspaceId], [dbKey+workspaceId+sourceType], [dbKey+workspaceId+context], [workspaceId+sourceType], [workspaceId+context]',
  researchFormulas:
    'id, dbKey, workspaceId, category, status, [dbKey+workspaceId], [dbKey+workspaceId+category], [dbKey+workspaceId+status], [workspaceId+category], [workspaceId+status]',
  researchProjectRecords:
    'id, dbKey, workspaceId, recordType, jurisdiction, status, [dbKey+workspaceId], [dbKey+workspaceId+recordType], [dbKey+workspaceId+jurisdiction], [dbKey+workspaceId+status], [workspaceId+recordType], [workspaceId+jurisdiction], [workspaceId+status]',
  researchQuestions:
    'id, dbKey, workspaceId, status, [dbKey+workspaceId], [dbKey+workspaceId+status], [workspaceId+status]',
  titleIssues:
    'id, dbKey, workspaceId, status, priority, issueType, affectedDeskMapId, affectedNodeId, affectedOwnerId, affectedLeaseId, [dbKey+workspaceId], [dbKey+workspaceId+status], [dbKey+workspaceId+priority], [workspaceId+status], [workspaceId+priority]',
  documents:
    'docId, dbKey, workspaceId, contentHash, [dbKey+workspaceId], [dbKey+workspaceId+kind], [dbKey+workspaceId+createdAt], [workspaceId+kind], [workspaceId+createdAt]',
  document_attachments:
    'attachmentId, dbKey, workspaceId, docId, [dbKey+workspaceId], [dbKey+workspaceId+entityKind+entityId], [dbKey+workspaceId+docId], [workspaceId+entityKind+entityId], [entityKind+entityId], [docId+entityKind+entityId]',
  ...WORKSPACE_SHARD_STORE_DEFINITIONS,
  ...TITLE_LEDGER_STORE_DEFINITIONS,
  savedProjects: SAVED_PROJECTS_STORE_DEFINITION,
})
  .upgrade(async (tx) => {
    await runV12ToV13SavedProjectIndexMigration(tx);
  });

/**
 * v14 (Lease Purchase Report).
 *
 * Adds the lease-abstract parent table. Additive and non-destructive — a new
 * empty store, no data migration. Existing leases keep working as standalone
 * slices (`leasePurchaseReportId = null`) until an LPR groups them. Dexie merges
 * this delta with the prior schema, so unchanged tables carry forward.
 */
db.version(14).stores({
  leasePurchaseReports:
    'id, dbKey, workspaceId, ownerId, [dbKey+workspaceId], [dbKey+workspaceId+ownerId], [workspaceId+ownerId]',
});

/**
 * v15 (Flowchart image nodes).
 *
 * Adds `canvasAssets` — a content-addressed binary store for illustrative
 * flowchart images, kept separate from the `documents` evidence vault. Additive
 * and non-destructive: a new empty table, no data migration. Dexie merges this
 * delta with the prior schema, so unchanged tables carry forward.
 */
db.version(15).stores({
  canvasAssets:
    'id, dbKey, workspaceId, contentHash, [dbKey+workspaceId], [dbKey+workspaceId+contentHash]',
});

/**
 * v16 (DA2-M GeoJSON tract features).
 *
 * Adds `mapTractFeatures` — parsed WGS84 tract polygons ingested from an ArcGIS
 * GeoJSON export, each with a nullable link to a LANDroid `DeskMap`. Additive
 * and non-destructive: a new empty table, no data migration.
 */
db.version(16).stores({
  mapTractFeatures:
    'id, dbKey, workspaceId, assetId, tractKey, matchedDeskMapId, [dbKey+workspaceId], [dbKey+workspaceId+assetId]',
});

/**
 * v17 (DA-H4 title-ledger quarantine).
 *
 * Adds `titleLedgerQuarantine` — a preserved copy of a title ledger chain that
 * failed verification on hydrate, captured before a fresh baseline replaces the
 * bad rows so the tamper/corruption evidence is not erased. Additive and
 * non-destructive: a new empty table, no data migration. Renumbered v16 → v17
 * on the rebase onto main (the DA2-M Maps lane claimed v16 first).
 */
db.version(17).stores({
  ...TITLE_LEDGER_QUARANTINE_STORE_DEFINITION,
});

/**
 * v18 (FED1/FED2 federal lease-document persistence).
 *
 * Adds `federalLeaseDocuments` — the reference-only BLM Form 3100-11 detail
 * records for federal leases. They previously lived in an in-memory `Map` that
 * died on reload; persisting them workspace-scoped lets "View Lease Document"
 * survive a refresh. Additive and non-destructive: a new empty table, no data
 * migration. Federal records remain reference-only and never feed Texas math.
 */
db.version(18).stores({
  federalLeaseDocuments: 'id, dbKey, workspaceId, [dbKey+workspaceId]',
});

/**
 * v19 (DA-H4 residual: title-ledger head-hash pin).
 *
 * Adds `titleLedgerHeadMarkers` — one row per workspace pinning the chain head's
 * `eventHash` at the last flush. Lets hydrate detect a hashed chain truncated
 * back to a legacy chain (which still verifies internally). Additive and
 * non-destructive: a new empty table, no data migration. Existing chains have no
 * marker until their next flush, so the pin arms forward — no rollout false
 * positives.
 */
db.version(19).stores({
  ...TITLE_LEDGER_HEAD_MARKER_STORE_DEFINITION,
});


const PROJECT_WORKSPACE_KEY_SEPARATOR = '::project::';

function savedProjectStorageId(indexDbKey: string, workspaceId: string): string {
  return storageScopedId(workspaceId, indexDbKey);
}

function inferProjectIndexDbKey(workspaceDbKey: string, workspaceId: string): string {
  const suffix = `${PROJECT_WORKSPACE_KEY_SEPARATOR}${workspaceId}`;
  return workspaceDbKey.endsWith(suffix)
    ? workspaceDbKey.slice(0, -suffix.length)
    : workspaceDbKey;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function isBlankProjectName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === 'Untitled Workspace';
}

function shouldSkipBlankDefaultProjectIndexRecord(args: {
  workspaceDbKey: string;
  projectName: string;
  hasProjectContent: boolean;
}): boolean {
  return (
    args.workspaceDbKey === 'default'
    && !args.hasProjectContent
    && isBlankProjectName(args.projectName)
  );
}

function savedProjectMigrationScope(
  workspaceDbKey: string,
  workspaceId: string
): string {
  return `${workspaceDbKey}\u0000${workspaceId}`;
}

function manifestHasProjectContent(manifest: WorkspaceManifestShard): boolean {
  return (manifest.nodeCount ?? 0) > 0;
}

function leaseholdStateHasProjectContent(row: LeaseholdStateShard): boolean {
  return (
    arrayLength(row.leaseholdAssignments) > 0
    || arrayLength(row.leaseholdOrris) > 0
    || arrayLength(row.leaseholdTransferOrderEntries) > 0
  );
}

function parseWorkspaceRecordData(record: WorkspaceRecord): {
  workspaceId: string;
  projectName: string;
  hasProjectContent: boolean;
} | null {
  try {
    const parsed = JSON.parse(record.data) as unknown;
    if (
      parsed
      && typeof parsed === 'object'
      && typeof (parsed as { workspaceId?: unknown }).workspaceId === 'string'
    ) {
      return {
        workspaceId: (parsed as { workspaceId: string }).workspaceId,
        projectName:
          typeof (parsed as { projectName?: unknown }).projectName === 'string'
            ? (parsed as { projectName: string }).projectName
            : record.projectName,
        hasProjectContent:
          arrayLength((parsed as { nodes?: unknown }).nodes) > 0
          || arrayLength((parsed as { deskMaps?: unknown }).deskMaps) > 0
          || arrayLength((parsed as { leaseholdAssignments?: unknown }).leaseholdAssignments) > 0
          || arrayLength((parsed as { leaseholdOrris?: unknown }).leaseholdOrris) > 0
          || arrayLength((parsed as { leaseholdTransferOrderEntries?: unknown }).leaseholdTransferOrderEntries) > 0,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function mergeSavedProjectRecord(
  records: Map<string, SavedProjectRecord>,
  next: SavedProjectRecord
): void {
  const current = records.get(next.id);
  if (!current || current.updatedAt < next.updatedAt) {
    records.set(next.id, next);
  }
}

async function runV12ToV13SavedProjectIndexMigration(tx: Transaction): Promise<void> {
  const records = new Map<string, SavedProjectRecord>();
  const manifests = await tx
    .table<WorkspaceManifestShard, 'id'>('workspaceManifestShards')
    .toArray();
  const leaseholdRows = await tx
    .table<LeaseholdStateShard, 'id'>('leaseholdStateShards')
    .toArray();
  const contentfulLeaseholdScopes = new Set(
    leaseholdRows
      .filter(leaseholdStateHasProjectContent)
      .map((row) =>
        savedProjectMigrationScope(row.dbKey ?? 'default', row.workspaceId)
      )
  );

  for (const manifest of manifests) {
    const workspaceDbKey = manifest.dbKey ?? 'default';
    const projectName = manifest.backendRecord.projectName || 'Untitled Workspace';
    const hasProjectContent = manifestHasProjectContent(manifest)
      || contentfulLeaseholdScopes.has(
        savedProjectMigrationScope(workspaceDbKey, manifest.workspaceId)
      );
    if (
      shouldSkipBlankDefaultProjectIndexRecord({
        workspaceDbKey,
        projectName,
        hasProjectContent,
      })
    ) {
      continue;
    }
    const indexDbKey = inferProjectIndexDbKey(workspaceDbKey, manifest.workspaceId);
    const timestamp = manifest.backendRecord.lastModified || manifest.backendRecord.generatedAt;
    mergeSavedProjectRecord(records, {
      id: savedProjectStorageId(indexDbKey, manifest.workspaceId),
      indexDbKey,
      workspaceId: manifest.workspaceId,
      workspaceDbKey,
      projectName,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    });
  }

  const workspaceRows = await tx.table<WorkspaceRecord, 'id'>('workspaces').toArray();
  for (const row of workspaceRows) {
    const parsed = parseWorkspaceRecordData(row);
    if (!parsed) continue;
    const workspaceDbKey = row.id || 'default';
    if (
      shouldSkipBlankDefaultProjectIndexRecord({
        workspaceDbKey,
        projectName: parsed.projectName,
        hasProjectContent: parsed.hasProjectContent,
      })
    ) {
      continue;
    }
    const indexDbKey = inferProjectIndexDbKey(workspaceDbKey, parsed.workspaceId);
    const timestamp = row.savedAt || new Date(0).toISOString();
    mergeSavedProjectRecord(records, {
      id: savedProjectStorageId(indexDbKey, parsed.workspaceId),
      indexDbKey,
      workspaceId: parsed.workspaceId,
      workspaceDbKey,
      projectName: parsed.projectName || 'Untitled Workspace',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    });
  }

  if (records.size > 0) {
    await tx.table<SavedProjectRecord, 'id'>('savedProjects').bulkPut([...records.values()]);
  }
}

/**
 * Real-implementation deps for the migration. The pure helper accepts
 * everything as injection so tests can run with deterministic stubs.
 */
function realMigrationDeps(): DocumentMigrationDeps {
  return {
    generateId: () => crypto.randomUUID(),
    hashBlob: sha256HexOfBlob,
    now: () => new Date().toISOString(),
  };
}

/**
 * Dexie upgrade body for v7 → v8. Split out so the migration steps are
 * legible in isolation and so a future explicit-rerun path (e.g. recovery
 * tooling) can reuse it.
 */
async function runV7ToV8PdfMigration(tx: Transaction): Promise<void> {
  const pdfs = await tx.table<PdfAttachment, 'nodeId'>('pdfs').toArray();
  if (pdfs.length === 0) {
    return;
  }
  const workspaceRows = await tx
    .table<WorkspaceRecord, 'id'>('workspaces')
    .toArray();
  const nodeIndex = buildNodeWorkspaceIndex(
    workspaceRows.map((row) => ({ id: row.id, data: row.data }))
  );
  const fallbackWorkspaceId =
    workspaceRows[0]?.id
    // If there are pdfs but no workspaces (corrupt state), the migration
    // would otherwise lose the blobs. Use a sentinel ID so the rows still
    // land in the new schema and the user can recover them manually.
    ?? '__orphaned_pre_v8__';
  // The migration hashes each blob with WebCrypto (`sha256HexOfBlob`), a
  // non-Dexie promise. Awaiting a foreign promise directly inside an `.upgrade`
  // transaction can let IndexedDB auto-commit the version-change transaction
  // before the follow-up `bulkAdd` runs, losing the migrated rows on large PDF
  // sets. `Dexie.waitFor` keeps the transaction alive across the foreign work
  // (DA-M10). `migratePdfsToDocuments` is pure (operates on the in-memory
  // `pdfs` array via injected deps; it never touches `tx`), so wrapping its
  // call is safe.
  const result = await Dexie.waitFor(
    migratePdfsToDocuments(pdfs, nodeIndex, fallbackWorkspaceId, realMigrationDeps())
  );
  if (result.documents.length > 0) {
    await tx.table<DocumentRecord, 'docId'>('documents').bulkAdd(result.documents);
    await tx
      .table<DocumentAttachment, 'attachmentId'>('document_attachments')
      .bulkAdd(result.attachments);
  }
  if (result.orphans.length > 0) {
    // Don't throw — orphans are a recoverable warning, not a migration
    // failure. The blobs are still in `documents` keyed to the fallback
    // workspace; the v8 UI can show them under a "Pre-migration leftovers"
    // section if needed.
    console.warn(
      `[landroid v7→v8] ${result.orphans.length} PDF row(s) had no matching `
      + `workspace and were attached to the fallback workspace `
      + `(${fallbackWorkspaceId}). Affected node IDs: `
      + `${result.orphans.slice(0, 10).join(', ')}`
      + (result.orphans.length > 10 ? ' …' : '')
    );
  }
}

/**
 * v9 upgrade body: stamp `workspaceId` onto every `document_attachments` row
 * from its parent document so the `[workspaceId+…]` indexes resolve.
 *
 * DA-M10: an attachment whose `docId` has no matching document is dangling
 * (its document was never migrated or was lost). The previous pass left such
 * rows with no `workspaceId`, which hid them from every scoped query forever
 * (dead, unreachable weight). They are now deleted in the same pass. Extracted
 * and exported so it is unit-testable with a fake transaction.
 */
export async function runV9DocumentAttachmentBackfill(
  tx: Transaction
): Promise<void> {
  const docs = await tx.table<DocumentRecord, 'docId'>('documents').toArray();
  const workspaceByDocId = new Map(docs.map((doc) => [doc.docId, doc.workspaceId]));
  const attachments = await tx
    .table<DocumentAttachment, 'attachmentId'>('document_attachments')
    .toArray();
  for (const attachment of attachments) {
    const workspaceId = workspaceByDocId.get(attachment.docId);
    if (workspaceId) {
      await tx
        .table('document_attachments')
        .update(attachment.attachmentId, { workspaceId });
    } else {
      await tx.table('document_attachments').delete(attachment.attachmentId);
    }
  }
}

export async function runV9ToV10WorkspaceShardMigration(
  tx: Transaction
): Promise<void> {
  const { migrateWorkspaceRecordToShards } = await import(
    './workspace-shard-migration'
  );
  const workspaceRows = await tx
    .table<WorkspaceRecord, 'id'>('workspaces')
    .toArray();

  for (const record of workspaceRows) {
    let migration: ReturnType<typeof migrateWorkspaceRecordToShards>;
    try {
      migration = migrateWorkspaceRecordToShards(record, {
        landroidFileVersion: LANDROID_FILE_VERSION,
        source: 'migration',
        syncState: 'local_only',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.warn(
        `[landroid v9→v10] Workspace row ${record.id} could not be sharded: ${reason}`
      );
      continue;
    }

    // Stamp the per-user DB key (the monolithic row's primary key) on the
    // manifest so the runtime reader can resolve this workspace by key without
    // adopting another user's shards (Bug 001).
    const dbKey = record.id;
    await tx
      .table<WorkspaceManifestShard, 'id'>('workspaceManifestShards')
      .put(stampDbKeyWithStorageId(migration.shards.manifest, 'id', dbKey));

    if (migration.shards.deskMaps.length > 0) {
      await tx
        .table<DeskMapShard, 'id'>('deskMapShards')
        .bulkPut(
          migration.shards.deskMaps.map((row) =>
            stampDbKeyWithStorageId(row, 'id', dbKey)
          )
        );
    }
    if (migration.shards.nodes.length > 0) {
      await tx
        .table<OwnershipNodeCompatShard, 'id'>('ownershipNodeCompatShards')
        .bulkPut(
          migration.shards.nodes.map((row) =>
            stampDbKeyWithStorageId(row, 'id', dbKey)
          )
        );
    }

    await tx
      .table<LeaseholdStateShard, 'id'>('leaseholdStateShards')
      .put(stampDbKeyWithStorageId(migration.shards.leaseholdState, 'id', dbKey));
    await tx
      .table<WorkspaceUiStateShard, 'id'>('workspaceUiStateShards')
      .put(stampDbKeyWithStorageId(migration.shards.uiState, 'id', dbKey));
  }
}

type WorkspaceScopedBackfillRow = { id?: string; docId?: string; attachmentId?: string; workspaceId?: string; dbKey?: string };

async function backfillDbKeyForTable(
  tx: Transaction,
  tableName: string,
  dbKeyForWorkspace: Map<string, string>
): Promise<void> {
  const table = tx.table<WorkspaceScopedBackfillRow, string>(tableName);
  const rows = await table.toArray();
  await Promise.all(
    rows.map(async (row) => {
      if (!row.workspaceId) return;
      const key = row.dbKey ?? dbKeyForWorkspace.get(row.workspaceId) ?? 'default';
      const primaryField = row.id !== undefined
        ? 'id'
        : row.docId !== undefined
          ? 'docId'
          : row.attachmentId !== undefined
            ? 'attachmentId'
            : null;
      if (!primaryField) return;
      const primaryKey = row[primaryField];
      if (!primaryKey) return undefined;
      const nextPrimaryKey = storageScopedId(primaryKey, key);
      const nextRow = {
        ...row,
        dbKey: key,
        [primaryField]: nextPrimaryKey,
      };
      if (nextPrimaryKey === primaryKey) {
        if (!row.dbKey) await table.update(primaryKey, { dbKey: key });
        return;
      }
      await table.put(nextRow);
      await table.delete(primaryKey);
    })
  );
}

export async function runV10ToV11DbKeyBackfill(
  tx: Transaction
): Promise<void> {
  const manifests = await tx
    .table<WorkspaceManifestShard, 'id'>('workspaceManifestShards')
    .toArray();
  const dbKeysByWorkspace = new Map<string, Set<string>>();
  for (const manifest of manifests) {
    const dbKey = manifest.dbKey ?? 'default';
    const keys = dbKeysByWorkspace.get(manifest.workspaceId) ?? new Set<string>();
    keys.add(dbKey);
    dbKeysByWorkspace.set(manifest.workspaceId, keys);
  }
  const dbKeyForWorkspace = new Map<string, string>();
  for (const [workspaceId, keys] of dbKeysByWorkspace) {
    dbKeyForWorkspace.set(
      workspaceId,
      keys.size === 1 ? [...keys][0] : 'default'
    );
  }

  await Promise.all(
    [
      'workspaceManifestShards',
      'deskMapShards',
      'ownershipNodeCompatShards',
      'leaseholdStateShards',
      'workspaceUiStateShards',
      'owners',
      'leases',
      'contactLogs',
      'ownerDocs',
      'mapAssets',
      'mapRegions',
      'mapExternalReferences',
      'researchImports',
      'researchSources',
      'researchFormulas',
      'researchProjectRecords',
      'researchQuestions',
      'titleIssues',
      'documents',
      'document_attachments',
    ].map((tableName) => backfillDbKeyForTable(tx, tableName, dbKeyForWorkspace))
  );
}

export default db;
