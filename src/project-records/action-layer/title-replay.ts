/**
 * Phase 4 title cutover — replay from durable records (SHADOW).
 *
 * Proves the durable log is self-sufficient: given only the persisted title
 * ActionRecords (each carrying full record effects + node snapshots in its
 * `result`), we can reconstruct
 *   - the title record projection (`replayTitleProjection`) — must equal the
 *     adapter output, and
 *   - the math node set (`reconstructTitleNodes`) — feeds MathInputView parity.
 *
 * Nothing here reads the live store; that is the whole point — a reload after
 * cutover would replay from these records alone.
 */
import type {
  ActionRecord,
  BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import type { OwnershipNode } from '../../types/node';
import { normalizeOwnershipNode } from '../../types/node';
import {
  parseActionCommand,
  type ActionCommand,
  type ActionCommandKind,
} from './commands';
import { reduceCommandLog } from './reducer';
import { TitleActionResultSchema, type TitleActionResult } from './title-command-sourcing';
import { isTitleRecord } from './title-projection';

/** A durable title ActionRecord paired with its parsed, validated result. */
interface ParsedTitleAction {
  actionRecord: ActionRecord;
  result: TitleActionResult;
}

function isTitleActionKind(actionKind: string): actionKind is ActionCommandKind {
  return actionKind.startsWith('title.');
}

/**
 * Pull the title ActionRecords (in input order, which is application order) and
 * validate each one's full-effect result. Non-title action records (imports,
 * other surfaces) and `undone` records are skipped.
 */
export function parseTitleActions(
  records: readonly BackendSpineCoreRecord[]
): ParsedTitleAction[] {
  const parsed: ParsedTitleAction[] = [];
  for (const record of records) {
    if (record.recordType !== 'action_record') continue;
    if (record.status === 'undone') continue;
    if (!isTitleActionKind(record.actionKind)) continue;
    const result = TitleActionResultSchema.safeParse(record.result);
    if (!result.success) continue;
    parsed.push({ actionRecord: record, result: result.data });
  }
  return parsed;
}

/** Reconstruct the typed command from a durable title ActionRecord's result. */
function commandFromResult(parsed: ParsedTitleAction): ActionCommand {
  return parseActionCommand({
    commandId: parsed.result.commandId,
    commandKind: parsed.actionRecord.actionKind,
    surface: 'title_tree',
    origin: parsed.result.origin,
    summary: parsed.result.summary,
    recordEffects: parsed.result.recordEffects,
    sourceCitationIds: parsed.result.sourceCitationIds,
  });
}

/**
 * Replay persisted title ActionRecords into the title record projection
 * (instrument_record + interest_reference). Equality with the adapter output is
 * the self-sufficiency proof (see the replay test).
 */
export function replayTitleProjection(
  records: readonly BackendSpineCoreRecord[]
): BackendSpineCoreRecord[] {
  const commands = parseTitleActions(records).map(commandFromResult);
  return reduceCommandLog(commands).records.filter(isTitleRecord);
}

/**
 * Reconstruct the math node set by folding the persisted node snapshots: an
 * upserted node wins by id; a deleted node id tombstones it. Returned in
 * first-seen order; callers that compare against a live set should reorder to the
 * live node order (see `orderNodesLike`).
 */
export function reconstructTitleNodes(
  records: readonly BackendSpineCoreRecord[]
): OwnershipNode[] {
  const byId = new Map<string, OwnershipNode>();
  for (const { result } of parseTitleActions(records)) {
    for (const raw of result.titleNodeSnapshots.upserted) {
      const node = normalizeOwnershipNode(raw as Parameters<typeof normalizeOwnershipNode>[0]);
      byId.set(node.id, node);
    }
    for (const deletedId of result.titleNodeSnapshots.deletedNodeIds) {
      byId.delete(deletedId);
    }
  }
  return [...byId.values()];
}

/**
 * Order reconstructed nodes to match a reference id order (the live store's node
 * order), so a math-parity comparison reflects field fidelity, not incidental
 * reconstruction order. Nodes not present in the reference are appended in their
 * reconstructed order.
 */
export function orderNodesLike(
  nodes: readonly OwnershipNode[],
  referenceIds: readonly string[]
): OwnershipNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered: OwnershipNode[] = [];
  const used = new Set<string>();
  for (const id of referenceIds) {
    const node = byId.get(id);
    if (node && !used.has(id)) {
      ordered.push(node);
      used.add(id);
    }
  }
  for (const node of nodes) {
    if (!used.has(node.id)) ordered.push(node);
  }
  return ordered;
}
