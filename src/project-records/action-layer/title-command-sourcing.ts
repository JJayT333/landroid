/**
 * Phase 4 title cutover — command-sourcing wrapper (SHADOW).
 *
 * One entry point around the seven title-tree mutations. For each mutation it:
 *   (a) lets the existing store/engine perform the mutation (the store stays
 *       canonical — this module never mutates it; the caller supplies a thunk),
 *   (b) reads back the affected node(s) by diffing the store's title projection
 *       before vs after,
 *   (c) builds a typed command carrying the full record-level effects
 *       (instrument_record + interest_reference) plus the affected node
 *       snapshots,
 *   (d) materializes a durable ActionRecord + a hash-chained audit event,
 *   (e) runs parity INLINE and THROWS on any divergence — a mismatch blocks the
 *       mutation's recording; it is never silently shadowed (guardrail 3),
 *   and routes every AI-proposed mutation through the existing approval/undo/
 *   hosted gate (guardrail 5). Nothing here flips a live workflow (guardrail 2).
 *
 * "Full effects" make the durable log self-sufficient: the record effects replay
 * to the title records (see `title-replay.ts`) and the node snapshots reconstruct
 * the math node set (see `title-math-parity.ts`). The store/engine remains the
 * producer of both; we only record what it produced.
 */
