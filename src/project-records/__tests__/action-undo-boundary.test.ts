import { describe, expect, it } from 'vitest';
import { AI_UNDO_SNAPSHOT_SECTIONS } from '../../ai/undo-store';
import type { RecordBuildContext } from '../record-helpers';
import {
  ACTION_LAYER_UNDO_BOUNDARY,
  AI_PROPOSAL_GATE_TOOL_NAMES,
  assertAIProposalCommandsRouteThroughGate,
  materializeCommandBatch,
  undoActionRecord,
  verifyAuditChain,
} from '../action-layer';
import { interestRecord, makeCommand, NOW, upsert } from './action-layer-fixtures';

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'local',
  syncState: 'local_only',
};

const APPLIED_AT = '2026-06-01T12:30:00.000Z';
const UNDONE_AT = '2026-06-01T12:31:00.000Z';

async function appliedBatch() {
  return materializeCommandBatch({
    context,
    approvedBy: 'user',
    appliedAt: APPLIED_AT,
    commands: [
      makeCommand({
        commandKind: 'title.create_root_node',
        surface: 'title_tree',
        recordEffects: [upsert(interestRecord('interest-1'))],
      }),
    ],
  });
}

describe('Phase 4 undo / rollback boundary', () => {
  it('undo appends an undone record + audit event without rewriting history', async () => {
    const batch = await appliedBatch();
    const original = batch.actionRecords[0];

    const undo = await undoActionRecord({
      context,
      actionRecord: original,
      previousHash: batch.auditHeadHash,
      occurredAt: UNDONE_AT,
    });

    expect(undo.undoneActionRecord.status).toBe('undone');
    expect(undo.undoneActionRecord.revision).toBe(original.revision + 1);
    expect(undo.wouldMutateLiveStores).toBe(false);
    // the original record is immutable — undo produced a NEW record
    expect(original.status).toBe('applied');

    // the undo event extends the existing chain; full history still verifies
    const fullChain = [...batch.auditEvents, undo.auditEvent];
    expect((await verifyAuditChain(fullChain)).valid).toBe(true);
    expect(undo.auditEvent.eventKind).toBe('action_record.undone');
    expect(undo.auditEvent.details).toMatchObject({ reverts: original.recordId });
  });

  it('refuses to undo an already-undone record (single-level)', async () => {
    const batch = await appliedBatch();
    const undo = await undoActionRecord({
      context,
      actionRecord: batch.actionRecords[0],
      previousHash: batch.auditHeadHash,
      occurredAt: UNDONE_AT,
    });
    await expect(
      undoActionRecord({
        context,
        actionRecord: undo.undoneActionRecord,
        previousHash: undo.auditEvent.eventHash!,
        occurredAt: UNDONE_AT,
      })
    ).rejects.toThrow(/already undone/);
  });

  it('pins the live-store rollback boundary to the existing AI undo snapshot', () => {
    expect(ACTION_LAYER_UNDO_BOUNDARY.unit).toBe('single_action_record');
    expect(ACTION_LAYER_UNDO_BOUNDARY.appendOnly).toBe(true);
    expect(ACTION_LAYER_UNDO_BOUNDARY.liveStoreRollback.mechanism).toBe('ai_undo_snapshot');
    expect(ACTION_LAYER_UNDO_BOUNDARY.liveStoreRollback.sections).toEqual(
      AI_UNDO_SNAPSHOT_SECTIONS
    );
  });

  it('routes AI-proposal commands only through the existing hosted gate', () => {
    // createLease is a real gated tool in HOSTED_BLOCKED_TOOL_NAMES
    expect(AI_PROPOSAL_GATE_TOOL_NAMES.has('createLease')).toBe(true);

    const gated = makeCommand({
      commandKind: 'ai.proposal',
      surface: 'ai_proposal',
      origin: 'ai',
      aiToolName: 'createLease',
    });
    expect(() => assertAIProposalCommandsRouteThroughGate([gated])).not.toThrow();

    const bypass = makeCommand({
      commandKind: 'ai.proposal',
      surface: 'ai_proposal',
      origin: 'ai',
      aiToolName: 'definitelyNotARegisteredTool',
    });
    expect(() => assertAIProposalCommandsRouteThroughGate([bypass])).toThrow(
      /not gated by HOSTED_BLOCKED_TOOL_NAMES/
    );
  });
});
