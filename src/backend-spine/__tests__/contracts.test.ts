import { describe, expect, it } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  BackendSpineRecordTypeSchema,
  BackendSpineRecordValidationRequestSchema,
  DocumentLinkRecordSchema,
  PartyRecordSchema,
  ProjectRecordSchema,
  RecordEnvelopeSchema,
} from '../contracts';

const now = '2026-05-25T12:00:00.000Z';
const hash = 'a'.repeat(64);

function envelope(recordType = 'project') {
  return {
    recordId: `${recordType}-1`,
    recordType,
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: now,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
  };
}

function candidateFor(recordType: string) {
  const base = envelope(recordType);
  switch (recordType) {
    case 'project':
      return { ...base, name: 'Contract Probe', createdAt: now, updatedAt: now };
    case 'workspace_manifest':
      return {
        ...base,
        landroidFileVersion: 9,
        projectName: 'Contract Probe',
        generatedAt: now,
        recordCounts: {},
      };
    case 'party':
      return { ...base, displayName: 'Contract Party', partyType: 'unknown' };
    case 'party_alias':
      return { ...base, partyId: 'party-1', alias: 'Contract Alias' };
    case 'document':
      return {
        ...base,
        documentId: 'document-1',
        displayTitle: 'Contract Document',
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        byteLength: 1,
        contentHash: hash,
      };
    case 'document_version':
      return {
        ...base,
        documentId: 'document-1',
        versionLabel: 'original',
        vaultObjectId: 'vault-1',
        contentHash: hash,
        createdAt: now,
      };
    case 'vault_object':
      return {
        ...base,
        objectId: 'vault-1',
        objectKind: 'original',
        contentHash: hash,
        byteLength: 1,
        storageRef: 'documents/originals/contract.pdf',
      };
    case 'document_link':
      return {
        ...base,
        documentId: 'document-1',
        entityKind: 'node',
        entityId: 'node-1',
        position: 0,
      };
    case 'source_citation':
      return { ...base, confidence: 'supported' };
    case 'citation_anchor':
      return { ...base, sourceCitationId: 'source-citation-1' };
    case 'source_attestation':
      return { ...base, sourceType: 'title_opinion', status: 'draft' };
    case 'import_session':
      return { ...base, importKind: 'runsheet', status: 'draft', createdAt: now };
    case 'action_plan':
      return {
        ...base,
        actionKind: 'contract_probe',
        status: 'draft',
        proposedBy: 'system',
        summary: 'Contract probe',
        input: {},
      };
    case 'action_record':
      return {
        ...base,
        actionKind: 'contract_probe',
        status: 'applied',
        approvedBy: 'system',
        appliedAt: now,
        result: {},
      };
    case 'audit_event':
      return {
        ...base,
        eventKind: 'contract_probe',
        actorKind: 'system',
        occurredAt: now,
        details: {},
      };
    default:
      return base;
  }
}

describe('backend spine contracts', () => {
  it('requires the backend record envelope fields Phase 0.5 sharding depends on', () => {
    expect(
      RecordEnvelopeSchema.parse(envelope('document_link'))
    ).toMatchObject({
      recordId: 'document_link-1',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
      revision: 0,
      source: 'local',
    });
  });

  it('rejects future schema versions instead of silently accepting unknown records', () => {
    expect(() =>
      RecordEnvelopeSchema.parse({
        ...envelope(),
        schemaVersion: BACKEND_SPINE_CONTRACT_VERSION + 1,
      })
    ).toThrow();
  });

  it('keeps project, party, and document-link records serializable without blobs', () => {
    const project = ProjectRecordSchema.parse({
      ...envelope('project'),
      name: 'Vulcan Mesa',
      createdAt: now,
      updatedAt: now,
    });
    const party = PartyRecordSchema.parse({
      ...envelope('party'),
      displayName: 'Vulcan Mesa Petroleum, LLC',
      partyType: 'company',
    });
    const link = DocumentLinkRecordSchema.parse({
      ...envelope('document_link'),
      documentId: 'document-1',
      entityKind: 'node',
      entityId: 'node-1',
      position: 0,
    });

    expect(JSON.parse(JSON.stringify({ project, party, link }))).toMatchObject({
      project: { recordType: 'project' },
      party: { recordType: 'party' },
      link: { recordType: 'document_link', entityKind: 'node' },
    });
  });

  it('validates a mixed record batch through the shared request schema', () => {
    const request = BackendSpineRecordValidationRequestSchema.parse({
      records: [
        {
          ...envelope('project'),
          name: 'Vulcan Mesa',
          createdAt: now,
          updatedAt: now,
        },
        {
          ...envelope('vault_object'),
          objectId: 'vault-1',
          objectKind: 'original',
          contentHash: hash,
          byteLength: 12,
          storageRef: 'documents/originals/document-1.pdf',
          localOnly: true,
        },
      ],
    });

    expect(request.records).toHaveLength(2);
  });

  it('has an envelope-compatible schema for every declared record type', () => {
    const types = BackendSpineRecordTypeSchema.options;

    for (const recordType of types) {
      expect(BackendSpineCoreRecordSchema.safeParse(candidateFor(recordType)).success, recordType).toBe(true);
    }
  });

  it('keeps envelope-only stubs strict until their body schemas are defined', () => {
    const parsed = BackendSpineCoreRecordSchema.parse(envelope('lease'));
    expect(parsed.recordType).toBe('lease');

    expect(
      BackendSpineCoreRecordSchema.safeParse({
        ...envelope('lease'),
        arbitraryLeasePayload: true,
      }).success
    ).toBe(false);
  });
});