import { z } from 'zod';
import {
  ActionRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import { HOSTED_BLOCKED_TOOL_NAMES } from '../../ai/tools';
import type { OwnershipNode } from '../../types/node';
import type { OwnerWorkspaceData } from '../../storage/owner-persistence';
import type { CurativeWorkspaceData } from '../../storage/curative-persistence';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../../storage/workspace-persistence';
import {
  baseRecordEnvelope,
  stableRecordId,
  type RecordBuildContext,
} from '../record-helpers';
import { AUDIT_GENESIS_HASH, buildAuditChain } from './audit-chain';
import {
  parseActionCommand,
  RecordEffectSchema,
  SHADOW_MUTATION_BOUNDARY,
  type ActionCommand,
  type ActionCommandKind,
  type RecordEffect,
} from './commands';
import { encodeSurfaceRecordsAsCommandLog } from './encoders';
import {
  assertParityClean,
  diffRecordSets,
  runSurfaceParity,
  type ParityReport,
} from './parity';
import { reduceCommandLog } from './reducer';
import {
  diffTitleMutation,
  isTitleRecord,
  titleRecordsFromWorkspace,
  type TitleMutationDelta,
} from './title-projection';

/** The seven title-tree mutations Phase 4 routes through typed commands. */
export const TITLE_MUTATIONS = [
  'createRootNode',
  'convey',
  'createNpri',
  'precede',
  'graftToParent',
  'deleteNode',
  'attachLease',
  // generic node field edit (updateNode / rebalance / link clears / lease resync)
  'update',
] as const;
export type TitleMutation = (typeof TITLE_MUTATIONS)[number];
export const TitleMutationSchema = z.enum(TITLE_MUTATIONS);

/** Each title mutation's typed command kind. */
export const COMMAND_KIND_BY_TITLE_MUTATION: Record<TitleMutation, ActionCommandKind> = {
  createRootNode: 'title.create_root_node',
  convey: 'title.convey',
  createNpri: 'title.create_npri',
  precede: 'title.precede',
  graftToParent: 'title.graft_to_parent',
  deleteNode: 'title.delete_node',
  attachLease: 'title.attach_lease',
  update: 'title.update',
};

/**
 * The gated AI tool each title mutation corresponds to. Every one of these is a
 * member of {@link HOSTED_BLOCKED_TOOL_NAMES}, so an AI-proposed title mutation
 * is forced through the same approval/undo/hosted gate as the live tool.
 */
export const AI_TOOL_NAME_BY_TITLE_MUTATION: Record<TitleMutation, string> = {
  createRootNode: 'createRootNode',
  convey: 'convey',
  createNpri: 'createNpri',
  precede: 'precede',
  graftToParent: 'graftToParent',
  deleteNode: 'deleteNode',
  attachLease: 'attachLease',
  // No AI tool performs a generic field update through this path, so an
  // ai-origin 'update' maps to a non-gated name and is correctly rejected by
  // assertTitleCommandRoutesThroughGate. Field edits are user-origin.
  update: 'updateNode',
};

/**
 * Assert an AI-proposed title mutation routes through the existing gate. A title
 * command itself is surface `title_tree` (so it carries no `aiToolName` on the
 * command — that field is reserved for `ai_proposal` commands), but when the
 * mutation originates from the model the corresponding tool MUST be one the
 * hosted read-only gate already blocks. Nothing bypasses the gate.
 */
export function assertTitleCommandRoutesThroughGate(
  mutation: TitleMutation,
  origin: ActionCommand['origin'],
  aiToolName: string | undefined,
  gate: ReadonlySet<string> = HOSTED_BLOCKED_TOOL_NAMES
): void {
  if (origin !== 'ai') {
    if (aiToolName) {
      throw new Error(
        `Title mutation "${mutation}" sets aiToolName "${aiToolName}" but origin is ` +
          `"${origin}"; aiToolName is only meaningful for AI-proposed mutations.`
      );
    }
    return;
  }
  const expected = AI_TOOL_NAME_BY_TITLE_MUTATION[mutation];
  if (aiToolName && aiToolName !== expected) {
    throw new Error(
      `AI title mutation "${mutation}" names tool "${aiToolName}", expected "${expected}".`
    );
  }
  const tool = aiToolName ?? expected;
  if (!gate.has(tool)) {
    throw new Error(
      `AI title mutation "${mutation}" tool "${tool}" is not gated by ` +
        'HOSTED_BLOCKED_TOOL_NAMES; nothing may bypass the approval/undo gate.'
    );
  }
}

/**
 * The self-sufficient payload persisted on a title ActionRecord's `result`.
 * `recordEffects` replay to the title records; `titleNodeSnapshots` reconstruct
 * the math node set. Both are stored in full (not just affected ids) — this is
 * the "full-effect persistence" the cutover needs.
 */
export const TitleActionResultSchema = z
  .object({
    commandId: z.string(),
    surface: z.literal('title_tree'),
    origin: z.enum(['user', 'ai', 'import', 'system']),
    mutation: TitleMutationSchema,
    summary: z.string(),
    recordEffects: z.array(RecordEffectSchema),
    titleNodeSnapshots: z
      .object({
        upserted: z.array(z.unknown()),
        deletedNodeIds: z.array(z.string()),
      })
      .strict(),
    affectedRecordIds: z.array(z.string()),
    tombstonedRecordIds: z.array(z.string()),
    sourceCitationIds: z.array(z.string()),
    aiToolName: z.string().optional(),
    mutationBoundary: z.literal(SHADOW_MUTATION_BOUNDARY),
    wouldMutateLiveStores: z.literal(false),
    wouldWriteLandroidV8: z.literal(false),
  })
  .strict();
export type TitleActionResult = z.infer<typeof TitleActionResultSchema>;

/**
 * Monotonic fallback counter for the convenience `commandId` default. Production
 * callers SHOULD pass an explicit stable `commandId` (e.g. the store operation
 * id); the default only guarantees that two mutations with the same effect set —
 * or two no-ops — never collide into the same ActionRecord id within a process.
 */
let titleCommandSeq = 0;

/** Build the typed command for a title mutation from its record-level effects. */
export function buildTitleCommand(input: {
  mutation: TitleMutation;
  origin: ActionCommand['origin'];
  effects: RecordEffect[];
  commandId?: string;
  summary?: string;
  sourceCitationIds?: string[];
}): ActionCommand {
  return parseActionCommand({
    commandId:
      input.commandId ??
      `title:${input.mutation}:${(titleCommandSeq += 1)}:${stableEffectsKey(input.effects)}`,
    commandKind: COMMAND_KIND_BY_TITLE_MUTATION[input.mutation],
    surface: 'title_tree',
    origin: input.origin,
    summary:
      input.summary ??
      `${input.mutation}: ${input.effects.length} title record effect(s)`,
    recordEffects: input.effects,
    sourceCitationIds: input.sourceCitationIds ?? [],
  });
}

function stableEffectsKey(effects: readonly RecordEffect[]): string {
  const ids = effects.map((effect) =>
    effect.op === 'upsert' ? effect.record.recordId : effect.recordId
  );
  return ids.sort().join('|').slice(0, 60) || 'noop';
}

export interface TitleMaterialization {
  actionRecord: ActionRecord;
  auditEvent: AuditEventRecord;
  /** Head hash of the produced audit event (thread the next mutation off this). */
  auditHeadHash: string;
}

/**
 * Materialize one durable title ActionRecord (with full-effect result) plus a
 * hash-chained audit event that extends the chain from `priorHeadHash`.
 */
export async function materializeTitleCommand(input: {
  command: ActionCommand;
  delta: TitleMutationDelta;
  context: RecordBuildContext;
  mutation: TitleMutation;
  approvedBy: ActionRecord['approvedBy'];
  appliedAt: string;
  aiToolName?: string;
  priorHeadHash?: string;
}): Promise<TitleMaterialization> {
  const { command, delta } = input;
  const result: TitleActionResult = {
    commandId: command.commandId,
    surface: 'title_tree',
    origin: command.origin,
    mutation: input.mutation,
    summary: command.summary,
    recordEffects: command.recordEffects,
    titleNodeSnapshots: {
      upserted: delta.upsertedNodes,
      deletedNodeIds: delta.deletedNodeIds,
    },
    affectedRecordIds: delta.affectedRecordIds,
    tombstonedRecordIds: delta.tombstonedRecordIds,
    sourceCitationIds: command.sourceCitationIds,
    aiToolName: input.aiToolName,
    mutationBoundary: SHADOW_MUTATION_BOUNDARY,
    wouldMutateLiveStores: false,
    wouldWriteLandroidV8: false,
  };

  const actionRecordId = stableRecordId(
    input.context.workspaceId,
    'action-record',
    command.commandId
  );
  const actionRecord = ActionRecordSchema.parse({
    ...baseRecordEnvelope('action_record', actionRecordId, input.context),
    actionKind: command.commandKind,
    status: 'applied',
    approvedBy: input.approvedBy,
    appliedAt: input.appliedAt,
    result: TitleActionResultSchema.parse(result),
  });

  const [auditEvent] = await buildAuditChain({
    context: input.context,
    priorHeadHash: input.priorHeadHash,
    drafts: [
      {
        recordId: stableRecordId(
          input.context.workspaceId,
          'audit-event',
          actionRecord.recordId
        ),
        eventKind: 'action_record.applied',
        actorKind: command.origin,
        actorId: input.aiToolName,
        subjectRecordIds: [
          actionRecord.recordId,
          ...delta.affectedRecordIds,
          ...delta.tombstonedRecordIds,
        ],
        occurredAt: input.appliedAt,
        details: {
          commandId: command.commandId,
          commandKind: command.commandKind,
          mutation: input.mutation,
          surface: 'title_tree',
          summary: command.summary,
        },
      },
    ],
  });

  return {
    actionRecord,
    auditEvent,
    auditHeadHash: auditEvent?.eventHash ?? input.priorHeadHash ?? AUDIT_GENESIS_HASH,
  };
}

/**
 * Inline parity for a single title mutation. Two independent checks, BOTH of
 * which must pass or the recording throws (guardrail 3):
 *
 *  1. Delta reproduces `after`: replaying `before` + this command yields exactly
 *     the after title projection. A corrupted/incorrect effect fails here — this
 *     is what BLOCKS a bad mutation rather than shadowing it.
 *  2. Round-trip: the after title projection round-trips through encode→reduce
 *     with no loss (the standing parity invariant for the surface).
 */
export function assertTitleInlineParity(input: {
  beforeRecords: readonly BackendSpineCoreRecord[];
  afterRecords: readonly BackendSpineCoreRecord[];
  command: ActionCommand;
}): ParityReport[] {
  const beforeCommands = encodeSurfaceRecordsAsCommandLog(
    'title_tree',
    input.beforeRecords
  );
  const derivedAfter = reduceCommandLog([...beforeCommands, input.command]).records.filter(
    isTitleRecord
  );
  const deltaDivergences = diffRecordSets(input.afterRecords, derivedAfter);
  const deltaReport: ParityReport = {
    workflow: 'title_tree',
    clean: deltaDivergences.length === 0,
    expectedCount: input.afterRecords.length,
    derivedCount: derivedAfter.length,
    divergences: deltaDivergences,
  };

  const roundTripReport = runSurfaceParity({
    surface: 'title_tree',
    currentStoreRecords: input.afterRecords,
  });

  const reports = [deltaReport, roundTripReport];
  assertParityClean(reports); // throws ParityDivergenceError on any divergence
  return reports;
}

export interface TitleMutationRecordResult {
  command: ActionCommand;
  actionRecord: ActionRecord;
  auditEvent: AuditEventRecord;
  auditHeadHash: string;
  delta: TitleMutationDelta;
  beforeRecords: BackendSpineCoreRecord[];
  afterRecords: BackendSpineCoreRecord[];
  parityReports: ParityReport[];
}

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

/**
 * Record one title mutation: build the command + durable records and prove
 * parity inline. Pure over the before/after workspace snapshots — it does not
 * touch the live store (the caller has already performed the mutation).
 */
export async function recordTitleMutation(input: {
  mutation: TitleMutation;
  origin: ActionCommand['origin'];
  approvedBy: ActionRecord['approvedBy'];
  context: RecordBuildContext;
  appliedAt: string;
  beforeWorkspace: WorkspaceData;
  afterWorkspace: WorkspaceData;
  ownerData?: OwnerSlice;
  documentData?: DocumentWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  aiToolName?: string;
  sourceCitationIds?: string[];
  commandId?: string;
  priorHeadHash?: string;
}): Promise<TitleMutationRecordResult> {
  assertTitleCommandRoutesThroughGate(input.mutation, input.origin, input.aiToolName);

  const adapterBase = {
    ownerData: input.ownerData,
    documentData: input.documentData,
    curativeData: input.curativeData,
    projectId: input.context.projectId,
    generatedAt: input.context.generatedAt,
  };
  const beforeRecords = titleRecordsFromWorkspace({
    workspace: input.beforeWorkspace,
    ...adapterBase,
  });
  const afterRecords = titleRecordsFromWorkspace({
    workspace: input.afterWorkspace,
    ...adapterBase,
  });

  const delta = diffTitleMutation({
    beforeRecords,
    afterRecords,
    beforeNodes: input.beforeWorkspace.nodes,
    afterNodes: input.afterWorkspace.nodes,
  });

  const command = buildTitleCommand({
    mutation: input.mutation,
    origin: input.origin,
    effects: delta.effects,
    commandId: input.commandId,
    sourceCitationIds: input.sourceCitationIds,
  });

  const parityReports = assertTitleInlineParity({
    beforeRecords,
    afterRecords,
    command,
  });

  const materialized = await materializeTitleCommand({
    command,
    delta,
    context: input.context,
    mutation: input.mutation,
    approvedBy: input.approvedBy,
    appliedAt: input.appliedAt,
    aiToolName: input.aiToolName,
    priorHeadHash: input.priorHeadHash,
  });

  return {
    command,
    actionRecord: materialized.actionRecord,
    auditEvent: materialized.auditEvent,
    auditHeadHash: materialized.auditHeadHash,
    delta,
    beforeRecords,
    afterRecords,
    parityReports,
  };
}

export type ApplyTitleMutationOutcome =
  | { ok: true; record: TitleMutationRecordResult }
  | { ok: false; reason: 'mutation_rejected' };

/**
 * The "entry point around the 7 title mutations." Snapshots the live workspace,
 * performs the mutation through the caller-supplied thunk (the real store stays
 * canonical), re-snapshots, and records the command + durable records with inline
 * parity. If the store rejects the mutation (`runMutation` returns false), no
 * command is recorded.
 */
export async function applyTitleMutation(input: {
  mutation: TitleMutation;
  origin: ActionCommand['origin'];
  approvedBy: ActionRecord['approvedBy'];
  context: RecordBuildContext;
  appliedAt: string;
  readWorkspace: () => WorkspaceData;
  runMutation: () => boolean;
  ownerData?: OwnerSlice;
  documentData?: DocumentWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  aiToolName?: string;
  sourceCitationIds?: string[];
  commandId?: string;
  priorHeadHash?: string;
}): Promise<ApplyTitleMutationOutcome> {
  // Validate the gate before mutating anything.
  assertTitleCommandRoutesThroughGate(input.mutation, input.origin, input.aiToolName);

  const beforeWorkspace = cloneWorkspace(input.readWorkspace());
  const ok = input.runMutation();
  if (!ok) return { ok: false, reason: 'mutation_rejected' };
  const afterWorkspace = cloneWorkspace(input.readWorkspace());

  const record = await recordTitleMutation({
    mutation: input.mutation,
    origin: input.origin,
    approvedBy: input.approvedBy,
    context: input.context,
    appliedAt: input.appliedAt,
    beforeWorkspace,
    afterWorkspace,
    ownerData: input.ownerData,
    documentData: input.documentData,
    curativeData: input.curativeData,
    aiToolName: input.aiToolName,
    sourceCitationIds: input.sourceCitationIds,
    commandId: input.commandId,
    priorHeadHash: input.priorHeadHash,
  });
  return { ok: true, record };
}

/** Shallow-immutable snapshot of the workspace fields the adapter reads. */
function cloneWorkspace(workspace: WorkspaceData): WorkspaceData {
  return {
    ...workspace,
    nodes: workspace.nodes.map((node) => ({ ...node })) as OwnershipNode[],
    deskMaps: workspace.deskMaps.map((deskMap) => ({
      ...deskMap,
      nodeIds: [...deskMap.nodeIds],
    })),
  };
}
