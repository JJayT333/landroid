import { describe, expect, it } from 'vitest';
import {
  BackendSpineCoreRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import {
  approveImportSessionCandidates,
  buildImportSessionDryRunActionPlan,
  buildStagedImportSession,
  type ImportApprovalDraft,
} from '../import-sessions';
import type { RecordBuildContext } from '../record-helpers';
import {
  materializeCommandBatch,
  materializeImportApproval,
  verifyAuditChain,
} from '../action-layer';
import { interestRecord, makeCommand, NOW, upsert } from './action-layer-fixtures';

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'import',
  syncState: 'local_only',
};

const APPROVED_AT = '2026-06-01T12:30:00.000Z';

async function importApproval(): Promise<ImportApprovalDraft> {
  const session = await buildStagedImportSession({
    context,
    sessionIdSeed: 'phase4-import',
    createdAt: NOW,
    sourcePackage: {
      packageKind: 'runsheet',
      packageId: 'synthetic-runsheet',
      title: 'Synthetic runsheet',
      documentIds: ['doc-1'],
    },
    sourceRows: [
      {
        rowKey: 'row-1',
        rowNumber: 1,
        documentId: 'doc-1',
        rawCells: { Instrument: 'Mineral Deed', Grantor: 'Grantor A', Grantee: 'Owner A' },
      },
    ],
    candidates: [
      {
        candidateKey: 'cand-1',
        candidateKind: 'instrument_record',
        confidence: 0.9,
        sourceRowKeys: ['row-1'],
        proposedAction: {
          actionKind: 'create_instrument_record',
          targetRecordType: 'instrument_record',
          targetRecordId: 'instrument-import-1',
          summary: 'Create instrument from runsheet row 1',
          input: { instrumentType: 'Mineral Deed', grantor: 'Grantor A', grantee: 'Owner A' },
        },
      },
    ],
  });
  const dryRunActionPlan = buildImportSessionDryRunActionPlan({
    session,
    generatedAt: NOW,
  });
  return approveImportSessionCandidates({
    session,
    dryRunActionPlan,
    candidateIds: session.candidates.map((candidate) => candidate.candidateId),
    approvedAt: APPROVED_AT,
    approvedBy: 'user',
  });
}

function parseAll(records: readonly unknown[]) {
  return records.map((record) => BackendSpineCoreRecordSchema.parse(record));
}

describe('Phase 4 durable ActionRecords from Phase 3 drafts', () => {
  it('turns approved import drafts into durable ActionRecords + an audit chain', async () => {
    const approval = await importApproval();
    expect(approval.actionRecordDrafts.length).toBe(1);

    const durable = await materializeImportApproval({ approval, appliedAt: APPROVED_AT });

    expect(durable.wouldMutateLiveStores).toBe(false);
    expect(durable.wouldWriteLandroidV8).toBe(false);

    const action = durable.actionRecords[0] as ActionRecord;
    expect(action).toMatchObject({
      recordType: 'action_record',
      status: 'applied',
      approvedBy: 'user',
      actionKind: 'create_instrument_record',
    });
    expect(action.result).toMatchObject({
      targetRecordType: 'instrument_record',
      targetRecordId: 'instrument-import-1',
      mutationBoundary: 'project_records_only_no_live_store',
      wouldMutateLiveStores: false,
    });
    // the durable record preserves the citations the Phase 3 draft accumulated
    expect(action.result.sourceCitationIds).toEqual(
      approval.actionRecordDrafts[0].sourceCitationIds
    );

    // audit chain: one plan-approved event, then one applied event per record.
    const events = durable.auditEvents as AuditEventRecord[];
    expect(events[0].eventKind).toBe('import_session.approved');
    expect(events.slice(1).every((event) => event.eventKind === 'action_record.applied')).toBe(true);
    expect((await verifyAuditChain(events)).valid).toBe(true);

    // everything to persist is a valid, additive record (no live-store writes).
    expect(() => parseAll(durable.recordsToAppend)).not.toThrow();
    const types = durable.recordsToAppend.map((record) => record.recordType);
    expect(types).toContain('action_plan');
    expect(types).toContain('action_record');
    expect(types).toContain('audit_event');
  });

  it('materializes a generic typed-command batch into records + audit chain', async () => {
    const commands = [
      makeCommand({
        commandKind: 'title.create_root_node',
        surface: 'title_tree',
        origin: 'user',
        recordEffects: [upsert(interestRecord('interest-1'))],
      }),
      makeCommand({
        commandKind: 'title.convey',
        surface: 'title_tree',
        origin: 'user',
        recordEffects: [upsert(interestRecord('interest-2', { fraction: '1/4' }))],
      }),
    ];

    const durable = await materializeCommandBatch({
      context,
      commands,
      approvedBy: 'user',
      appliedAt: APPROVED_AT,
    });

    expect(durable.actionRecords.map((record) => record.actionKind)).toEqual([
      'title.create_root_node',
      'title.convey',
    ]);
    expect(durable.actionRecords.every((record) => record.status === 'applied')).toBe(true);
    expect((await verifyAuditChain(durable.auditEvents)).valid).toBe(true);
    expect(durable.recordsToAppend).toHaveLength(
      durable.actionRecords.length + durable.auditEvents.length
    );
    expect(durable.auditHeadHash).toBe(
      durable.auditEvents[durable.auditEvents.length - 1].eventHash
    );
  });
});
