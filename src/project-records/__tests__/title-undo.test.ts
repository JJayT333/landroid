/**
 * Phase 4 title cutover — undo / rollback boundary for title commands (item 6).
 * Append-only: undo emits a new `undone` ActionRecord + an audit event that
 * extends the chain; double-undo is refused; non-title records are refused.
 */
import { describe, expect, it } from 'vitest';
import { verifyAuditChain } from '../action-layer/audit-chain';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import { TITLE_UNDO_BOUNDARY, undoTitleActionRecord } from '../action-layer/title-undo';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';

const LATER = '2026-06-01T13:00:00.000Z';

async function appliedTitleAction() {
  return recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'user',
    approvedBy: 'user',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyTitleWorkspace(),
    afterWorkspace: titleWorkspace(),
    ownerData: titleOwnerData(),
  });
}

describe('Phase 4 title undo boundary', () => {
  it('documents a single-record, append-only boundary that delegates live rollback', () => {
    expect(TITLE_UNDO_BOUNDARY.unit).toBe('single_title_action_record');
    expect(TITLE_UNDO_BOUNDARY.appendOnly).toBe(true);
    expect(TITLE_UNDO_BOUNDARY.liveStoreRollback.mechanism).toBe('ai_undo_snapshot');
  });

  it('undo is append-only and extends the audit chain', async () => {
    const applied = await appliedTitleAction();
    const undo = await undoTitleActionRecord({
      context: titleContext(),
      actionRecord: applied.actionRecord,
      previousHash: applied.auditHeadHash,
      occurredAt: LATER,
      reason: 'reviewer reverted',
    });

    expect(undo.undoneActionRecord.status).toBe('undone');
    expect(undo.undoneActionRecord.recordId).toBe(applied.actionRecord.recordId);
    expect(applied.actionRecord.status).toBe('applied'); // original untouched
    expect(undo.auditEvent.eventKind).toBe('action_record.undone');

    const verification = await verifyAuditChain([applied.auditEvent, undo.auditEvent]);
    expect(verification.valid).toBe(true);
    expect(verification.length).toBe(2);
  });

  it('refuses to undo an already-undone record (single-level)', async () => {
    const applied = await appliedTitleAction();
    const undo = await undoTitleActionRecord({
      context: titleContext(),
      actionRecord: applied.actionRecord,
      previousHash: applied.auditHeadHash,
      occurredAt: LATER,
    });
    await expect(
      undoTitleActionRecord({
        context: titleContext(),
        actionRecord: undo.undoneActionRecord,
        previousHash: undo.auditEvent.eventHash!,
        occurredAt: LATER,
      })
    ).rejects.toThrow(/already undone/);
  });

  it('refuses to undo a non-title action record', async () => {
    const applied = await appliedTitleAction();
    const notTitle = { ...applied.actionRecord, actionKind: 'owner.update' };
    await expect(
      undoTitleActionRecord({
        context: titleContext(),
        actionRecord: notTitle,
        previousHash: applied.auditHeadHash,
        occurredAt: LATER,
      })
    ).rejects.toThrow(/non-title/);
  });
});
