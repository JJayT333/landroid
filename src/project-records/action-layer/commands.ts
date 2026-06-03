/**
 * Phase 4 — typed command catalog (SHADOW).
 *
 * A typed command is the unit of "meaningful change" routed through the action
 * layer. Commands describe record-level effects but do NOT mutate the live
 * Zustand stores: in this phase the stores stay canonical and a command's
 * effects are only ever folded by {@link reduceCommandLog} into an
 * action-derived projection that is COMPARED to current store output (parity).
 *
 * Every command carries an explicit `mutationBoundary` literal so the shadow
 * status is impossible to misread, and AI-proposal commands must name the gated
 * tool they originate from (see undo-boundary.ts — nothing bypasses the
 * existing approval/undo/hosted gate).
 */
import { z } from 'zod';
import {
  BackendSpineCoreRecordSchema,
  BackendSpineRecordTypeSchema,
  type BackendSpineRecordType,
} from '../../backend-spine/contracts';

const IdSchema = z.string().trim().min(1).max(160);
const NonEmptyTextSchema = z.string().trim().min(1);

/** The seven mutation surfaces Phase 4 routes through typed commands. */
export const ActionSurfaceSchema = z.enum([
  'title_tree',
  'document',
  'owner',
  'lease',
  'curative',
  'import',
  'ai_proposal',
]);
export type ActionSurface = z.infer<typeof ActionSurfaceSchema>;

export const ActionCommandKindSchema = z.enum([
  // title-tree / record mutations
  'title.create_root_node',
  'title.convey',
  'title.create_npri',
  'title.precede',
  'title.graft_to_parent',
  'title.delete_node',
  'title.attach_lease',
  'title.baseline',
  // generic title-node field edit (updateNode / rebalance / link clears /
  // lease-node resync) — not a structural tree op, but it changes a node's
  // projected records, so the ledger must capture it to stay a complete source.
  'title.update',
  // document links
  'document.link',
  'document.unlink',
  // owner edits
  'owner.create',
  'owner.update',
  // lease edits
  'lease.create',
  'lease.update',
  // curative edits
  'curative.create',
  'curative.update',
  'curative.resolve',
  // imports (durable form of an approved Phase 3 candidate)
  'import.apply_candidate',
  // AI proposals (an approved, gated AI tool call)
  'ai.proposal',
]);
export type ActionCommandKind = z.infer<typeof ActionCommandKindSchema>;

/** Which surface owns each command kind. */
export const SURFACE_BY_COMMAND_KIND: Record<ActionCommandKind, ActionSurface> = {
  'title.create_root_node': 'title_tree',
  'title.convey': 'title_tree',
  'title.create_npri': 'title_tree',
  'title.precede': 'title_tree',
  'title.graft_to_parent': 'title_tree',
  'title.delete_node': 'title_tree',
  'title.attach_lease': 'title_tree',
  'title.baseline': 'title_tree',
  'title.update': 'title_tree',
  'document.link': 'document',
  'document.unlink': 'document',
  'owner.create': 'owner',
  'owner.update': 'owner',
  'lease.create': 'lease',
  'lease.update': 'lease',
  'curative.create': 'curative',
  'curative.update': 'curative',
  'curative.resolve': 'curative',
  'import.apply_candidate': 'import',
  'ai.proposal': 'ai_proposal',
};

/**
 * The record types each surface owns. The parity harness compares only these
 * types per workflow; purely structural/derived records (project, manifest,
 * tract, desk_map, unit, extraction_run, packet*) are not a Phase 4 mutation
 * surface and are out of scope (see docs/phase-4-action-layer-notes.md).
 */
export const SURFACE_RECORD_TYPES: Record<ActionSurface, BackendSpineRecordType[]> = {
  title_tree: ['instrument_record', 'interest_reference'],
  document: ['document', 'document_version', 'vault_object', 'document_link'],
  owner: ['party', 'party_alias'],
  lease: ['lease', 'lease_obligation', 'obligation_event'],
  curative: ['curative_issue'],
  import: [
    'import_session',
    'action_plan',
    'source_attestation',
    'source_citation',
    'citation_anchor',
  ],
  ai_proposal: [],
};

