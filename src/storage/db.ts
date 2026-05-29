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
import {
  buildNodeWorkspaceIndex,
  migratePdfsToDocuments,
  type DocumentMigrationDeps,
} from './document-migration';
import { sha256HexOfBlob } from './blob-hash';
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
  documents: EntityTable<DocumentRecord, 'docId'>;
  document_attachments: EntityTable<DocumentAttachment, 'attachmentId'>;
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
  workspaceManifestShards: EntityTable<WorkspaceManifestShard, 'id'>;
  deskMapShards: EntityTable<DeskMapShard, 'id'>;
  ownershipNodeCompatShards: EntityTable<OwnershipNodeCompatShard, 'id'>;
  leaseholdStateShards: EntityTable<LeaseholdStateShard, 'id'>;
  workspaceUiStateShards: EntityTable<WorkspaceUiStateShard, 'id'>;
  workspaceWriteLeases: EntityTable<WorkspaceWriteLease, 'workspaceId'>;
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
    const docs = await tx.table<DocumentRecord, 'docId'>('documents').toArray();
    const workspaceByDocId = new Map(docs.map((doc) => [doc.docId, doc.workspaceId]));
    const attachments = await tx
      .table<DocumentAttachment, 'attachmentId'>('document_attachments')
      .toArray();
    await Promise.all(
      attachments.map((attachment) => {
        const workspaceId = workspaceByDocId.get(attachment.docId);
        if (!workspaceId) return undefined;
        return tx.table('document_attachments').update(attachment.attachmentId, {
          workspaceId,
        });
      })
    );
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
  const result = await migratePdfsToDocuments(
    pdfs,
    nodeIndex,
    fallbackWorkspaceId,
    realMigrationDeps()
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
    await tx
      .table<WorkspaceManifestShard, 'id'>('workspaceManifestShards')
      .put({ ...migration.shards.manifest, dbKey: record.id });

    if (migration.shards.deskMaps.length > 0) {
      await tx
        .table<DeskMapShard, 'id'>('deskMapShards')
        .bulkPut(migration.shards.deskMaps);
    }
    if (migration.shards.nodes.length > 0) {
      await tx
        .table<OwnershipNodeCompatShard, 'id'>('ownershipNodeCompatShards')
        .bulkPut(migration.shards.nodes);
    }

    await tx
      .table<LeaseholdStateShard, 'id'>('leaseholdStateShards')
      .put(migration.shards.leaseholdState);
    await tx
      .table<WorkspaceUiStateShard, 'id'>('workspaceUiStateShards')
      .put(migration.shards.uiState);
  }
}

export default db;
