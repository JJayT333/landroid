/**
 * Phase 4 — durable ActionRecords (SHADOW).
 *
 * An approved change becomes a durable `action_record` plus a paired, hash
 * chained `audit_event`. Two entry points:
 *
 * - {@link materializeCommandBatch}: generic typed-command path (used by the
 *   parity harness and any future surface).
 * - {@link materializeImportApproval}: turns the Phase 3 `ImportApprovalDraft`
 *   (approved candidate DRAFTS) into durable ActionRecords — this is how Phase 3
 *   staging becomes a permanent, auditable record.
 *
 * Everything here is additive to the record layer. ActionRecords and AuditEvents
 * are the durable ledger; the domain records they describe remain owned by the
 * current stores/adapter in this phase (wouldMutateLiveStores: false).
 */
import {
  ActionRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import {
  baseRecordEnvelope,
  stableRecordId,
  type RecordBuildContext,
} from '../record-helpers';
import type {
  ImportApprovalDraft,
  StagedActionRecordDraft,
} from '../import-sessions';
import {
  AUDIT_GENESIS_HASH,
  buildAuditChain,
  type AuditEventDraft,
} from './audit-chain';
import type { ActionCommand } from './commands';

export interface DurableActionResult {
  actionRecords: ActionRecord[];
  auditEvents: AuditEventRecord[];
  /** Additive records to persist: the ActionRecords + AuditEvents (+ extras). */
  recordsToAppend: BackendSpineCoreRecord[];
  /** Head hash of the produced audit chain (continue future appends from here). */
  auditHeadHash: string;
  wouldMutateLiveStores: false;
  wouldWriteLandroidV8: false;
}

function contextFromRecord(
  record: BackendSpineCoreRecord,
  generatedAt: string
): RecordBuildContext {
  return {
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    generatedAt,
    revision: record.revision,
    source: record.source,
    syncState: record.syncState,
  };
}

function commandEffectIds(command: ActionCommand): {
  upserted: string[];
  deleted: string[];
} {
  const upserted: string[] = [];
  const deleted: string[] = [];
  for (const effect of command.recordEffects) {
    if (effect.op === 'upsert') upserted.push(effect.record.recordId);
    else deleted.push(effect.recordId);
  }
  return { upserted, deleted };
}

export function materializeActionRecordFromCommand(input: {
  context: RecordBuildContext;
  command: ActionCommand;
  approvedBy: ActionRecord['approvedBy'];
  appliedAt: string;
}): ActionRecord {
  const { command } = input;
  const recordId = stableRecordId(
    input.context.workspaceId,
    'action-record',
    command.commandId
  );
  const effects = commandEffectIds(command);
  return ActionRecordSchema.parse({
    ...baseRecordEnvelope('action_record', recordId, input.context),
    actionPlanId: command.actionPlanId,
    actionKind: command.commandKind,
    status: 'applied',
    approvedBy: input.approvedBy,
    appliedAt: input.appliedAt,
    result: {
      commandId: command.commandId,
      surface: command.surface,
      origin: command.origin,
      summary: command.summary,
      affectedRecordIds: effects.upserted,
      tombstonedRecordIds: effects.deleted,
      sourceCitationIds: command.sourceCitationIds,
      aiToolName: command.aiToolName,
      mutationBoundary: command.mutationBoundary,
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
    },
  });
}

/**
 * Materialize a batch of typed commands into durable ActionRecords plus a
 * hash-chained audit event per command.
 */
export async function materializeCommandBatch(input: {
  context: RecordBuildContext;
  commands: readonly ActionCommand[];
  approvedBy: ActionRecord['approvedBy'];
  appliedAt: string;
  priorHeadHash?: string;
}): Promise<DurableActionResult> {
  const actionRecords = input.commands.map((command) =>
    materializeActionRecordFromCommand({
      context: input.context,
      command,
      approvedBy: input.approvedBy,
      appliedAt: input.appliedAt,
    })
  );

  const auditDrafts: AuditEventDraft[] = input.commands.map((command, index) => {
    const actionRecord = actionRecords[index];
    const effects = commandEffectIds(command);
    return {
      recordId: stableRecordId(
        input.context.workspaceId,
        'audit-event',
        actionRecord.recordId
      ),
      eventKind: 'action_record.applied',
      actorKind: command.origin,
      actorId: command.aiToolName,
      subjectRecordIds: [actionRecord.recordId, ...effects.upserted, ...effects.deleted],
      occurredAt: input.appliedAt,
      details: {
        commandId: command.commandId,
        commandKind: command.commandKind,
        surface: command.surface,
        summary: command.summary,
      },
    };
  });

  const auditEvents = await buildAuditChain({
    context: input.context,
    drafts: auditDrafts,
    priorHeadHash: input.priorHeadHash,
  });

  return {
    actionRecords,
    auditEvents,
    recordsToAppend: [...actionRecords, ...auditEvents],
    auditHeadHash:
      auditEvents[auditEvents.length - 1]?.eventHash ??
      input.priorHeadHash ??
      AUDIT_GENESIS_HASH,
    wouldMutateLiveStores: false,
    wouldWriteLandroidV8: false,
  };
}

export function materializeActionRecordFromImportDraft(input: {
  context: RecordBuildContext;
  draft: StagedActionRecordDraft;
}): ActionRecord {
  const { draft } = input;
  const recordId = stableRecordId(
    input.context.workspaceId,
    'action-record',
    draft.draftId
  );
  return ActionRecordSchema.parse({
    ...baseRecordEnvelope('action_record', recordId, input.context),
    actionPlanId: draft.actionPlanId,
    actionKind: draft.actionKind,
    status: 'applied',
    approvedBy: draft.approvedBy,
    appliedAt: draft.approvedAt,
    result: {
      targetRecordType: draft.targetRecordType,
      targetRecordId: draft.targetRecordId,
      input: draft.input,
      sourceCitationIds: draft.sourceCitationIds,
      sourceRowIds: draft.sourceRowIds,
      sourceExcerptIds: draft.sourceExcerptIds,
      sourceAttestationId: draft.sourceAttestationId,
      mutationBoundary: draft.mutationBoundary,
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
    },
  });
}

/**
 * Turn an approved Phase 3 import draft into durable ActionRecords + an audit
 * chain. The chain opens with one `import_session.approved` event for the plan,
 * then one `action_record.applied` event per approved candidate. The result's
 * `recordsToAppend` is the additive bundle: approved plan, action records,
 * audit events, and the Phase 3 citation/anchor records.
 */
export async function materializeImportApproval(input: {
  approval: ImportApprovalDraft;
  appliedAt: string;
  priorHeadHash?: string;
}): Promise<DurableActionResult> {
  const { approval } = input;
  const context = contextFromRecord(approval.approvedActionPlan, input.appliedAt);

  const actionRecords = approval.actionRecordDrafts.map((draft) =>
    materializeActionRecordFromImportDraft({ context, draft })
  );

  const planEventDraft: AuditEventDraft = {
    recordId: stableRecordId(
      context.workspaceId,
      'audit-event',
      approval.approvedActionPlan.recordId,
      'approved'
    ),
    eventKind: 'import_session.approved',
    actorKind: 'import',
    subjectRecordIds: [
      approval.approvedActionPlan.recordId,
      ...actionRecords.map((record) => record.recordId),
    ],
    occurredAt: input.appliedAt,
    details: {
      actionPlanId: approval.approvedActionPlan.recordId,
      approvedCount: actionRecords.length,
    },
  };

  const appliedEventDrafts: AuditEventDraft[] = actionRecords.map((actionRecord, index) => {
    const draft = approval.actionRecordDrafts[index];
    return {
      recordId: stableRecordId(
        context.workspaceId,
        'audit-event',
        actionRecord.recordId
      ),
      eventKind: 'action_record.applied',
      actorKind: 'import',
      subjectRecordIds: [actionRecord.recordId, draft.targetRecordId],
      occurredAt: input.appliedAt,
      details: {
        actionKind: draft.actionKind,
        targetRecordType: draft.targetRecordType,
        targetRecordId: draft.targetRecordId,
        sourceCitationIds: draft.sourceCitationIds,
      },
    };
  });

  const auditEvents = await buildAuditChain({
    context,
    drafts: [planEventDraft, ...appliedEventDrafts],
    priorHeadHash: input.priorHeadHash,
  });

  const recordsToAppend: BackendSpineCoreRecord[] = [
    approval.approvedActionPlan,
    ...actionRecords,
    ...auditEvents,
    ...approval.recordsToAppend,
  ];

  return {
    actionRecords,
    auditEvents,
    recordsToAppend,
    auditHeadHash:
      auditEvents[auditEvents.length - 1]?.eventHash ??
      input.priorHeadHash ??
      AUDIT_GENESIS_HASH,
    wouldMutateLiveStores: false,
    wouldWriteLandroidV8: false,
  };
}