const RECORD_TYPE_TO_SURFACE: Partial<Record<BackendSpineRecordType, ActionSurface>> = (() => {
  const map: Partial<Record<BackendSpineRecordType, ActionSurface>> = {};
  for (const [surface, recordTypes] of Object.entries(SURFACE_RECORD_TYPES) as Array<
    [ActionSurface, BackendSpineRecordType[]]
  >) {
    for (const recordType of recordTypes) map[recordType] = surface;
  }
  return map;
})();

/** The surface that owns a record type, or `null` if it is structural/out of scope. */
export function surfaceForRecordType(
  recordType: BackendSpineRecordType
): ActionSurface | null {
  return RECORD_TYPE_TO_SURFACE[recordType] ?? null;
}

/**
 * A single record-level effect. `upsert` carries a fully schema-valid record;
 * `delete` tombstones a record by id. The reducer folds these in order.
 */
export const RecordEffectSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('upsert'), record: BackendSpineCoreRecordSchema }).strict(),
  z
    .object({
      op: z.literal('delete'),
      recordType: BackendSpineRecordTypeSchema,
      recordId: IdSchema,
    })
    .strict(),
]);
export type RecordEffect = z.infer<typeof RecordEffectSchema>;

/** The shadow boundary literal stamped on every command in this phase. */
export const SHADOW_MUTATION_BOUNDARY = 'shadow_action_layer_no_live_store' as const;

export const ActionCommandSchema = z
  .object({
    commandId: IdSchema,
    commandKind: ActionCommandKindSchema,
    surface: ActionSurfaceSchema,
    origin: z.enum(['user', 'ai', 'import', 'system']),
    summary: NonEmptyTextSchema,
    recordEffects: z.array(RecordEffectSchema).default([]),
    /** ActionPlan this command was approved under (imports / AI proposals). */
    actionPlanId: IdSchema.optional(),
    /** Citations backing this change, when applicable. */
    sourceCitationIds: z.array(IdSchema).default([]),
    /** Required for `ai.proposal`: the gated AI tool this approval came from. */
    aiToolName: NonEmptyTextSchema.optional(),
    mutationBoundary: z.literal(SHADOW_MUTATION_BOUNDARY).default(SHADOW_MUTATION_BOUNDARY),
  })
  .strict();
export type ActionCommand = z.infer<typeof ActionCommandSchema>;

/**
 * Parse and validate a command, enforcing invariants the schema can't express:
 * surface/kind coherence, AI-proposal tool naming, and that every upserted
 * record's type belongs to the command's surface. Throws on violation (matches
 * the import-session module's invariant style).
 */
export function parseActionCommand(input: unknown): ActionCommand {
  const command = ActionCommandSchema.parse(input);
  const expectedSurface = SURFACE_BY_COMMAND_KIND[command.commandKind];
  if (command.surface !== expectedSurface) {
    throw new Error(
      `Command ${command.commandId} kind "${command.commandKind}" belongs to surface ` +
        `"${expectedSurface}", not "${command.surface}".`
    );
  }
  if (command.surface === 'ai_proposal' && !command.aiToolName) {
    throw new Error(
      `Command ${command.commandId} is an ai_proposal but names no gated aiToolName.`
    );
  }
  if (command.surface !== 'ai_proposal' && command.aiToolName) {
    throw new Error(
      `Command ${command.commandId} sets aiToolName but is not an ai_proposal command.`
    );
  }
  for (const effect of command.recordEffects) {
    const recordType =
      effect.op === 'upsert' ? effect.record.recordType : effect.recordType;
    // Imports and AI proposals legitimately produce records across surfaces
    // (e.g. an approved candidate writes an action_record + source_citation),
    // so only structural surfaces enforce strict ownership.
    if (command.surface === 'import' || command.surface === 'ai_proposal') continue;
    if (surfaceForRecordType(recordType) !== command.surface) {
      throw new Error(
        `Command ${command.commandId} (surface "${command.surface}") cannot carry a ` +
          `"${recordType}" record effect.`
      );
    }
  }
  return command;
}

export const ALL_ACTION_COMMAND_KINDS = ActionCommandKindSchema.options;
export const ALL_ACTION_SURFACES = ActionSurfaceSchema.options;
