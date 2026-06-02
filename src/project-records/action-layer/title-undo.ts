/**
 * Phase 4 title cutover — undo / rollback boundary for title commands (SHADOW).
 *
 * Title commands inherit the action layer's existing boundary unchanged:
 * - The undo unit is ONE title ActionRecord. Undo is APPEND-ONLY — it produces a
 *   new `undone` ActionRecord plus an `action_record.undone` audit event that
 *   extends the hash chain; prior records and audit history are never rewritten.
 * - The LIVE-STORE rollback boundary is unchanged: the existing single-level AI
 *   `UndoSnapshot` (workspace/owner/curative/map/documents). The action layer
 *   never rolls the live title store back itself; it delegates to that snapshot.
 *   This matters for `deleteNode`, whose live cascade (documents/owners/leases)
 *   is owned by the store and reverts via the snapshot, not by replaying records.
 * - AI-proposed title undos stay gated: a title mutation may only originate from
 *   a tool inside HOSTED_BLOCKED_TOOL_NAMES (see `assertTitleCommandRoutesThroughGate`).
 *
 * This module is a thin, title-named delegation to the shared mechanism so the
 * boundary is explicit and independently testable for the title surface.
 */
import {
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import { AI_UNDO_SNAPSHOT_SECTIONS } from '../../ai/undo-store';
import type { RecordBuildContext } from '../record-helpers';
import {
  undoActionRecord,
  type ActionRecordUndoResult,
} from './undo-boundary';

export const TITLE_UNDO_BOUNDARY = {
  /** A title undo reverts exactly one title ActionRecord. */
  unit: 'single_title_action_record',
  appendOnly: true,
  undoneActionRecordStatus: 'undone',
  undoneAuditEventKind: 'action_record.undone',
  /** Live title-store rollback stays with the existing AI undo snapshot. */
  liveStoreRollback: {
    mechanism: 'ai_undo_snapshot',
    scope: 'single_level',
    sections: AI_UNDO_SNAPSHOT_SECTIONS,
  },
  aiProposalGate: 'HOSTED_BLOCKED_TOOL_NAMES',
} as const;

/**
 * Undo a single title ActionRecord. Append-only: returns a new `undone`
 * ActionRecord + the `action_record.undone` audit event to append; the original
 * record and the live store are untouched (live rollback delegates to the AI undo
 * snapshot). Refuses to undo a non-title or already-undone record.
 */
export async function undoTitleActionRecord(input: {
  context: RecordBuildContext;
  actionRecord: ActionRecord;
  previousHash: string;
  occurredAt: string;
  actorKind?: AuditEventRecord['actorKind'];
  reason?: string;
}): Promise<ActionRecordUndoResult> {
  if (!input.actionRecord.actionKind.startsWith('title.')) {
    throw new Error(
      `undoTitleActionRecord refuses non-title action "${input.actionRecord.actionKind}".`
    );
  }
  return undoActionRecord(input);
}
