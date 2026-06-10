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
  titleLedgerGeneration,
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
 * Mark every still-active title action at ledger position >= `startIndex` as
 * undone. The chain is append-only and the snapshot records its post-settle
 * length, so positions — not recording timestamps, which lag the mutations —
 * identify exactly the turn's records. Append-only on the audit chain; the
 * action record list keeps one row per action (the undone copy replaces the
 * original in place) so replay and the ledger verifier stay consistent. The
 * `title.baseline` record is never undone — it carries the pre-existing state
 * the restore returns to.
 *
 * Bails without touching state (returns 0, records stay `applied`) when the
 * ledger was replaced (generation bump) or advanced (head moved) while the
 * undo events were being built — skipping the marking is safe; forking the
 * hash chain would permanently break ledger persistence.
 */
export async function appendTitleUndoRecordsFromIndex(
  startIndex: number,
  reason: string
): Promise<number> {
  await settleTitleActionLog();
  const generationAtStart = titleLedgerGeneration();
  const state = useTitleActionLog.getState();
  const targets = state.actionRecords
    .slice(Math.max(0, startIndex))
    .filter(
      (record) =>
        record.status !== 'undone'
        && record.actionKind.startsWith('title.')
        && record.actionKind !== 'title.baseline'
    );
  if (targets.length === 0 || !state.headHash) return 0;
  const expectedHead = state.headHash;

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
  let previousHash = expectedHead;
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

  if (generationAtStart !== titleLedgerGeneration()) {
    console.warn(
      '[ai-undo] ledger was replaced while building undo events; marking skipped.'
    );
    return 0;
  }
  let applied = 0;
  useTitleActionLog.setState((current) => {
    // Atomic with the update: a recording that landed mid-build would share
    // expectedHead with our first undo event — refuse the fork.
    if (current.headHash !== expectedHead) return {};
    applied = targets.length;
    return {
      actionRecords: current.actionRecords.map(
        (record) => replacements.get(record.recordId) ?? record
      ),
      auditEvents: [...current.auditEvents, ...newEvents],
      headHash: previousHash,
    };
  });
  if (applied === 0) {
    console.warn(
      '[ai-undo] ledger advanced while building undo events; marking skipped (records remain applied).'
    );
  }
  return applied;
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

  const undone = await appendTitleUndoRecordsFromIndex(
    snapshot.titleLedgerLength,
    `AI undo: ${snapshot.label}`
  );
  if (undone > 0) {
    await flushTitleActionLogToStorage(snapshot.workspaceId).catch((err) => {
      console.warn('[ai-undo] post-undo ledger flush failed:', err);
    });
  }
}
