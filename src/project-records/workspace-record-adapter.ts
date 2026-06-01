import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  WorkspaceManifestRecordSchema,
  type BackendSpineCoreRecord,
  type BackendSpineRecordSource,
  type BackendSpineSyncState,
  type BackendSpineRecordType,
} from '../backend-spine/contracts';
import { dualDisplay, formatAsFraction } from '../engine/fraction-display';
import type { CurativeWorkspaceData } from '../storage/curative-persistence';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../storage/workspace-persistence';
import type { TitleIssuePriority, TitleIssueStatus } from '../types/title-issue';
import type { Owner } from '../types/owner';
import { buildProjectRecordBundle, type ProjectRecordBundle } from './record-validation';

export interface WorkspaceRecordAdapterInput {
  workspace: WorkspaceData;
  ownerData?: Pick<OwnerWorkspaceData, 'owners' | 'leases'>;
  documentData?: DocumentWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  projectId?: string;
  generatedAt: string;
  revision?: number;
  source?: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
  landroidFileVersion: number;
}

interface BuildContext {
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  revision: number;
  source: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
}

const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

function clean(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function fallbackText(value: string | null | undefined, fallback: string): string {
  return clean(value) || fallback;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72)
    || 'record'
  );
}

function stableId(...parts: string[]): string {
  const raw = parts.map((part) => clean(part) || 'unknown').join(':');
  if (raw.length <= 150) return raw;
  return `${raw.slice(0, 120)}:${hashText(raw)}`;
}

