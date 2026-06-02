/**
 * Shared synthetic fixtures for the Phase 4 action-layer tests. No PII / no
 * real .landroid data — every record here is invented.
 */
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import {
  parseActionCommand,
  type ActionCommand,
  type RecordEffect,
} from '../action-layer/commands';

export const NOW = '2026-06-01T12:00:00.000Z';
export const HASH = 'a'.repeat(64);

export function envelope(
  recordType: string,
  recordId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    recordId,
    recordType,
    workspaceId: 'ws-1',
    projectId: 'project-1',
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
    ...overrides,
  };
}

function parseRecord(input: Record<string, unknown>): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(input);
}

export function partyRecord(
  id = 'party-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('party', id),
    displayName: 'Owner A',
    partyType: 'person',
    ...overrides,
  });
}

export function leaseRecord(
  id = 'lease-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('lease', id),
    leaseId: id,
    leaseName: 'A Lease',
    lesseeName: 'Operator A',
    royaltyRate: '1/8',
    leasedInterest: '1/2',
    jurisdiction: 'tx_fee',
    ...overrides,
  });
}

export function instrumentRecord(
  id = 'instrument-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('instrument_record', id),
    instrumentType: 'Mineral Deed',
    grantorPartyIds: ['party-grantor'],
    granteePartyIds: ['party-1'],
    ...overrides,
  });
}

export function interestRecord(
  id = 'interest-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('interest_reference', id),
    interestId: id,
    interestClass: 'mineral',
    fraction: '1/2',
    jurisdiction: 'tx_fee',
    ...overrides,
  });
}

export function curativeRecord(
  id = 'curative-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('curative_issue', id),
    issueId: id,
    title: 'Missing probate',
    priority: 'high',
    status: 'open',
    ...overrides,
  });
}

export function documentLinkRecord(
  id = 'document-link-1',
  overrides: Record<string, unknown> = {}
): BackendSpineCoreRecord {
  return parseRecord({
    ...envelope('document_link', id),
    documentId: 'document-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    ...overrides,
  });
}

export function upsert(record: BackendSpineCoreRecord): RecordEffect {
  return { op: 'upsert', record };
}

let commandSeq = 0;

/** Build a valid command with sensible defaults; pass overrides as needed. */
export function makeCommand(overrides: Partial<ActionCommand> & {
  commandKind: ActionCommand['commandKind'];
  surface: ActionCommand['surface'];
}): ActionCommand {
  commandSeq += 1;
  return parseActionCommand({
    commandId: overrides.commandId ?? `cmd-${commandSeq}`,
    summary: overrides.summary ?? 'synthetic command',
    origin: overrides.origin ?? 'user',
    recordEffects: overrides.recordEffects ?? [],
    sourceCitationIds: overrides.sourceCitationIds ?? [],
    ...overrides,
  });
}
