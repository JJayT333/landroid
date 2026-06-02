/**
 * Phase 4 — the canonical-mutation primitive (SHADOW).
 *
 * `reduceCommandLog` folds an ordered list of typed commands into a record
 * projection by applying each command's record effects in sequence. This is the
 * pure function a workflow would eventually be driven by AFTER a reviewer
 * approves cutover; in this phase it only ever produces an action-derived
 * projection that the parity harness compares against current store output.
 *
 * Determinism: the output `records` array is sorted by `recordId` so two logs
 * with the same net effect compare equal regardless of emission order.
 */
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import type { ActionCommand } from './commands';

export interface ReducedRecordState {
  /** Surviving records, sorted by recordId (deterministic). */
  records: BackendSpineCoreRecord[];
  /** Live record lookup by recordId. */
  recordsById: Map<string, BackendSpineCoreRecord>;
  /** Record ids deleted by a `delete` effect and not re-upserted. */
  tombstonedIds: string[];
  /** Command ids folded, in application order. */
  appliedCommandIds: string[];
}

function byRecordId(a: BackendSpineCoreRecord, b: BackendSpineCoreRecord): number {
  return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0;
}

export function reduceCommandLog(
  commands: readonly ActionCommand[]
): ReducedRecordState {
  const recordsById = new Map<string, BackendSpineCoreRecord>();
  const tombstones = new Set<string>();
  const appliedCommandIds: string[] = [];

  for (const command of commands) {
    for (const effect of command.recordEffects) {
      if (effect.op === 'upsert') {
        recordsById.set(effect.record.recordId, effect.record);
        tombstones.delete(effect.record.recordId);
      } else {
        recordsById.delete(effect.recordId);
        tombstones.add(effect.recordId);
      }
    }
    appliedCommandIds.push(command.commandId);
  }

  return {
    records: [...recordsById.values()].sort(byRecordId),
    recordsById,
    tombstonedIds: [...tombstones].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    appliedCommandIds,
  };
}
