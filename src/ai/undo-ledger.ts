/**
 * DA-H2 — ledger-aware AI undo.
 *
 * `restoreSnapshot` alone destroys the durable title ledger: `loadWorkspace`
 * resets the in-memory chain and the next autosave persists the emptied state.
 * This module wraps the restore with the ledger lifecycle the undo boundary
 * documents (undo-boundary.ts): flush the in-flight chain first (so the AI
 * turn's provenance is durable), restore the stores, re-hydrate the persisted
 * chain, then mark the turn's records undone — appending one
 * `action_record.undone` audit event per record and replacing the record with
 * its `undone` copy in place (same recordId, revision+1), never rewriting
 * prior audit history. Replay then skips the undone records, so the ledger
 * projection matches the restored workspace.
 *
 * Kept separate from both stores on purpose: title-undo's import chain reaches
 * back into undo-store, so wiring this through title-action-log would create
 * a load-order-sensitive module cycle.
 */
import type { ActionRecord, AuditEventRecord } from '../backend-spine/contracts';
import { undoTitleActionRecord } from '../project-records/action-layer/title-undo';
import {
  flushTitleActionLogToStorage,
  hydrateTitleActionLogFromStorageOrBaseline,
  settleTitleActionLog,
  useTitleActionLog,
} from '../store/title-action-log';
import { readCurrentWorkspaceData } from '../store/workspace-store';
import { useOwnerStore } from '../store/owner-store';
import { restoreSnapshot, type UndoSnapshot } from './undo-store';

function readOwnerSlice() {
  const owner = useOwnerStore.getState();
  return { owners: owner.owners, leases: owner.leases };
}

/**
 * Mark every still-active title action recorded at/after `sinceEpochMs` as
 * undone. Append-only on the audit chain; the action record list keeps one row
 * per action (the undone copy replaces the original in place) so replay and
 * the ledger verifier stay consistent. The `title.baseline` record is never
 * undone — it carries the pre-existing state the restore returns to.
 * Returns the number of records marked.
 */
export async function appendTitleUndoRecordsSince(
  sinceEpochMs: number,
  reason: string
): Promise<number> {
  await settleTitleActionLog();
  const state = useTitleActionLog.getState();
  const targets = state.actionRecords.filter(
    (record) =>
      record.status !== 'undone'
      && record.actionKind.startsWith('title.')
      && record.actionKind !== 'title.baseline'
      && Date.parse(record.lastModified) >= sinceEpochMs
  );
  if (targets.length === 0 || !state.headHash) return 0;

  const occurredAt = new Date().toISOString();
  const workspaceId = targets[0].workspaceId;
  const context = {
    workspaceId,
    projectId: workspaceId,
    generatedAt: occurredAt,
    revision: 0,
    source: 'local' as const,
    syncState: 'local_only' as const,
  };

  const replacements = new Map<string, ActionRecord>();
  const newEvents: AuditEventRecord[] = [];
  let previousHash = state.headHash;
  for (const target of targets) {
    const result = await undoTitleActionRecord({
      context,
      actionRecord: target,
      previousHash,
      occurredAt,
      actorKind: 'user',
      reason,
    });
    replacements.set(target.recordId, result.undoneActionRecord);
    newEvents.push(result.auditEvent);
    previousHash = result.auditEvent.eventHash!;
  }

  useTitleActionLog.setState((current) => ({
    actionRecords: current.actionRecords.map(
      (record) => replacements.get(record.recordId) ?? record
    ),
    auditEvents: [...current.auditEvents, ...newEvents],
    headHash: previousHash,
  }));
  return targets.length;
}

/**
 * Restore the AI undo snapshot AND keep the durable title ledger intact:
 * hydrate-then-append instead of reset-and-erase (DA-H2).
 */
export async function restoreSnapshotWithLedger(snapshot: UndoSnapshot): Promise<void> {
  // Persist the in-memory chain before loadWorkspace resets it, so the AI
  // turn's records are durable and can be marked undone below. Best effort:
  // an unflushable chain must not block the user's escape hatch.
  await flushTitleActionLogToStorage(snapshot.workspaceId).catch((err) => {
    console.warn('[ai-undo] pre-undo ledger flush failed:', err);
  });

  await restoreSnapshot(snapshot);

  const hydration = await hydrateTitleActionLogFromStorageOrBaseline(
    readCurrentWorkspaceData(),
    readOwnerSlice()
  );
  // A baseline source means there was no persisted chain (fresh workspace);
  // nothing to mark undone — pre-DA-H2 behavior stands.
  if (hydration.source !== 'storage') return;

  const undone = await appendTitleUndoRecordsSince(
    snapshot.capturedAt,
    `AI undo: ${snapshot.label}`
  );
  if (undone > 0) {
    await flushTitleActionLogToStorage(snapshot.workspaceId).catch((err) => {
      console.warn('[ai-undo] post-undo ledger flush failed:', err);
    });
  }
}
