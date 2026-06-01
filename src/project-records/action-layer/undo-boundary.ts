/**
 * Phase 4 — explicit undo / rollback boundary (SHADOW).
 *
 * The action layer defines exactly one thing undo reverts and exactly where the
 * rollback boundary sits:
 *
 * - Action-layer undo unit = ONE ActionRecord. Undo is APPEND-ONLY: it produces
 *   a new ActionRecord with status `undone` and writes a new
 *   `action_record.undone` AuditEvent that extends the hash chain. It never
 *   edits or deletes prior records or audit history.
 * - The LIVE-STORE rollback boundary is unchanged: it remains the existing
 *   single-level AI `UndoSnapshot` covering every store an AI mutator can touch
 *   (AI_UNDO_SNAPSHOT_SECTIONS). The action layer never rolls live stores back
 *   directly — it delegates to that mechanism.
 * - Every AI-proposal path stays routed through the existing approval/undo gate:
 *   an `ai.proposal` command must name a tool inside HOSTED_BLOCKED_TOOL_NAMES.
 *   Nothing bypasses it.
 */
import {
  ActionRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import { HOSTED_BLOCKED_TOOL_NAMES } from '../../ai/tools';
import { AI_UNDO_SNAPSHOT_SECTIONS } from '../../ai/undo-store';
import { stableRecordId, type RecordBuildContext } from '../record-helpers';
import { appendAuditEvent } from './audit-chain';
import type { ActionCommand } from './commands';

export const ACTION_LAYER_UNDO_BOUNDARY = {
  /** The action layer reverts exactly one ActionRecord at a time. */
  unit: 'single_action_record',
  /** Undo never rewrites history — it appends an undone record + audit event. */
  appendOnly: true,
  undoneActionRecordStatus: 'undone',
  undoneAuditEventKind: 'action_record.undone',
  /** Live-store rollback stays with the existing single-level AI undo snapshot. */
  liveStoreRollback: {
    mechanism: 'ai_undo_snapshot',
    scope: 'single_level',
    sections: AI_UNDO_SNAPSHOT_SECTIONS,
  },
  /** AI proposals must route through this existing gate; nothing bypasses it. */
  aiProposalGate: 'HOSTED_BLOCKED_TOOL_NAMES',
} as const;

export interface ActionRecordUndoResult {
  /** A new ActionRecord (status `undone`); the original is left untouched. */
  undoneActionRecord: ActionRecord;
  /** The append-only audit event recording the undo. */
  auditEvent: AuditEventRecord;
  /** The action layer never rolls back live stores; it delegates. */
  liveStoreRollbackDelegatedTo: 'ai_undo_snapshot';
  wouldMutateLiveStores: false;
}

/**
 * Undo a single ActionRecord at the record layer. Returns a new `undone`
 * ActionRecord plus the `action_record.undone` audit event to append. The
 * original record is not mutated (immutable history) and live stores are not
 * touched (that rollback path stays with the AI undo snapshot).
 */
export async function undoActionRecord(input: {
  context: RecordBuildContext;
  actionRecord: ActionRecord;
  previousHash: string;
  occurredAt: string;
  actorKind?: AuditEventRecord['actorKind'];
  reason?: string;
}): Promise<ActionRecordUndoResult> {
  if (input.actionRecord.status === 'undone') {
    throw new Error(
      `ActionRecord ${input.actionRecord.recordId} is already undone; undo is single-level.`
    );
  }

  const undoneActionRecord = ActionRecordSchema.parse({
    ...input.actionRecord,
    status: 'undone',
    lastModified: input.occurredAt,
    revision: input.actionRecord.revision + 1,
  });

  const auditEvent = await appendAuditEvent({
    context: input.context,
    previousHash: input.previousHash,
    draft: {
      recordId: stableRecordId(
        input.context.workspaceId,
        'audit-event',
        input.actionRecord.recordId,
        'undone'
      ),
      eventKind: ACTION_LAYER_UNDO_BOUNDARY.undoneAuditEventKind,
      actorKind: input.actorKind ?? 'user',
      subjectRecordIds: [input.actionRecord.recordId],
      occurredAt: input.occurredAt,
      details: {
        reverts: input.actionRecord.recordId,
        actionKind: input.actionRecord.actionKind,
        reason: input.reason,
      },
    },
  });

  return {
    undoneActionRecord,
    auditEvent,
    liveStoreRollbackDelegatedTo: 'ai_undo_snapshot',
    wouldMutateLiveStores: false,
  };
}

/**
 * Assert every `ai.proposal` command names a tool inside the existing hosted
 * read-only gate. A command naming a non-gated tool would be a bypass and throws.
 */
export function assertAIProposalCommandsRouteThroughGate(
  commands: readonly ActionCommand[],
  gate: ReadonlySet<string> = HOSTED_BLOCKED_TOOL_NAMES
): void {
  for (const command of commands) {
    if (command.surface !== 'ai_proposal') continue;
    if (!command.aiToolName || !gate.has(command.aiToolName)) {
      throw new Error(
        `ai_proposal command ${command.commandId} names tool ` +
          `"${command.aiToolName ?? '(none)'}", which is not gated by ` +
          `HOSTED_BLOCKED_TOOL_NAMES. Nothing may bypass the approval/undo gate.`
      );
    }
  }
}

/** The gate Phase 4 AI-proposal commands must fall within. */
export const AI_PROPOSAL_GATE_TOOL_NAMES: ReadonlySet<string> = HOSTED_BLOCKED_TOOL_NAMES;
