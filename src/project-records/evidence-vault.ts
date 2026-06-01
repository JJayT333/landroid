import {
  BackendSpineCoreRecordSchema,
  WorkspaceManifestRecordSchema,
  type BackendDocumentRecord,
  type BackendSpineCoreRecord,
  type BackendSpineRecordSource,
  type BackendSpineRecordType,
  type BackendSpineSyncState,
  type CurativeIssueRecord,
  type DocumentLinkRecord,
  type DocumentVersionRecord,
  type PacketExportRecord,
  type PacketItemRecord,
  type PacketRecord,
  type SourceCitationRecord,
  type VaultObjectRecord,
} from '../backend-spine/contracts';
import { sha256HexOfBlob } from '../storage/blob-hash';
import type { CurativeWorkspaceData } from '../storage/curative-persistence';
import type { MapWorkspaceData } from '../storage/map-persistence';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type { ResearchWorkspaceData } from '../storage/research-persistence';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../storage/workspace-persistence';
import {
  baseRecordEnvelope,
  cleanRecordText,
  CONTENT_HASH_PATTERN,
  dateTimeRecordValue,
  fallbackRecordText,
  requireContentHash,
  sha256HexOfText,
  stableRecordId,
  type RecordBuildContext,
} from './record-helpers';
import { buildProjectRecordBundle, type ProjectRecordBundle } from './record-validation';
import {
  buildProjectRecordsFromWorkspace,
  type WorkspaceRecordAdapterInput,
} from './workspace-record-adapter';

type HashBlob = (blob: Blob) => Promise<string>;
type VaultLinkKind = DocumentLinkRecord['entityKind'];

export interface EvidenceVaultAdapterInput {
  workspace: WorkspaceData;
  ownerData?: OwnerWorkspaceData;
  documentData?: DocumentWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  projectId?: string;
  generatedAt: string;
  revision?: number;
  source?: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
  landroidFileVersion: number;
  hashBlob?: HashBlob;
}

interface VaultLinkDraft {
  entityKind: VaultLinkKind;
  entityId: string;
  position: number;
  idSeed: string;
}

interface VaultDocumentDraft {
  sourceKind: 'document_registry' | 'owner_doc' | 'map_asset' | 'research_import';
  sourceId: string;
  documentRecordId: string;
  documentId: string;
  displayTitle: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  contentHash: string | null;
  blob?: Blob;
  createdAt: string;
  storageRef: string;
  localOnly: boolean;
  links: VaultLinkDraft[];
}

export interface AttorneyPacketManifestItem {
  packetOrder: number;
  documentId: string;
  documentRecordId: string;
  displayTitle: string;
  fileName: string;
  nativeFileName: string;
  mimeType: string;
  byteLength: number;
  contentHash: string;
  vaultObjectId: string;
  documentVersionId: string;
  linkedEntities: Array<{
    documentLinkId: string;
    entityKind: VaultLinkKind;
    entityId: string;
    position: number;
  }>;
  sourceCitationIds: string[];
}

export interface AttorneyPacketManifest {
  packetId: string;
  title: string;
  packetType: 'attorney';
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  checksumAlgorithm: 'sha256';
  manifestHash: string;
  items: AttorneyPacketManifestItem[];
  unresolvedIssues: Array<{
    issueId: string;
    title: string;
    priority: CurativeIssueRecord['priority'];
    status: CurativeIssueRecord['status'];
    affectedRecordIds: string[];
  }>;
}

export interface AttorneyPacketExport {
  manifest: AttorneyPacketManifest;
  manifestJson: string;
  manifestHash: string;
  records: BackendSpineCoreRecord[];
  sourceCitationSidecars: Array<{
    documentId: string;
    citations: Array<{
      sourceCitationId: string;
      confidence: SourceCitationRecord['confidence'];
      pageNumber?: number;
      citedRecordId?: string;
      quotedTextHash?: string;
    }>;
  }>;
  eDiscoverySidecars: Array<{
    controlNumber: string;
    fileName: string;
    sha256: string;
    documentRecordId: string;
  }>;
}

