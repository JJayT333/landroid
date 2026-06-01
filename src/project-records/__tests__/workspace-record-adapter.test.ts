import { describe, expect, it } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import { createBlankNode, type DeskMap } from '../../types/node';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import {
  buildAIContextProjection,
  buildMathInputView,
  verifyCitationSupport,
} from '../projections';
import { buildRecordValidationRequest } from '../record-validation';
import { buildProjectRecordsFromWorkspace } from '../workspace-record-adapter';

const NOW = '2026-06-01T12:00:00.000Z';
const HASH = 'b'.repeat(64);

function envelope(recordType = 'source_citation') {
  return {
    recordId: `${recordType}-1`,
    recordType,
    workspaceId: 'ws-1',
    projectId: 'project-1',
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
  };
}

function workspaceFixture(
  overrides: Partial<WorkspaceData> = {}
): WorkspaceData {
  const node = {
    ...createBlankNode('node-1'),
    grantor: 'State of Texas',
    grantee: 'A Owner',
    instrument: 'Patent',
    docNo: 'P-1',
    fraction: '0.5',
    initialFraction: '0.5',
    linkedOwnerId: 'owner-1',
    attachments: [
      {
        docId: 'doc-1',
        attachmentId: 'att-1',
        fileName: 'patent.pdf',
        kind: 'deed' as const,
      },
    ],
  };
  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: 'tract-1',
    grossAcres: '100',
    pooledAcres: '100',
    description: 'Test tract',
    nodeIds: ['node-1'],
  };

  return {
    workspaceId: 'ws-1',
    projectName: 'Record Fixture',
    nodes: [node],
    deskMaps: [deskMap],
    leaseholdUnit: {
      name: 'Test Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2026-01-01',
      jurisdiction: 'tx_fee',
    },
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Patent'],
    ...overrides,
  };
}

describe('Phase 1 project-record adapter', () => {
  it('builds backend-spine records from current WorkspaceData without blobs', () => {
    const owner = createBlankOwner('ws-1', {
      id: 'owner-1',
      name: 'A Owner',
      entityType: 'Individual',
      createdAt: NOW,
      updatedAt: NOW,
    });
    const lease = createBlankLease('ws-1', owner.id, {
      id: 'lease-1',
      leaseName: 'A Lease',
      lessee: 'Operator A',
      royaltyRate: '1/8',
      leasedInterest: '1/2',
      effectiveDate: '2026-01-01',
      jurisdiction: 'tx_fee',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const bundle = buildProjectRecordsFromWorkspace({
      workspace: workspaceFixture(),
      ownerData: { owners: [owner], leases: [lease] },
      documentData: {
        documents: [
          {
            docId: 'doc-1',
            workspaceId: 'ws-1',
            fileName: 'patent.pdf',
            mimeType: 'application/pdf',
            byteLength: 12,
            contentHash: HASH,
            blob: new Blob(['fixture'], { type: 'application/pdf' }),
            kind: 'deed',
            displayTitle: 'Patent',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        attachments: [
          {
            attachmentId: 'att-1',
            workspaceId: 'ws-1',
            docId: 'doc-1',
            entityKind: 'node',
            entityId: 'node-1',
            position: 0,
            createdAt: NOW,
          },
        ],
      },
      curativeData: {
        titleIssues: [
          {
            id: 'issue-1',
            workspaceId: 'ws-1',
            title: 'Missing probate',
            issueType: 'Probate / heirship',
            priority: 'High',
            status: 'Open',
            affectedDeskMapId: 'dm-1',
            affectedNodeId: 'node-1',
            affectedOwnerId: owner.id,
            affectedLeaseId: null,
            sourceDocNo: 'P-1',
            requiredCurativeAction: 'Find probate',
            responsibleParty: '',
            dueDate: '2026-06-30',
            notes: '',
            resolutionNotes: '',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
      generatedAt: NOW,
      projectId: 'project-1',
      landroidFileVersion: LANDROID_FILE_VERSION,
      syncState: 'local_only',
    });

    expect(buildRecordValidationRequest(bundle.records).records).toHaveLength(
      bundle.records.length
    );
    expect(bundle.records.map((record) => record.recordType)).toEqual(
      expect.arrayContaining([
        'workspace_manifest',
        'project',
        'party',
        'tract',
        'desk_map',
        'document',
        'document_version',
        'vault_object',
        'document_link',
        'instrument_record',
        'interest_reference',
        'lease',
        'unit',
        'curative_issue',
      ])
    );
    expect(
      bundle.records.find((record) => record.recordType === 'document')
    ).not.toHaveProperty('blob');
  });

  it('builds MathInputView with jurisdiction isolation and dual displays', () => {
    const owner = createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' });
    const texasLease = createBlankLease('ws-1', owner.id, {
      id: 'lease-tx',
      royaltyRate: '1/8',
      leasedInterest: '1/2',
      jurisdiction: 'tx_fee',
    });
    const federalLease = createBlankLease('ws-1', owner.id, {
      id: 'lease-fed',
      royaltyRate: '1/8',
      leasedInterest: '1/2',
      jurisdiction: 'federal',
    });

    const view = buildMathInputView({
      workspace: workspaceFixture(),
      ownerData: { owners: [owner], leases: [texasLease, federalLease] },
      projectId: 'project-1',
      generatedAt: NOW,
    });

    expect(view.preconditions.jurisdictionIsolation).toMatchObject({
      status: 'warning',
      excludedLeaseIds: ['lease-fed'],
    });
    expect(view.texasLeaseIds).toEqual(['lease-tx']);
    expect(view.nodeDisplays[0]).toMatchObject({
      nodeId: 'node-1',
      decimal: '0.5',
      fraction: '1/2',
      dualDisplay: '0.500000000 | 1/2',
    });
    expect(view.transferOrderReview.expectedDecimal).toBe('0.5');
  });

  it('blocks MathInputView calculations when the active unit jurisdiction is non-Texas', () => {
    const view = buildMathInputView({
      workspace: workspaceFixture({
        leaseholdUnit: {
          name: 'Federal Unit',
          description: '',
          operator: 'Operator A',
          effectiveDate: '2026-01-01',
          jurisdiction: 'federal',
        },
      }),
      ownerData: { owners: [], leases: [] },
      projectId: 'project-1',
      generatedAt: NOW,
    });

    expect(view.preconditions.jurisdictionIsolation).toMatchObject({
      status: 'blocked',
      blockedUnitJurisdiction: 'federal',
    });
    expect(view.decimalRows).toEqual([]);
  });

  it('projects AI mutation coverage and citation verification failure behavior', () => {
    const citation = BackendSpineCoreRecordSchema.parse({
      ...envelope('source_citation'),
      confidence: 'supported',
    }) as BackendSpineCoreRecord;
    const context = buildAIContextProjection({
      projectId: 'project-1',
      records: [citation],
    });

    expect(context.mutationGuard.covered).toBe(true);
    expect(context.mutationGuard.projectStateMutatingTools).toContain('createLease');

    expect(
      verifyCitationSupport({
        records: [citation],
        claims: [
          {
            claimId: 'claim-1',
            text: 'The lease is supported.',
            citationIds: [citation.recordId],
          },
          {
            claimId: 'claim-2',
            text: 'This claim lacks support.',
            citationIds: ['missing-citation'],
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      failureBehavior: 'block_answer',
      results: [
        { claimId: 'claim-1', confidence: 'supported' },
        { claimId: 'claim-2', confidence: 'insufficient' },
      ],
    });
  });
});

