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
    case 'extraction_run':
      return {
        ...base,
        extractionRunId: 'extraction-run-1',
        documentId: 'document-1',
        inputDocumentVersionId: 'document-version-1',
        inputVaultObjectId: 'vault-1',
        extractionMode: 'selectable_pdf_text',
        engine: 'pdftotext',
        engineVersion: '26.04.0',
        parameters: { layout: true },
        providerDecision: { providerKind: 'local', providerName: 'pdftotext' },
        status: 'succeeded',
        startedAt: now,
        completedAt: now,
        confidenceSummary: { pageCount: 1 },
        outputVaultObjectIds: ['vault-text-1'],
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
    case 'instrument_record':
      return {
        ...base,
        instrumentType: 'Mineral Deed',
        instrumentDate: '2026-01-01',
        county: 'Reeves',
        state: 'TX',
        grantorPartyIds: ['party-grantor'],
        granteePartyIds: ['party-grantee'],
        legalDescription: 'Section 12',
      };
    case 'tract':
      return {
        ...base,
        tractId: 'tract-1',
        name: 'Section 12',
        code: 'T1',
        county: 'Reeves',
        state: 'TX',
        grossAcres: '640',
        pooledAcres: '640',
        deskMapId: 'desk-map-1',
      };
    case 'desk_map':
      return {
        ...base,
        deskMapId: 'desk-map-1',
        name: 'Section 12 Desk Map',
        code: 'T1',
        tractId: 'tract-1',
        grossAcres: '640',
        pooledAcres: '640',
        description: 'Contract desk map',
        nodeIds: ['node-1'],
      };
    case 'lease':
      return {
        ...base,
        leaseId: 'lease-1',
        ownerId: 'owner-1',
        leaseName: 'Contract Lease',
        lesseeName: 'Contract Operator',
        royaltyRate: '1/8',
        leasedInterest: '1',
        effectiveDate: '2026-01-01',
        status: 'Active',
        jurisdiction: 'tx_fee',
        depthRange: 'all_depths',
      };
    case 'unit':
      return {
        ...base,
        unitId: 'unit-1',
        name: 'Contract Unit',
        operatorName: 'Contract Operator',
        jurisdiction: 'tx_fee',
        effectiveDate: '2026-01-01',
        tractIds: ['tract-1'],
      };
    case 'wellbore':
      return {
        ...base,
        wellboreId: 'wellbore-1',
        name: 'Contract 1H',
        apiNumber: '42-000-00000',
        operatorName: 'Contract Operator',
        unitId: 'unit-1',
        tractIds: ['tract-1'],
        status: 'permitted',
      };
    case 'interest_reference':
      return {
        ...base,
        interestId: 'interest-1',
        partyId: 'party-1',
        parentInterestId: null,
        instrumentRecordId: 'instrument-1',
        interestClass: 'mineral',
        fraction: '0.5',
        initialFraction: '0.5',
        displayDecimal: '0.500000000',
        displayFraction: '1/2',
        depthRange: 'all_depths',
        jurisdiction: 'tx_fee',
        deskMapIds: ['desk-map-1'],
      };
    case 'curative_issue':
      return {
        ...base,
        issueId: 'issue-1',
        title: 'Missing probate',
        issueType: 'Probate / heirship',
        priority: 'medium',
        status: 'open',
        affectedRecordIds: ['interest-1'],
        requiredAction: 'Find probate record',
      };
    case 'lease_obligation':
      return {
        ...base,
        obligationId: 'obligation-1',
        leaseId: 'lease-1',
        obligationType: 'rental',
        status: 'open',
        dueDate: '2026-06-01',
        description: 'Delay rental',
      };
    case 'obligation_event':
      return {
        ...base,
        eventId: 'obligation-event-1',
        obligationId: 'obligation-1',
        eventType: 'created',
        occurredAt: now,
        notes: 'Created from contract probe',
      };
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
    case 'packet':
      return {
        ...base,
        packetId: 'packet-1',
        title: 'Attorney packet',
        packetType: 'attorney',
        status: 'draft',
        itemCount: 1,
        createdAt: now,
        updatedAt: now,
        sourceRecordIds: ['document-1'],
      };
    case 'packet_item':
      return {
        ...base,
        packetItemId: 'packet-item-1',
        packetId: 'packet-1',
        position: 0,
        label: 'Contract document',
        documentId: 'document-1',
        contentHash: hash,
      };
    case 'packet_export':
      return {
        ...base,
        packetExportId: 'packet-export-1',
        packetId: 'packet-1',
        status: 'generated',
        format: 'zip',
        generatedAt: now,
        itemCount: 1,
        manifestHash: hash,
        contentHash: hash,
        byteLength: 12,
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

  it('rejects bodyless records now that Phase 1 record schemas are defined', () => {
    expect(BackendSpineCoreRecordSchema.safeParse(envelope('lease')).success).toBe(false);
    expect(
      BackendSpineCoreRecordSchema.safeParse({
        ...candidateFor('lease'),
        arbitraryLeasePayload: true,
      }).success
    ).toBe(false);
  });

  it('requires cloud extraction runs to carry explicit document opt-in risk fields', () => {
    expect(
      BackendSpineCoreRecordSchema.safeParse({
        ...candidateFor('extraction_run'),
        providerDecision: {
          providerKind: 'cloud',
          providerName: 'Cloud OCR',
          optInDocumentId: 'document-1',
          approvedAt: now,
          approvedBy: 'user',
          dataResidencyWarningAccepted: true,
          retentionPolicyAcknowledged: true,
          retentionPolicyNote: 'Provider retention reviewed for this document.',
        },
      }).success
    ).toBe(true);
    expect(
      BackendSpineCoreRecordSchema.safeParse({
        ...candidateFor('extraction_run'),
        providerDecision: {
          providerKind: 'cloud',
          providerName: 'Cloud OCR',
        },
      }).success
    ).toBe(false);
  });
});
