import {
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
import {
  baseRecordEnvelope,
  cleanRecordText,
  dateOnlyRecordValue,
  dateTimeRecordValue,
  fallbackRecordText,
  hashStableText,
  requireContentHash,
  slugRecordText,
  stableRecordId,
  type RecordBuildContext,
} from './record-helpers';

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
  if (cleanRecordText(owner.name)) return 'person';
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
  const context: RecordBuildContext = {
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
    const name = cleanRecordText(displayName);
    if (!name) return null;
    const key = name.toLowerCase();
    const existing = partyIdsByName.get(key);
    if (existing) return existing;
    const recordId = preferredId ?? stableRecordId(
      context.workspaceId,
      'party',
      slugRecordText(name),
      hashStableText(name)
    );
    partyIdsByName.set(key, recordId);
    addRecord({
      ...baseRecordEnvelope('party', recordId, context),
      displayName: name,
      partyType,
    });
    return recordId;
  };

  addRecord({
    ...baseRecordEnvelope('project', stableRecordId(context.workspaceId, 'project'), context),
    name: fallbackRecordText(input.workspace.projectName, 'Untitled Workspace'),
    createdAt: context.generatedAt,
    updatedAt: context.generatedAt,
  });

  for (const owner of input.ownerData?.owners ?? []) {
    const partyId = stableRecordId(context.workspaceId, 'party', 'owner', owner.id);
    const ensured = ensureParty(owner.name || owner.id, partyId, inferPartyType(owner));
    if (ensured) partyIdsByOwnerId.set(owner.id, ensured);
  }

  for (const deskMap of input.workspace.deskMaps) {
    const tractId = stableRecordId(
      context.workspaceId,
      'tract',
      deskMap.tractId ?? deskMap.id
    );
    addRecord({
      ...baseRecordEnvelope('tract', tractId, context),
      tractId,
      name: fallbackRecordText(deskMap.name, deskMap.code || deskMap.id),
      code: deskMap.code,
      legalDescription: deskMap.description,
      grossAcres: deskMap.grossAcres,
      pooledAcres: deskMap.pooledAcres,
      deskMapId: stableRecordId(context.workspaceId, 'desk-map', deskMap.id),
    });
    addRecord({
      ...baseRecordEnvelope('desk_map', stableRecordId(context.workspaceId, 'desk-map', deskMap.id), context),
      deskMapId: deskMap.id,
      name: fallbackRecordText(deskMap.name, deskMap.code || deskMap.id),
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
    const documentRecordId = stableRecordId(context.workspaceId, 'document', document.docId);
    const vaultObjectId = stableRecordId(context.workspaceId, 'vault-object', contentHash);
    addRecord({
      ...baseRecordEnvelope('document', documentRecordId, context),
      documentId: document.docId,
      displayTitle: fallbackRecordText(document.displayTitle, document.fileName || document.docId),
      fileName: fallbackRecordText(document.fileName, document.docId),
      mimeType: fallbackRecordText(document.mimeType, 'application/octet-stream'),
      byteLength: document.byteLength,
      contentHash,
      originalVaultObjectId: vaultObjectId,
    });
    addRecord({
      ...baseRecordEnvelope('vault_object', vaultObjectId, context),
      objectId: vaultObjectId,
      objectKind: 'original',
      contentHash,
      byteLength: document.byteLength,
      storageRef: `local-documents/${document.docId}`,
      localOnly: true,
    });
    addRecord({
      ...baseRecordEnvelope(
        'document_version',
        stableRecordId(context.workspaceId, 'document-version', document.docId, 'original'),
        context
      ),
      documentId: documentRecordId,
      versionLabel: 'original',
      vaultObjectId,
      contentHash,
      createdAt: dateTimeRecordValue(document.createdAt, context.generatedAt),
    });
  }

  for (const attachment of input.documentData?.attachments ?? []) {
    addRecord({
      ...baseRecordEnvelope(
        'document_link',
        stableRecordId(context.workspaceId, 'document-link', attachment.attachmentId),
        context
      ),
      documentId: stableRecordId(context.workspaceId, 'document', attachment.docId),
      entityKind: attachment.entityKind,
      entityId: attachment.entityId,
      position: attachment.position,
    });
  }

  for (const node of input.workspace.nodes) {
    const instrumentId = stableRecordId(context.workspaceId, 'instrument', node.id);
    const granteePartyId =
      (node.linkedOwnerId ? partyIdsByOwnerId.get(node.linkedOwnerId) : null)
      ?? ensureParty(node.grantee, null, 'unknown');
    const grantorPartyId = ensureParty(node.grantor, null, 'unknown');
    addRecord({
      ...baseRecordEnvelope('instrument_record', instrumentId, context),
      instrumentType: fallbackRecordText(node.instrument, node.type === 'related' ? 'Related Record' : 'Instrument'),
      instrumentDate: dateOnlyRecordValue(node.date),
      recordingDate: dateOnlyRecordValue(node.fileDate),
      recordingReference: {
        instrumentNumber: node.docNo,
        volume: node.vol,
        page: node.page,
      },
      grantorPartyIds: grantorPartyId ? [grantorPartyId] : [],
      granteePartyIds: granteePartyId ? [granteePartyId] : [],
      documentId: node.attachments[0]?.docId
        ? stableRecordId(context.workspaceId, 'document', node.attachments[0].docId)
        : undefined,
      legalDescription: node.landDesc,
      summary: node.remarks,
    });

    const [displayDecimal] = dualDisplay(node.fraction).split(' | ');
    addRecord({
      ...baseRecordEnvelope('interest_reference', stableRecordId(context.workspaceId, 'interest', node.id), context),
      interestId: node.id,
      subjectRecordId: instrumentId,
      partyId: granteePartyId ?? undefined,
      parentInterestId: node.parentId
        ? stableRecordId(context.workspaceId, 'interest', node.parentId)
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
        .map((deskMap) => stableRecordId(context.workspaceId, 'desk-map', deskMap.id)),
      leaseId: node.linkedLeaseId
        ? stableRecordId(context.workspaceId, 'lease', node.linkedLeaseId)
        : undefined,
    });
  }

  for (const lease of input.ownerData?.leases ?? []) {
    addRecord({
      ...baseRecordEnvelope('lease', stableRecordId(context.workspaceId, 'lease', lease.id), context),
      leaseId: lease.id,
      ownerId: lease.ownerId,
      lessorPartyId: partyIdsByOwnerId.get(lease.ownerId),
      leaseName: lease.leaseName,
      lesseeName: lease.lessee,
      royaltyRate: lease.royaltyRate,
      leasedInterest: lease.leasedInterest,
      effectiveDate: dateOnlyRecordValue(lease.effectiveDate),
      expirationDate: dateOnlyRecordValue(lease.expirationDate),
      status: lease.status,
      jurisdiction: lease.jurisdiction,
      docNo: lease.docNo,
      notes: lease.notes,
      depthRange: lease.depthRange,
    });
  }

  if (input.workspace.leaseholdUnit) {
    addRecord({
      ...baseRecordEnvelope('unit', stableRecordId(context.workspaceId, 'unit', 'active'), context),
      unitId: stableRecordId(context.workspaceId, 'unit', 'active'),
      name: fallbackRecordText(input.workspace.leaseholdUnit.name, 'Active Unit'),
      operatorName: input.workspace.leaseholdUnit.operator,
      jurisdiction: input.workspace.leaseholdUnit.jurisdiction,
      effectiveDate: dateOnlyRecordValue(input.workspace.leaseholdUnit.effectiveDate),
      tractIds: input.workspace.deskMaps.map((deskMap) =>
        stableRecordId(context.workspaceId, 'tract', deskMap.tractId ?? deskMap.id)
      ),
    });
  }

  for (const issue of input.curativeData?.titleIssues ?? []) {
    const affectedRecordIds = [
      issue.affectedNodeId ? stableRecordId(context.workspaceId, 'interest', issue.affectedNodeId) : null,
      issue.affectedDeskMapId ? stableRecordId(context.workspaceId, 'desk-map', issue.affectedDeskMapId) : null,
      issue.affectedLeaseId ? stableRecordId(context.workspaceId, 'lease', issue.affectedLeaseId) : null,
      issue.affectedOwnerId ? partyIdsByOwnerId.get(issue.affectedOwnerId) ?? null : null,
    ].filter((value): value is string => Boolean(value));
    addRecord({
      ...baseRecordEnvelope('curative_issue', stableRecordId(context.workspaceId, 'curative-issue', issue.id), context),
      issueId: issue.id,
      title: fallbackRecordText(issue.title, issue.issueType),
      issueType: issue.issueType,
      priority: mapCurativePriority(issue.priority),
      status: mapCurativeStatus(issue.status),
      affectedRecordIds,
      dueDate: dateOnlyRecordValue(issue.dueDate),
      requiredAction: issue.requiredCurativeAction,
      notes: issue.notes,
      resolutionNotes: issue.resolutionNotes,
    });
  }

  const recordCounts = countRecordTypes(records);
  recordCounts.workspace_manifest = 1;
  const manifest = WorkspaceManifestRecordSchema.parse({
    ...baseRecordEnvelope('workspace_manifest', stableRecordId(context.workspaceId, 'workspace-manifest'), context),
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
