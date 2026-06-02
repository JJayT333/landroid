import { describe, expect, it } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import {
  approveImportSessionCandidates,
  buildImportSessionDryRunActionPlan,
  buildImportSourceReview,
  buildStagedImportSession,
  PHASE_3_IMPORT_SESSION_MUTATION_BOUNDARY,
  rejectImportSessionCandidates,
  type StagedImportCandidate,
  type StagedImportSession,
} from '../import-sessions';
import type { RecordBuildContext } from '../record-helpers';
import { buildRecordValidationRequest } from '../record-validation';

const NOW = '2026-06-01T12:00:00.000Z';
const LATER = '2026-06-01T12:05:00.000Z';
const HASH = '7'.repeat(64);

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'import',
  syncState: 'local_only',
};

function envelope(recordType = 'vault_object') {
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

function candidateByKind(
  session: StagedImportSession,
  candidateKind: StagedImportCandidate['candidateKind']
): StagedImportCandidate {
  const candidate = session.candidates.find((item) => item.candidateKind === candidateKind);
  if (!candidate) throw new Error(`Missing candidate kind ${candidateKind}`);
  return candidate;
}

async function recurringRunsheetSession() {
  return buildStagedImportSession({
    context,
    sessionIdSeed: '2026-06-runsheet',
    createdAt: NOW,
    sourcePackage: {
      packageKind: 'recurring_runsheet',
      packageId: 'spring-run-2026-06-synthetic',
      title: 'Synthetic recurring runsheet package',
      documentIds: ['doc-runsheet-csv'],
      recurrence: {
        seriesKey: 'monthly-runsheet',
        occurrenceKey: '2026-06',
        cadence: 'monthly',
        label: 'June 2026',
      },
    },
    sourceRows: [
      {
        rowKey: 'row-1',
        rowNumber: 1,
        documentId: 'doc-runsheet-csv',
        documentVersionId: 'document-version-runsheet',
        rawCells: {
          Instrument: 'Mineral Deed',
          Grantor: 'Grantor A',
          Grantee: 'Owner A',
          Fraction: '1/2',
        },
        normalizedCells: {
          instrument: 'Mineral Deed',
          grantor: 'Grantor A',
          grantee: 'Owner A',
          fraction: '1/2',
        },
        excerpts: [
          {
            excerptKey: 'row-text',
            text: 'Grantor A conveys an undivided one-half mineral interest to Owner A.',
            pageNumber: 2,
            charStart: 120,
            charEnd: 189,
            vaultObjectId: 'vault-text-1',
            extractionRunId: 'extraction-run-1',
          },
        ],
      },
      {
        rowKey: 'row-2',
        rowNumber: 2,
        documentId: 'doc-runsheet-csv',
        rawCells: {
          Instrument: 'Lease',
          Lessor: 'Owner A',
          Lessee: 'Operator A',
          Royalty: '1/8',
        },
        normalizedCells: {
          instrument: 'Lease',
          lessor: 'Owner A',
          lessee: 'Operator A',
          royaltyRate: '1/8',
        },
      },
    ],
    candidates: [
      {
        candidateKey: 'instrument-row-1',
        candidateKind: 'instrument_record',
        confidence: 0.94,
        sourceRowKeys: ['row-1'],
        proposedAction: {
          actionKind: 'create_instrument_record',
          targetRecordType: 'instrument_record',
          targetRecordId: 'instrument-draft-row-1',
          summary: 'Create Mineral Deed from runsheet row 1.',
          input: {
            instrumentType: 'Mineral Deed',
            grantor: 'Grantor A',
            grantee: 'Owner A',
          },
        },
      },
      {
        candidateKey: 'lease-row-2',
        candidateKind: 'lease',
        confidence: 0.87,
        sourceRowKeys: ['row-2'],
        proposedAction: {
          actionKind: 'create_lease',
          targetRecordType: 'lease',
          targetRecordId: 'lease-draft-row-2',
          summary: 'Create lease from runsheet row 2.',
          input: {
            lessor: 'Owner A',
            lesseeName: 'Operator A',
            royaltyRate: '1/8',
          },
        },
      },
    ],
  });
}

describe('Phase 3 import sessions', () => {
  it('builds immutable recurring-runsheet source rows and a dry-run ActionPlan preview', async () => {
    const session = await recurringRunsheetSession();
    const dryRun = buildImportSessionDryRunActionPlan({
      session,
      generatedAt: LATER,
    });

    expect(session.importSessionRecord).toMatchObject({
      recordType: 'import_session',
      importKind: 'runsheet',
      status: 'staged',
      sourceDocumentIds: ['doc-runsheet-csv'],
    });
    expect(session.sourcePackage).toMatchObject({
      packageKind: 'recurring_runsheet',
      recurrence: {
        seriesKey: 'monthly-runsheet',
        occurrenceKey: '2026-06',
      },
    });
    expect(Object.isFrozen(session.sourceRows[0])).toBe(true);
    expect(Object.isFrozen(session.sourceExcerpts[0])).toBe(true);
    expect(session.sourceRows[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(buildRecordValidationRequest([...session.records, dryRun]).records)
      .toHaveLength(session.records.length + 1);

    expect(dryRun).toMatchObject({
      recordType: 'action_plan',
      actionKind: 'import_session_dry_run',
      status: 'needs_review',
      proposedBy: 'import',
    });
    expect(dryRun.input).toMatchObject({
      dryRun: true,
      mutationBoundary: 'project_records_only_no_live_store',
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
      blockedCandidateIds: [],
    });
    expect(dryRun.input.typedActions).toHaveLength(2);
  });

  it('turns ambiguous fractions into questions and blocks approval', async () => {
    const session = await buildStagedImportSession({
      context,
      sessionIdSeed: 'ambiguous-interest',
      createdAt: NOW,
      sourcePackage: {
        packageKind: 'runsheet',
        packageId: 'synthetic-runsheet',
        title: 'Synthetic runsheet',
        documentIds: ['doc-runsheet-csv'],
      },
      sourceRows: [
        {
          rowKey: 'row-ambiguous',
          rowNumber: 1,
          documentId: 'doc-runsheet-csv',
          rawCells: {
            Grantee: 'Owner B',
            Fraction: '1/3.5',
          },
        },
      ],
      candidates: [
        {
          candidateKey: 'interest-row-ambiguous',
          candidateKind: 'interest_reference',
          confidence: 0.58,
          sourceRowKeys: ['row-ambiguous'],
          proposedAction: {
            actionKind: 'create_interest_reference',
            targetRecordType: 'interest_reference',
            targetRecordId: 'interest-draft-row-ambiguous',
            summary: 'Create ambiguous mineral interest.',
            input: {
              partyName: 'Owner B',
              fraction: '1/3.5',
            },
          },
        },
      ],
    });
    const candidate = candidateByKind(session, 'interest_reference');
    const dryRun = buildImportSessionDryRunActionPlan({
      session,
      generatedAt: LATER,
    });

    expect(candidate.questions).toEqual([
      expect.objectContaining({
        field: 'fraction',
        severity: 'blocking',
        reason: 'The source row does not contain a clean mineral-interest fraction.',
      }),
    ]);
    expect(dryRun.input.blockedCandidateIds).toEqual([candidate.candidateId]);
    expect(dryRun.input.questionsByCandidateId).toMatchObject({
      [candidate.candidateId]: [
        expect.objectContaining({
          prompt: 'Confirm the fraction before this candidate can be approved.',
        }),
      ],
    });
    await expect(approveImportSessionCandidates({
      session,
      dryRunActionPlan: dryRun,
      candidateIds: [candidate.candidateId],
      approvedAt: LATER,
      approvedBy: 'user',
    })).rejects.toThrow('unanswered questions');
  });

  it('rejects candidates with zero target-record, citation, link, or action residue', async () => {
    const session = await recurringRunsheetSession();
    const leaseCandidate = candidateByKind(session, 'lease');
    const rejection = rejectImportSessionCandidates({
      session,
      candidateIds: [leaseCandidate.candidateId],
    });

    expect(rejection).toMatchObject({
      rejectedCandidateIds: [leaseCandidate.candidateId],
      recordsToAppend: [],
      actionRecordDrafts: [],
      targetRecordDrafts: [],
      mutationCount: 0,
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
    });
    expect(
      rejection.remainingSession.candidates.map((candidate) => candidate.candidateId)
    ).not.toContain(leaseCandidate.candidateId);
    expect(rejection.remainingSession.records.map((record) => record.recordType))
      .not.toEqual(expect.arrayContaining([
        'document_link',
        'source_citation',
        'action_record',
        'lease',
      ]));
  });

  it('approves candidates into action drafts and citations without live-store mutation', async () => {
    const session = await recurringRunsheetSession();
    const dryRun = buildImportSessionDryRunActionPlan({
      session,
      generatedAt: LATER,
    });
    const approval = await approveImportSessionCandidates({
      session,
      dryRunActionPlan: dryRun,
      candidateIds: session.candidates.map((candidate) => candidate.candidateId),
      approvedAt: LATER,
      approvedBy: 'user',
    });

    expect(approval.approvedActionPlan).toMatchObject({
      recordType: 'action_plan',
      status: 'approved',
      lastModified: LATER,
    });
    expect(approval.actionRecordDrafts).toHaveLength(2);
    expect(approval.actionRecordDrafts[0]).toMatchObject({
      status: 'draft',
      mutationBoundary: 'project_records_only_no_live_store',
      sourceRowIds: [session.sourceRows[0].sourceRowId],
      sourceCitationIds: [approval.sourceCitationRecords[0].recordId],
    });
    expect(approval.recordsToAppend.map((record) => record.recordType))
      .toEqual(expect.arrayContaining(['source_citation', 'citation_anchor']));
    expect(approval.recordsToAppend.map((record) => record.recordType))
      .not.toEqual(expect.arrayContaining([
        'action_record',
        'instrument_record',
        'lease',
        'interest_reference',
      ]));
    expect(approval.sourceCitationRecords[0]).toMatchObject({
      documentId: 'doc-runsheet-csv',
      citedRecordId: session.sourceRows[0].sourceRowId,
      quotedTextHash: session.sourceExcerpts[0].textHash,
      createdBy: 'import',
    });
    expect(approval.wouldMutateLiveStores).toBe(false);
    expect(approval.wouldWriteLandroidV8).toBe(false);
    expect(buildRecordValidationRequest([
      approval.approvedActionPlan,
      ...approval.recordsToAppend,
    ]).records).toHaveLength(approval.recordsToAppend.length + 1);
  });

  it('ties title-opinion-as-root import to a SourceAttestation draft', async () => {
    const session = await buildStagedImportSession({
      context,
      sessionIdSeed: 'title-opinion-root',
      createdAt: NOW,
      sourcePackage: {
        packageKind: 'title_opinion',
        packageId: 'synthetic-title-opinion',
        title: 'Synthetic title opinion',
        documentIds: ['doc-title-opinion'],
      },
      titleOpinionRoot: {
        documentId: 'doc-title-opinion',
        effectiveDate: '2026-05-15',
        attestor: 'Synthetic Attorney',
        scope: 'Opinion root for staged synthetic import.',
      },
      sourceRows: [
        {
          rowKey: 'opinion-root-row',
          rowNumber: 1,
          documentId: 'doc-title-opinion',
          rawCells: {
            Finding: 'Root opinion',
          },
        },
      ],
      candidates: [
        {
          candidateKey: 'opinion-root-candidate',
          candidateKind: 'source_attestation',
          confidence: 0.91,
          sourceRowKeys: ['opinion-root-row'],
          proposedAction: {
            actionKind: 'create_source_attestation',
            targetRecordType: 'source_attestation',
            targetRecordId: 'source-attestation-title-opinion-root',
            summary: 'Stage title opinion as the root source attestation.',
            input: {
              sourceType: 'title_opinion',
              documentId: 'doc-title-opinion',
            },
          },
        },
      ],
    });
    const dryRun = buildImportSessionDryRunActionPlan({
      session,
      generatedAt: LATER,
    });
    const approval = await approveImportSessionCandidates({
      session,
      dryRunActionPlan: dryRun,
      candidateIds: [session.candidates[0].candidateId],
      approvedAt: LATER,
      approvedBy: 'user',
    });

    expect(session.sourceAttestationRecord).toMatchObject({
      recordType: 'source_attestation',
      sourceType: 'title_opinion',
      documentId: 'doc-title-opinion',
      status: 'draft',
    });
    expect(session.candidates[0].sourceAttestationId)
      .toBe(session.sourceAttestationRecord?.recordId);
    expect(approval.actionRecordDrafts[0].sourceAttestationId)
      .toBe(session.sourceAttestationRecord?.recordId);
    expect(dryRun.input.candidates).toEqual([
      expect.objectContaining({
        sourceAttestationId: session.sourceAttestationRecord?.recordId,
      }),
    ]);
  });

  it('builds side-by-side source review when OCR/text records are available', async () => {
    const session = await recurringRunsheetSession();
    const extractionRun = BackendSpineCoreRecordSchema.parse({
      ...envelope('extraction_run'),
      recordId: 'extraction-run-1',
      extractionRunId: 'extraction-run-1',
      documentId: 'doc-runsheet-csv',
      inputDocumentVersionId: 'document-version-runsheet',
      inputVaultObjectId: 'vault-original-1',
      extractionMode: 'selectable_pdf_text',
      engine: 'pdftotext',
      engineVersion: '26.04.0',
      parameters: {},
      providerDecision: { providerKind: 'local', providerName: 'pdftotext' },
      status: 'succeeded',
      startedAt: NOW,
      completedAt: NOW,
      confidenceSummary: { pageCount: 1 },
      outputVaultObjectIds: ['vault-text-1'],
    }) as BackendSpineCoreRecord;
    const textVaultObject = BackendSpineCoreRecordSchema.parse({
      ...envelope('vault_object'),
      recordId: 'vault-text-1',
      objectId: 'vault-text-1',
      objectKind: 'text_file',
      derivedFromVaultObjectId: 'vault-original-1',
      contentHash: HASH,
      byteLength: 512,
      storageRef: 'documents/doc-runsheet-csv/extractions/text.txt',
      localOnly: true,
    }) as BackendSpineCoreRecord;
    const review = buildImportSourceReview({
      session,
      records: [extractionRun, textVaultObject],
      candidateIds: [session.candidates[0].candidateId],
    });

    expect(review).toEqual([
      expect.objectContaining({
        candidateId: session.candidates[0].candidateId,
        sourceRowId: session.sourceRows[0].sourceRowId,
        documentId: 'doc-runsheet-csv',
        textAvailable: true,
        reviewMode: 'side_by_side_text',
        sourceRow: expect.objectContaining({
          normalizedCells: expect.objectContaining({
            fraction: '1/2',
          }),
        }),
        sourceExcerpts: [
          expect.objectContaining({
            text: 'Grantor A conveys an undivided one-half mineral interest to Owner A.',
            vaultObjectId: 'vault-text-1',
            extractionRunId: 'extraction-run-1',
            charStart: 120,
            charEnd: 189,
          }),
        ],
      }),
    ]);
  });

  it('documents the Phase 3 mutation boundary as project-record-only', () => {
    expect(PHASE_3_IMPORT_SESSION_MUTATION_BOUNDARY).toEqual({
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
      blockedRecordTypes: [
        'action_record',
        'instrument_record',
        'interest_reference',
        'lease',
        'tract',
      ],
    });
  });
});