function dateOnly(value: string | null | undefined): string | undefined {
  const candidate = clean(value);
  if (!candidate) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  const parsed = new Date(candidate);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function dateTime(value: string | null | undefined, fallback: string): string {
  const candidate = clean(value);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function requireContentHash(value: string, label: string): string {
  const candidate = clean(value).toLowerCase();
  if (CONTENT_HASH_PATTERN.test(candidate)) return candidate;
  throw new Error(`${label} is missing a valid sha-256 contentHash.`);
}

function baseEnvelope(
  recordType: BackendSpineRecordType,
  recordId: string,
  context: BuildContext
) {
  return {
    recordId,
    recordType,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: context.generatedAt,
    revision: context.revision,
    source: context.source,
    syncState: context.syncState,
  };
}

function parseRecord(record: unknown): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(record);
}

function inferPartyType(owner: Owner): 'person' | 'company' | 'trust' | 'estate' | 'government' | 'unknown' {
  const text = `${owner.entityType} ${owner.name}`.toLowerCase();
  if (/\b(trust|trustee)\b/.test(text)) return 'trust';
  if (/\b(estate|heir|deceased)\b/.test(text)) return 'estate';
  if (/\b(state|county|city|glo|blm|usa|united states)\b/.test(text)) return 'government';
  if (/\b(llc|inc|corp|company|co\.|ltd|lp|llp|partners|energy|oil|gas)\b/.test(text)) {
    return 'company';
  }
  if (clean(owner.name)) return 'person';
  return 'unknown';
}

function mapCurativePriority(priority: TitleIssuePriority): 'critical' | 'high' | 'medium' | 'low' | 'unknown' {
  switch (priority) {
    case 'Critical':
      return 'critical';
    case 'High':
      return 'high';
    case 'Medium':
      return 'medium';
    case 'Low':
      return 'low';
    default:
      return 'unknown';
  }
}

function mapCurativeStatus(
  status: TitleIssueStatus
):
  | 'open'
  | 'researching'
  | 'curative_requested'
  | 'waiting_on_third_party'
  | 'ready_for_review'
  | 'resolved'
  | 'deferred'
  | 'unknown' {
  switch (status) {
    case 'Open':
      return 'open';
    case 'Researching':
      return 'researching';
    case 'Curative Requested':
      return 'curative_requested';
    case 'Waiting on Third Party':
      return 'waiting_on_third_party';
    case 'Ready for Review':
      return 'ready_for_review';
    case 'Resolved':
      return 'resolved';
    case 'Deferred':
      return 'deferred';
    default:
      return 'unknown';
  }
}

function countRecordTypes(records: BackendSpineCoreRecord[]) {
  const counts: Partial<Record<BackendSpineRecordType, number>> = {};
  for (const record of records) {
    counts[record.recordType] = (counts[record.recordType] ?? 0) + 1;
  }
  return counts;
}

export function buildProjectRecordsFromWorkspace(
  input: WorkspaceRecordAdapterInput
): ProjectRecordBundle {
  const context: BuildContext = {
    workspaceId: input.workspace.workspaceId,
    projectId: input.projectId ?? input.workspace.workspaceId,
    generatedAt: input.generatedAt,
    revision: input.revision ?? 0,
    source: input.source ?? 'local',
    syncState: input.syncState,
  };
  const records: BackendSpineCoreRecord[] = [];
  const partyIdsByOwnerId = new Map<string, string>();
  const partyIdsByName = new Map<string, string>();

  const addRecord = (record: unknown) => {
    records.push(parseRecord(record));
  };

  const ensureParty = (
    displayName: string,
    preferredId: string | null,
    partyType: 'person' | 'company' | 'trust' | 'estate' | 'government' | 'unknown'
  ): string | null => {
    const name = clean(displayName);
    if (!name) return null;
    const key = name.toLowerCase();
    const existing = partyIdsByName.get(key);
    if (existing) return existing;
    const recordId = preferredId ?? stableId(context.workspaceId, 'party', slug(name), hashText(name));
    partyIdsByName.set(key, recordId);
    addRecord({
      ...baseEnvelope('party', recordId, context),
      displayName: name,
      partyType,
    });
    return recordId;
  };

  addRecord({
    ...baseEnvelope('project', stableId(context.workspaceId, 'project'), context),
    name: fallbackText(input.workspace.projectName, 'Untitled Workspace'),
    createdAt: context.generatedAt,
    updatedAt: context.generatedAt,
  });

  for (const owner of input.ownerData?.owners ?? []) {
    const partyId = stableId(context.workspaceId, 'party', 'owner', owner.id);
    const ensured = ensureParty(owner.name || owner.id, partyId, inferPartyType(owner));
    if (ensured) partyIdsByOwnerId.set(owner.id, ensured);
  }

  for (const deskMap of input.workspace.deskMaps) {
    const tractId = stableId(
      context.workspaceId,
      'tract',
      deskMap.tractId ?? deskMap.id
    );
    addRecord({
      ...baseEnvelope('tract', tractId, context),
      tractId,
      name: fallbackText(deskMap.name, deskMap.code || deskMap.id),
      code: deskMap.code,
      legalDescription: deskMap.description,
      grossAcres: deskMap.grossAcres,
      pooledAcres: deskMap.pooledAcres,
      deskMapId: stableId(context.workspaceId, 'desk-map', deskMap.id),
    });
    addRecord({
      ...baseEnvelope('desk_map', stableId(context.workspaceId, 'desk-map', deskMap.id), context),
      deskMapId: deskMap.id,
      name: fallbackText(deskMap.name, deskMap.code || deskMap.id),
      code: deskMap.code,
      tractId,
      grossAcres: deskMap.grossAcres,
      pooledAcres: deskMap.pooledAcres,
      description: deskMap.description,
      nodeIds: deskMap.nodeIds,
      unitName: deskMap.unitName,
      unitCode: deskMap.unitCode,
    });
  }

  for (const document of input.documentData?.documents ?? []) {
    const contentHash = requireContentHash(document.contentHash, document.fileName);
    const documentRecordId = stableId(context.workspaceId, 'document', document.docId);
    const vaultObjectId = stableId(context.workspaceId, 'vault-object', contentHash);
    addRecord({
      ...baseEnvelope('document', documentRecordId, context),
      documentId: document.docId,
      displayTitle: fallbackText(document.displayTitle, document.fileName || document.docId),
      fileName: fallbackText(document.fileName, document.docId),
      mimeType: fallbackText(document.mimeType, 'application/octet-stream'),
      byteLength: document.byteLength,
      contentHash,
      originalVaultObjectId: vaultObjectId,
    });
    addRecord({
      ...baseEnvelope('vault_object', vaultObjectId, context),
      objectId: vaultObjectId,
      objectKind: 'original',
      contentHash,
      byteLength: document.byteLength,
      storageRef: `local-documents/${document.docId}`,
      localOnly: true,
    });
    addRecord({
      ...baseEnvelope(
        'document_version',
        stableId(context.workspaceId, 'document-version', document.docId, 'original'),
        context
      ),
      documentId: documentRecordId,
      versionLabel: 'original',
      vaultObjectId,
      contentHash,
      createdAt: dateTime(document.createdAt, context.generatedAt),
    });
  }

  for (const attachment of input.documentData?.attachments ?? []) {
    addRecord({
      ...baseEnvelope(
        'document_link',
        stableId(context.workspaceId, 'document-link', attachment.attachmentId),
        context
      ),
      documentId: stableId(context.workspaceId, 'document', attachment.docId),
      entityKind: attachment.entityKind,
      entityId: attachment.entityId,
      position: attachment.position,
    });
  }

  for (const node of input.workspace.nodes) {
    const instrumentId = stableId(context.workspaceId, 'instrument', node.id);
    const granteePartyId =
      (node.linkedOwnerId ? partyIdsByOwnerId.get(node.linkedOwnerId) : null)
      ?? ensureParty(node.grantee, null, 'unknown');
    const grantorPartyId = ensureParty(node.grantor, null, 'unknown');
    addRecord({
      ...baseEnvelope('instrument_record', instrumentId, context),
      instrumentType: fallbackText(node.instrument, node.type === 'related' ? 'Related Record' : 'Instrument'),
      instrumentDate: dateOnly(node.date),
      recordingDate: dateOnly(node.fileDate),
      recordingReference: {
        instrumentNumber: node.docNo,
        volume: node.vol,
        page: node.page,
      },
      grantorPartyIds: grantorPartyId ? [grantorPartyId] : [],
      granteePartyIds: granteePartyId ? [granteePartyId] : [],
      documentId: node.attachments[0]?.docId
        ? stableId(context.workspaceId, 'document', node.attachments[0].docId)
        : undefined,
      legalDescription: node.landDesc,
      summary: node.remarks,
    });

    const [displayDecimal] = dualDisplay(node.fraction).split(' | ');
    addRecord({
      ...baseEnvelope('interest_reference', stableId(context.workspaceId, 'interest', node.id), context),
      interestId: node.id,
      subjectRecordId: instrumentId,
      partyId: granteePartyId ?? undefined,
      parentInterestId: node.parentId
        ? stableId(context.workspaceId, 'interest', node.parentId)
        : null,
      instrumentRecordId: instrumentId,
      interestClass:
        node.type === 'related' && node.relatedKind === 'lease'
          ? 'leasehold'
          : node.interestClass,
      fraction: node.fraction,
      initialFraction: node.initialFraction,
      displayDecimal,
      displayFraction: formatAsFraction(node.fraction),
      depthRange: node.depthRange,
      jurisdiction: 'tx_fee',
      deskMapIds: input.workspace.deskMaps
        .filter((deskMap) => deskMap.nodeIds.includes(node.id))
        .map((deskMap) => stableId(context.workspaceId, 'desk-map', deskMap.id)),
      leaseId: node.linkedLeaseId
        ? stableId(context.workspaceId, 'lease', node.linkedLeaseId)
        : undefined,
    });
  }

  for (const lease of input.ownerData?.leases ?? []) {
    addRecord({
      ...baseEnvelope('lease', stableId(context.workspaceId, 'lease', lease.id), context),
      leaseId: lease.id,
      ownerId: lease.ownerId,
      lessorPartyId: partyIdsByOwnerId.get(lease.ownerId),
      leaseName: lease.leaseName,
      lesseeName: lease.lessee,
      royaltyRate: lease.royaltyRate,
      leasedInterest: lease.leasedInterest,
      effectiveDate: dateOnly(lease.effectiveDate),
      expirationDate: dateOnly(lease.expirationDate),
      status: lease.status,
      jurisdiction: lease.jurisdiction,
      docNo: lease.docNo,
      notes: lease.notes,
      depthRange: lease.depthRange,
    });
  }

  if (input.workspace.leaseholdUnit) {
    addRecord({
      ...baseEnvelope('unit', stableId(context.workspaceId, 'unit', 'active'), context),
      unitId: stableId(context.workspaceId, 'unit', 'active'),
      name: fallbackText(input.workspace.leaseholdUnit.name, 'Active Unit'),
      operatorName: input.workspace.leaseholdUnit.operator,
      jurisdiction: input.workspace.leaseholdUnit.jurisdiction,
      effectiveDate: dateOnly(input.workspace.leaseholdUnit.effectiveDate),
      tractIds: input.workspace.deskMaps.map((deskMap) =>
        stableId(context.workspaceId, 'tract', deskMap.tractId ?? deskMap.id)
      ),
    });
  }

  for (const issue of input.curativeData?.titleIssues ?? []) {
    const affectedRecordIds = [
      issue.affectedNodeId ? stableId(context.workspaceId, 'interest', issue.affectedNodeId) : null,
      issue.affectedDeskMapId ? stableId(context.workspaceId, 'desk-map', issue.affectedDeskMapId) : null,
      issue.affectedLeaseId ? stableId(context.workspaceId, 'lease', issue.affectedLeaseId) : null,
      issue.affectedOwnerId ? partyIdsByOwnerId.get(issue.affectedOwnerId) ?? null : null,
    ].filter((value): value is string => Boolean(value));
    addRecord({
      ...baseEnvelope('curative_issue', stableId(context.workspaceId, 'curative-issue', issue.id), context),
      issueId: issue.id,
      title: fallbackText(issue.title, issue.issueType),
      issueType: issue.issueType,
      priority: mapCurativePriority(issue.priority),
      status: mapCurativeStatus(issue.status),
      affectedRecordIds,
      dueDate: dateOnly(issue.dueDate),
      requiredAction: issue.requiredCurativeAction,
      notes: issue.notes,
      resolutionNotes: issue.resolutionNotes,
    });
  }

  const recordCounts = countRecordTypes(records);
  recordCounts.workspace_manifest = 1;
  const manifest = WorkspaceManifestRecordSchema.parse({
    ...baseEnvelope('workspace_manifest', stableId(context.workspaceId, 'workspace-manifest'), context),
    landroidFileVersion: input.landroidFileVersion,
    projectName: fallbackText(input.workspace.projectName, 'Untitled Workspace'),
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