function parseRecord(record: unknown): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(record);
}

function buildContext(input: EvidenceVaultAdapterInput): RecordBuildContext {
  return {
    workspaceId: input.workspace.workspaceId,
    projectId: input.projectId ?? input.workspace.workspaceId,
    generatedAt: input.generatedAt,
    revision: input.revision ?? 0,
    source: input.source ?? 'local',
    syncState: input.syncState,
  };
}

function countRecordTypes(records: BackendSpineCoreRecord[]) {
  const counts: Partial<Record<BackendSpineRecordType, number>> = {};
  for (const record of records) {
    counts[record.recordType] = (counts[record.recordType] ?? 0) + 1;
  }
  return counts;
}

function safeFileName(value: string): string {
  return fallbackRecordText(value, 'document')
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function documentRecordIdFor(
  context: RecordBuildContext,
  sourceKind: VaultDocumentDraft['sourceKind'],
  sourceId: string
): string {
  if (sourceKind === 'document_registry') {
    return stableRecordId(context.workspaceId, 'document', sourceId);
  }
  return stableRecordId(context.workspaceId, 'document', sourceKind, sourceId);
}

function sortByStableSource<T extends { sourceId: string; fileName?: string; createdAt?: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((left, right) =>
    [
      left.createdAt ?? '',
      left.fileName ?? '',
      left.sourceId,
    ].join('\0').localeCompare(
      [
        right.createdAt ?? '',
        right.fileName ?? '',
        right.sourceId,
      ].join('\0')
    )
  );
}

function sortRecords(records: BackendSpineCoreRecord[]): BackendSpineCoreRecord[] {
  const order = new Map<BackendSpineRecordType, number>(
    [
      'document',
      'vault_object',
      'document_version',
      'document_link',
      'source_citation',
      'packet',
      'packet_item',
      'packet_export',
    ].map((recordType, index) => [recordType as BackendSpineRecordType, index])
  );
  return [...records].sort((left, right) => {
    const byType = (order.get(left.recordType) ?? 99) - (order.get(right.recordType) ?? 99);
    if (byType !== 0) return byType;
    return left.recordId.localeCompare(right.recordId);
  });
}

function buildTractIdsByDeskMap(workspace: WorkspaceData): Map<string, string> {
  return new Map(
    workspace.deskMaps.map((deskMap) => [
      deskMap.id,
      deskMap.tractId ?? deskMap.id,
    ])
  );
}

function linkCounter() {
  const positions = new Map<string, number>();
  return (entityKind: VaultLinkKind, entityId: string): number => {
    const key = `${entityKind}:${entityId}`;
    const position = positions.get(key) ?? 0;
    positions.set(key, position + 1);
    return position;
  };
}

function pushLink(
  links: VaultLinkDraft[],
  nextPosition: ReturnType<typeof linkCounter>,
  entityKind: VaultLinkKind,
  entityId: string | null | undefined,
  idSeed: string
) {
  const cleanEntityId = cleanRecordText(entityId ?? '');
  if (!cleanEntityId) return;
  links.push({
    entityKind,
    entityId: cleanEntityId,
    position: nextPosition(entityKind, cleanEntityId),
    idSeed,
  });
}

function buildDocumentRegistryDrafts(
  input: EvidenceVaultAdapterInput,
  context: RecordBuildContext
): VaultDocumentDraft[] {
  const docs = (input.documentData?.documents ?? []).filter(
    (document) => document.workspaceId === context.workspaceId
  );
  const attachmentsByDocId = new Map<string, VaultLinkDraft[]>();
  for (const attachment of input.documentData?.attachments ?? []) {
    if (attachment.workspaceId !== context.workspaceId) continue;
    const existing = attachmentsByDocId.get(attachment.docId) ?? [];
    existing.push({
      entityKind: attachment.entityKind,
      entityId: attachment.entityId,
      position: attachment.position,
      idSeed: attachment.attachmentId,
    });
    attachmentsByDocId.set(attachment.docId, existing);
  }

  return sortByStableSource(
    docs.map((document) => ({
      sourceId: document.docId,
      fileName: document.fileName,
      createdAt: document.createdAt,
      sourceKind: 'document_registry' as const,
      documentRecordId: documentRecordIdFor(context, 'document_registry', document.docId),
      documentId: document.docId,
      displayTitle: fallbackRecordText(document.displayTitle, document.fileName || document.docId),
      mimeType: fallbackRecordText(document.mimeType, 'application/octet-stream'),
      byteLength: document.byteLength,
      contentHash: requireContentHash(document.contentHash, document.fileName),
      blob: document.blob,
      storageRef: `documents/${document.docId}/original/${safeFileName(document.fileName)}`,
      localOnly: true,
      links: (attachmentsByDocId.get(document.docId) ?? []).sort((left, right) =>
        left.position - right.position || left.idSeed.localeCompare(right.idSeed)
      ),
    }))
  );
}

function buildOwnerDocDrafts(
  input: EvidenceVaultAdapterInput,
  context: RecordBuildContext
): VaultDocumentDraft[] {
  const nextPosition = linkCounter();
  const rows = sortByStableSource(
    (input.ownerData?.docs ?? [])
      .filter((doc) => doc.workspaceId === context.workspaceId && doc.blob.size > 0)
      .map((doc) => ({ ...doc, sourceId: doc.id }))
  );
  return rows.map((doc) => {
    const links: VaultLinkDraft[] = [];
    pushLink(links, nextPosition, 'owner', doc.ownerId, `owner:${doc.id}`);
    pushLink(links, nextPosition, 'lease', doc.leaseId, `lease:${doc.id}`);
    return {
      sourceId: doc.id,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      sourceKind: 'owner_doc' as const,
      documentRecordId: documentRecordIdFor(context, 'owner_doc', doc.id),
      documentId: doc.id,
      displayTitle: fallbackRecordText(doc.fileName, doc.id),
      mimeType: fallbackRecordText(doc.mimeType, 'application/octet-stream'),
      byteLength: doc.blob.size,
      contentHash: null,
      blob: doc.blob,
      storageRef: `owner-docs/${doc.id}/original/${safeFileName(doc.fileName)}`,
      localOnly: true,
      links,
    };
  });
}

function buildMapAssetDrafts(
  input: EvidenceVaultAdapterInput,
  context: RecordBuildContext
): VaultDocumentDraft[] {
  const nextPosition = linkCounter();
  const tractIdsByDeskMap = buildTractIdsByDeskMap(input.workspace);
  const rows = sortByStableSource(
    (input.mapData?.mapAssets ?? [])
      .filter((asset) => asset.workspaceId === context.workspaceId && asset.blob.size > 0)
      .map((asset) => ({ ...asset, sourceId: asset.id }))
  );
  return rows.map((asset) => {
    const links: VaultLinkDraft[] = [];
    pushLink(
      links,
      nextPosition,
      'tract',
      asset.deskMapId ? tractIdsByDeskMap.get(asset.deskMapId) ?? asset.deskMapId : null,
      `tract:${asset.id}`
    );
    pushLink(links, nextPosition, 'node', asset.nodeId, `node:${asset.id}`);
    pushLink(links, nextPosition, 'owner', asset.linkedOwnerId, `owner:${asset.id}`);
    pushLink(links, nextPosition, 'lease', asset.leaseId, `lease:${asset.id}`);
    pushLink(links, nextPosition, 'research', asset.researchSourceId, `research-source:${asset.id}`);
    pushLink(
      links,
      nextPosition,
      'research',
      asset.researchProjectRecordId,
      `research-project:${asset.id}`
    );
    return {
      sourceId: asset.id,
      fileName: asset.fileName,
      createdAt: asset.createdAt,
      sourceKind: 'map_asset' as const,
      documentRecordId: documentRecordIdFor(context, 'map_asset', asset.id),
      documentId: asset.id,
      displayTitle: fallbackRecordText(asset.title, asset.fileName || asset.id),
      mimeType: fallbackRecordText(asset.mimeType, 'application/octet-stream'),
      byteLength: asset.blob.size,
      contentHash: null,
      blob: asset.blob,
      storageRef: `map-assets/${asset.id}/original/${safeFileName(asset.fileName)}`,
      localOnly: true,
      links,
    };
  });
}

function buildResearchImportDrafts(
  input: EvidenceVaultAdapterInput,
  context: RecordBuildContext
): VaultDocumentDraft[] {
  const nextPosition = linkCounter();
  const sourceIdsByImportId = new Map<string, string[]>();
  const projectRecordIdsByImportId = new Map<string, string[]>();
  for (const source of input.researchData?.sources ?? []) {
    if (source.workspaceId !== context.workspaceId || !source.links.importId) continue;
    const existing = sourceIdsByImportId.get(source.links.importId) ?? [];
    existing.push(source.id);
    sourceIdsByImportId.set(source.links.importId, existing);
  }
  for (const projectRecord of input.researchData?.projectRecords ?? []) {
    if (projectRecord.workspaceId !== context.workspaceId || !projectRecord.importId) continue;
    const existing = projectRecordIdsByImportId.get(projectRecord.importId) ?? [];
    existing.push(projectRecord.id);
    projectRecordIdsByImportId.set(projectRecord.importId, existing);
  }

  const rows = sortByStableSource(
    (input.researchData?.imports ?? [])
      .filter(
        (researchImport) =>
          researchImport.workspaceId === context.workspaceId && researchImport.blob.size > 0
      )
      .map((researchImport) => ({ ...researchImport, sourceId: researchImport.id }))
  );
  return rows.map((researchImport) => {
    const links: VaultLinkDraft[] = [];
    pushLink(
      links,
      nextPosition,
      'import_row',
      researchImport.id,
      `import:${researchImport.id}`
    );
    for (const sourceId of [...(sourceIdsByImportId.get(researchImport.id) ?? [])].sort()) {
      pushLink(links, nextPosition, 'research', sourceId, `source:${sourceId}`);
    }
    for (const projectRecordId of [
      ...(projectRecordIdsByImportId.get(researchImport.id) ?? []),
    ].sort()) {
      pushLink(
        links,
        nextPosition,
        'research',
        projectRecordId,
        `project-record:${projectRecordId}`
      );
    }
    return {
      sourceId: researchImport.id,
      fileName: researchImport.fileName,
      createdAt: researchImport.createdAt,
      sourceKind: 'research_import' as const,
      documentRecordId: documentRecordIdFor(context, 'research_import', researchImport.id),
      documentId: researchImport.id,
      displayTitle: fallbackRecordText(
        researchImport.title,
        researchImport.fileName || researchImport.id
      ),
      mimeType: fallbackRecordText(researchImport.mimeType, 'application/octet-stream'),
      byteLength: researchImport.blob.size,
      contentHash: null,
      blob: researchImport.blob,
      storageRef: `research-imports/${researchImport.id}/original/${safeFileName(researchImport.fileName)}`,
      localOnly: true,
      links,
    };
  });
}

async function resolveDraftHash(
  draft: VaultDocumentDraft,
  hashBlob: HashBlob
): Promise<string> {
  const candidate = cleanRecordText(draft.contentHash ?? '').toLowerCase();
  if (CONTENT_HASH_PATTERN.test(candidate)) return candidate;
  if (!draft.blob) {
    throw new Error(`${draft.fileName} is missing bytes for evidence-vault hashing.`);
  }
  const computed = await hashBlob(draft.blob);
  if (!CONTENT_HASH_PATTERN.test(computed)) {
    throw new Error(`${draft.fileName} produced an invalid sha-256 contentHash.`);
  }
  return computed;
}

async function buildVaultRecordsFromDrafts(
  drafts: VaultDocumentDraft[],
  context: RecordBuildContext,
  hashBlob: HashBlob
): Promise<BackendSpineCoreRecord[]> {
  const records: BackendSpineCoreRecord[] = [];
  const seenVaultObjects = new Set<string>();

  for (const draft of drafts) {
    const contentHash = await resolveDraftHash(draft, hashBlob);
    const vaultObjectId = stableRecordId(context.workspaceId, 'vault-object', contentHash);
    const documentVersionId = stableRecordId(
      context.workspaceId,
      'document-version',
      draft.sourceKind,
      draft.sourceId,
      'original'
    );

    records.push(parseRecord({
      ...baseRecordEnvelope('document', draft.documentRecordId, context),
      documentId: draft.documentId,
      displayTitle: draft.displayTitle,
      fileName: safeFileName(draft.fileName),
      mimeType: draft.mimeType,
      byteLength: draft.byteLength,
      contentHash,
      originalVaultObjectId: vaultObjectId,
    }));

    if (!seenVaultObjects.has(vaultObjectId)) {
      seenVaultObjects.add(vaultObjectId);
      records.push(parseRecord({
        ...baseRecordEnvelope('vault_object', vaultObjectId, context),
        objectId: vaultObjectId,
        objectKind: 'original',
        contentHash,
        byteLength: draft.byteLength,
        storageRef: draft.storageRef,
        localOnly: draft.localOnly,
      }));
    }

    records.push(parseRecord({
      ...baseRecordEnvelope('document_version', documentVersionId, context),
      documentId: draft.documentRecordId,
      versionLabel: 'original',
      vaultObjectId,
      contentHash,
      createdAt: dateTimeRecordValue(draft.createdAt, context.generatedAt),
    }));

    for (const link of draft.links) {
      records.push(parseRecord({
        ...baseRecordEnvelope(
          'document_link',
          stableRecordId(
            context.workspaceId,
            'document-link',
            draft.sourceKind,
            draft.sourceId,
            link.idSeed,
            link.entityKind,
            link.entityId
          ),
          context
        ),
        documentId: draft.documentRecordId,
        entityKind: link.entityKind,
        entityId: link.entityId,
        position: link.position,
      }));
    }
  }

  return sortRecords(records);
}

export async function buildEvidenceVaultRecordsFromWorkspace(
  input: EvidenceVaultAdapterInput
): Promise<BackendSpineCoreRecord[]> {
  const context = buildContext(input);
  const hashBlob = input.hashBlob ?? sha256HexOfBlob;
  const drafts = [
    ...buildDocumentRegistryDrafts(input, context),
    ...buildOwnerDocDrafts(input, context),
    ...buildMapAssetDrafts(input, context),
    ...buildResearchImportDrafts(input, context),
  ];
  return buildVaultRecordsFromDrafts(drafts, context, hashBlob);
}

export async function buildProjectRecordsWithEvidenceVault(
  input: EvidenceVaultAdapterInput
): Promise<ProjectRecordBundle> {
  const context = buildContext(input);
  const baseInput: WorkspaceRecordAdapterInput = {
    workspace: input.workspace,
    ownerData: input.ownerData
      ? { owners: input.ownerData.owners, leases: input.ownerData.leases }
      : undefined,
    documentData: undefined,
    curativeData: input.curativeData,
    projectId: context.projectId,
    generatedAt: context.generatedAt,
    revision: context.revision,
    source: context.source,
    syncState: context.syncState,
    landroidFileVersion: input.landroidFileVersion,
  };
  const baseBundle = buildProjectRecordsFromWorkspace(baseInput);
  const recordsById = new Map<string, BackendSpineCoreRecord>();
  for (const record of baseBundle.records) {
    if (record.recordType !== 'workspace_manifest') {
      recordsById.set(record.recordId, record);
    }
  }
  for (const record of await buildEvidenceVaultRecordsFromWorkspace(input)) {
    recordsById.set(record.recordId, record);
  }
  const records = [...recordsById.values()];
  const recordCounts = countRecordTypes(records);
  recordCounts.workspace_manifest = 1;
  const manifest = WorkspaceManifestRecordSchema.parse({
    ...baseRecordEnvelope(
      'workspace_manifest',
      stableRecordId(context.workspaceId, 'workspace-manifest'),
      context
    ),
    landroidFileVersion: input.landroidFileVersion,
    projectName: fallbackRecordText(input.workspace.projectName, 'Untitled Workspace'),
    generatedAt: context.generatedAt,
    recordCounts,
  });

  return buildProjectRecordBundle({
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    generatedAt: context.generatedAt,
    records: [manifest, ...records],
  });
}

export function removeDocumentLinksFromRecords(
  records: BackendSpineCoreRecord[],
  documentLinkRecordIds: ReadonlyArray<string>
): BackendSpineCoreRecord[] {
  const deleted = new Set(documentLinkRecordIds);
  return records.filter(
    (record) => record.recordType !== 'document_link' || !deleted.has(record.recordId)
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function packetFileName(index: number, fileName: string): string {
  return `${String(index + 1).padStart(4, '0')}-${safeFileName(fileName)}`;
}

function recordContextFromRecords(records: BackendSpineCoreRecord[]): RecordBuildContext {
  const first = records[0];
  if (!first) {
    throw new Error('Cannot build a packet export from an empty record set.');
  }
  return {
    workspaceId: first.workspaceId,
    projectId: first.projectId,
    generatedAt: first.lastModified,
    revision: first.revision,
    source: first.source,
    syncState: first.syncState,
  };
}

export async function buildAttorneyPacketExport(input: {
  records: BackendSpineCoreRecord[];
  packetId: string;
  title: string;
  generatedAt: string;
  includeEdiscoverySidecars?: boolean;
}): Promise<AttorneyPacketExport> {
  const context = {
    ...recordContextFromRecords(input.records),
    generatedAt: input.generatedAt,
  };
  const documents = input.records
    .filter((record): record is BackendDocumentRecord => record.recordType === 'document')
    .sort((left, right) =>
      [
        left.displayTitle,
        left.fileName,
        left.recordId,
      ].join('\0').localeCompare(
        [
          right.displayTitle,
          right.fileName,
          right.recordId,
        ].join('\0')
      )
    );
  const versionsByDocumentId = new Map<string, DocumentVersionRecord>();
  for (const version of input.records.filter(
    (record): record is DocumentVersionRecord => record.recordType === 'document_version'
  )) {
    versionsByDocumentId.set(version.documentId, version);
  }
  const vaultObjectsById = new Map(
    input.records
      .filter((record): record is VaultObjectRecord => record.recordType === 'vault_object')
      .map((record) => [record.recordId, record])
  );
  const linksByDocumentId = new Map<string, DocumentLinkRecord[]>();
  for (const link of input.records.filter(
    (record): record is DocumentLinkRecord => record.recordType === 'document_link'
  )) {
    const existing = linksByDocumentId.get(link.documentId) ?? [];
    existing.push(link);
    linksByDocumentId.set(link.documentId, existing);
  }
  const citationsByDocumentId = new Map<string, SourceCitationRecord[]>();
  for (const citation of input.records.filter(
    (record): record is SourceCitationRecord => record.recordType === 'source_citation'
  )) {
    if (!citation.documentId) continue;
    const existing = citationsByDocumentId.get(citation.documentId) ?? [];
    existing.push(citation);
    citationsByDocumentId.set(citation.documentId, existing);
  }

  const items: AttorneyPacketManifestItem[] = documents.map((document, index) => {
    const version = versionsByDocumentId.get(document.recordId);
    const vaultObject = version ? vaultObjectsById.get(version.vaultObjectId) : undefined;
    const linkedEntities = [...(linksByDocumentId.get(document.recordId) ?? [])]
      .sort((left, right) =>
        left.position - right.position
        || left.entityKind.localeCompare(right.entityKind)
        || left.entityId.localeCompare(right.entityId)
        || left.recordId.localeCompare(right.recordId)
      )
      .map((link) => ({
        documentLinkId: link.recordId,
        entityKind: link.entityKind,
        entityId: link.entityId,
        position: link.position,
      }));
    const sourceCitationIds = [...(citationsByDocumentId.get(document.recordId) ?? [])]
      .map((citation) => citation.recordId)
      .sort();

    return {
      packetOrder: index + 1,
      documentId: document.documentId,
      documentRecordId: document.recordId,
      displayTitle: document.displayTitle,
      fileName: document.fileName,
      nativeFileName: packetFileName(index, document.fileName),
      mimeType: document.mimeType,
      byteLength: document.byteLength,
      contentHash: document.contentHash,
      vaultObjectId: vaultObject?.recordId ?? document.originalVaultObjectId ?? '',
      documentVersionId: version?.recordId ?? '',
      linkedEntities,
      sourceCitationIds,
    };
  });

  const unresolvedIssues = input.records
    .filter((record): record is CurativeIssueRecord => record.recordType === 'curative_issue')
    .filter((issue) => issue.status !== 'resolved' && issue.status !== 'deferred')
    .sort((left, right) => left.recordId.localeCompare(right.recordId))
    .map((issue) => ({
      issueId: issue.issueId,
      title: issue.title,
      priority: issue.priority,
      status: issue.status,
      affectedRecordIds: [...issue.affectedRecordIds].sort(),
    }));

  const packetId = stableRecordId(context.workspaceId, 'packet', input.packetId);
  const manifestWithoutHash = {
    packetId,
    title: input.title,
    packetType: 'attorney' as const,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    generatedAt: input.generatedAt,
    checksumAlgorithm: 'sha256' as const,
    items,
    unresolvedIssues,
  };
  const manifestHash = await sha256HexOfText(stableStringify(manifestWithoutHash));
  const manifest: AttorneyPacketManifest = {
    ...manifestWithoutHash,
    manifestHash,
  };
  const manifestJson = stableStringify(manifest);
  const manifestByteLength = new Blob([manifestJson], {
    type: 'application/json',
  }).size;

  const packetRecord = parseRecord({
    ...baseRecordEnvelope('packet', packetId, context),
    packetId,
    title: input.title,
    packetType: 'attorney',
    status: 'ready',
    itemCount: items.length,
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
    sourceRecordIds: items.map((item) => item.documentRecordId),
  }) as PacketRecord;
  const packetItemRecords = items.map((item, index) =>
    parseRecord({
      ...baseRecordEnvelope(
        'packet_item',
        stableRecordId(context.workspaceId, 'packet-item', packetId, item.documentRecordId),
        context
      ),
      packetItemId: stableRecordId(context.workspaceId, 'packet-item', packetId, item.documentRecordId),
      packetId,
      position: index,
      label: item.displayTitle,
      sourceRecordId: item.documentRecordId,
      documentId: item.documentRecordId,
      vaultObjectId: item.vaultObjectId || undefined,
      contentHash: item.contentHash,
    }) as PacketItemRecord
  );
  const packetExportRecord = parseRecord({
    ...baseRecordEnvelope(
      'packet_export',
      stableRecordId(context.workspaceId, 'packet-export', packetId, manifestHash),
      context
    ),
    packetExportId: stableRecordId(context.workspaceId, 'packet-export', packetId, manifestHash),
    packetId,
    status: 'generated',
    format: 'json',
    generatedAt: input.generatedAt,
    itemCount: items.length,
    manifestHash,
    contentHash: manifestHash,
    byteLength: manifestByteLength,
  }) as PacketExportRecord;

  const sourceCitationSidecars = [...citationsByDocumentId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([documentId, citations]) => ({
      documentId,
      citations: citations
        .sort((left, right) => left.recordId.localeCompare(right.recordId))
        .map((citation) => ({
          sourceCitationId: citation.recordId,
          confidence: citation.confidence,
          pageNumber: citation.pageNumber,
          citedRecordId: citation.citedRecordId,
          quotedTextHash: citation.quotedTextHash,
        })),
    }));
  const eDiscoverySidecars = input.includeEdiscoverySidecars
    ? items.map((item, index) => ({
        controlNumber: `DOC-${String(index + 1).padStart(6, '0')}`,
        fileName: item.nativeFileName,
        sha256: item.contentHash,
        documentRecordId: item.documentRecordId,
      }))
    : [];

  return {
    manifest,
    manifestJson,
    manifestHash,
    records: [packetRecord, ...packetItemRecords, packetExportRecord],
    sourceCitationSidecars,
    eDiscoverySidecars,
  };
}
