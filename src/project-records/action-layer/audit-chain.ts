/**
 * Phase 4 — append-only AuditEvent hash chain (SHADOW).
 *
 * Each AuditEvent references the prior event's hash. An event's `eventHash`
 * covers its entire body (including `previousHash`), so the chain is
 * tamper-evident: editing any field, reordering events, or dropping an event
 * breaks verification and cannot be silently repaired without recomputing every
 * downstream event.
 *
 *   eventHash_i  = sha256(canonicalJson(event_i without eventHash))
 *   previousHash_i = eventHash_{i-1}   (AUDIT_GENESIS_HASH for the first event)
 *
 * The chain is persisted additively as `audit_event` records in the record
 * layer; it never edits or deletes prior events (append-only).
 */
import {
  AuditEventRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import {
  baseRecordEnvelope,
  sha256HexOfText,
  type RecordBuildContext,
} from '../record-helpers';
import { canonicalJson } from './canonical-json';

/** sha256('landroid/action-layer/audit-genesis/v1') — the chain's anchor. */
export const AUDIT_GENESIS_HASH =
  '7d9949093210eaa6b0bc91c81ac81f28b4724c4cd1236d6c7034d5da3e96c01e';

const AUDIT_GENESIS_PREIMAGE = 'landroid/action-layer/audit-genesis/v1';

/** Re-derive the genesis hash (a guard test asserts it equals the constant). */
export async function computeAuditGenesisHash(): Promise<string> {
  return sha256HexOfText(AUDIT_GENESIS_PREIMAGE);
}

export interface AuditEventDraft {
  recordId: string;
  eventKind: string;
  actorKind: AuditEventRecord['actorKind'];
  actorId?: string;
  subjectRecordIds?: string[];
  occurredAt: string;
  details?: Record<string, unknown>;
}

/** The body that the event hash is computed over — everything but `eventHash`. */
function auditHashBody(event: AuditEventRecord): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...event };
  delete clone.eventHash;
  return clone;
}

export async function computeAuditEventHash(
  event: AuditEventRecord
): Promise<string> {
  return sha256HexOfText(canonicalJson(auditHashBody(event)));
}

/**
 * Build one audit event, threading `previousHash` and computing `eventHash`.
 * The returned record is schema-valid and ready to persist.
 */
export async function appendAuditEvent(input: {
  context: RecordBuildContext;
  draft: AuditEventDraft;
  previousHash: string;
}): Promise<AuditEventRecord> {
  const unsigned = AuditEventRecordSchema.parse({
    ...baseRecordEnvelope('audit_event', input.draft.recordId, input.context),
    eventKind: input.draft.eventKind,
    actorKind: input.draft.actorKind,
    actorId: input.draft.actorId,
    subjectRecordIds: input.draft.subjectRecordIds ?? [],
    occurredAt: input.draft.occurredAt,
    previousHash: input.previousHash,
    details: input.draft.details ?? {},
  });
  const eventHash = await computeAuditEventHash(unsigned);
  return AuditEventRecordSchema.parse({ ...unsigned, eventHash });
}

/** The head hash to thread the next event off (genesis if the chain is empty). */
export function auditChainHead(
  events: readonly AuditEventRecord[],
  genesisHash: string = AUDIT_GENESIS_HASH
): string {
  const last = events[events.length - 1];
  return last?.eventHash ?? genesisHash;
}

/**
 * Build a contiguous chain from drafts. Pass `priorHeadHash` to continue an
 * existing persisted chain (append-only); omit it to start from genesis.
 */
export async function buildAuditChain(input: {
  context: RecordBuildContext;
  drafts: readonly AuditEventDraft[];
  genesisHash?: string;
  priorHeadHash?: string;
}): Promise<AuditEventRecord[]> {
  const genesis = input.genesisHash ?? AUDIT_GENESIS_HASH;
  let previousHash = input.priorHeadHash ?? genesis;
  const events: AuditEventRecord[] = [];
  for (const draft of input.drafts) {
    const event = await appendAuditEvent({
      context: input.context,
      draft,
      previousHash,
    });
    events.push(event);
    previousHash = event.eventHash!;
  }
  return events;
}

export interface AuditChainVerification {
  valid: boolean;
  length: number;
  /** Index of the first broken event, or null when the chain is intact. */
  brokenAtIndex: number | null;
  reason: string | null;
  /** Head hash to continue from when valid. */
  headHash: string | null;
}

/**
 * Verify linkage and per-event integrity. Detects edits (recomputed hash
 * mismatch), reordering and drops (previousHash linkage mismatch, including a
 * dropped first event whose successor no longer points at genesis), and forged
 * hashes.
 */
export async function verifyAuditChain(
  events: readonly AuditEventRecord[],
  options: { genesisHash?: string; priorHeadHash?: string } = {}
): Promise<AuditChainVerification> {
  const genesis = options.genesisHash ?? AUDIT_GENESIS_HASH;
  let expectedPrev = options.priorHeadHash ?? genesis;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const broken = (reason: string): AuditChainVerification => ({
      valid: false,
      length: events.length,
      brokenAtIndex: index,
      reason,
      headHash: null,
    });

    if (!event.eventHash) return broken('event is missing eventHash');
    if (event.previousHash !== expectedPrev) {
      return broken('previousHash does not chain to the prior event');
    }
    const recomputed = await computeAuditEventHash(event);
    if (recomputed !== event.eventHash) {
      return broken('eventHash does not match recomputed hash (event body was altered)');
    }
    expectedPrev = event.eventHash;
  }

  return {
    valid: true,
    length: events.length,
    brokenAtIndex: null,
    reason: null,
    headHash: events.length > 0 ? expectedPrev : (options.priorHeadHash ?? genesis),
  };
}

/**
 * DA-H5: the hash chain above covers each AuditEvent *body*, but replay consumes
 * the referenced ActionRecord's `result` payload, which the event only points at
 * by id. So an edit to `result.recordEffects` (in Dexie, or in a `.landroid`
 * `actionLedger` before import) passes `verifyAuditChain` untouched.
 *
 * The fix commits `actionHash = sha256(canonicalJson(actionRecord.result))` into
 * each `action_record.applied` event's `details` at materialization. The hash
 * covers the `result` payload specifically — `recordEffects` (what replay
 * applies) and `titleNodeSnapshots` (the math node set), i.e. exactly the data a
 * tamper would target — and deliberately NOT the lifecycle envelope (`status`,
 * `revision`, `lastModified`), which the DA-H2 undo legitimately rewrites in
 * place when it marks a record `undone`. Because the event hash covers
 * `details`, the payload becomes transitively bound to the chain: tampering with
 * the result breaks this comparison; stripping the committed `actionHash` to
 * forge a "legacy" event breaks the event hash. So a genuinely legacy (pre-DA-H5)
 * event — one with no committed hash whose own `eventHash` is still valid — is
 * the only authentic unhashed case, accepted with a count the caller surfaces as
 * a one-time warning.
 */
export async function computeActionRecordHash(record: ActionRecord): Promise<string> {
  return sha256HexOfText(canonicalJson(record.result));
}

export interface ActionPayloadVerification {
  valid: boolean;
  /** recordId of the first action whose payload hash mismatched, or null. */
  brokenRecordId: string | null;
  reason: string | null;
  /** Count of applied events carrying no committed actionHash (legacy chains). */
  legacyCount: number;
}

/**
 * Verify that each ActionRecord still matches what the (already chain-verified)
 * audit events committed about it. Run AFTER `verifyAuditChain` confirms the
 * event bodies are intact — only then are the committed values trustworthy.
 * `subjectRecordIds[0]` is the action record's id by construction (see
 * `recordTitleMutation` and `undoActionRecord`). Three bindings, because replay
 * consumes BOTH the `result` payload AND two envelope fields the result hash
 * deliberately excludes (so undo can rewrite them in place):
 *
 *  1. `result` payload  — recompute `actionHash` and compare (the recordEffects /
 *     titleNodeSnapshots replay applies).
 *  2. `actionKind`      — must equal the `commandKind` committed in the paired
 *     applied event's `details` (replay feeds `actionKind` as the command kind,
 *     `title-replay.ts`). Catches a relabel that the result hash misses.
 *  3. `status`          — a record is `'undone'` IFF an `action_record.undone`
 *     event reverts it. Replay drops `undone` records, so a bare `applied`↔`undone`
 *     flip (no matching undo event) would silently drop or re-introduce a title
 *     mutation; the result hash misses it because `result` is untouched.
 *
 * (1) and (2) are all-or-nothing across the chain: a fully-unhashed chain is
 * accepted as genuinely legacy (pre-DA-H5) and counted; but once ANY applied
 * event commits the binding, every applied event must carry it, so a single
 * stripped-and-re-signed event (notably the head) is rejected rather than waved
 * through as "legacy". (3) uses fields present on every chain, so it hardens
 * legacy chains too.
 */
export async function verifyActionPayloadHashes(
  actionRecords: readonly ActionRecord[],
  auditEvents: readonly AuditEventRecord[]
): Promise<ActionPayloadVerification> {
  const recordById = new Map(actionRecords.map((record) => [record.recordId, record]));
  // recordIds an `action_record.undone` event reverts — envelope-bound by the
  // event hash, so this set cannot be forged without breaking `verifyAuditChain`.
  const undoneByEvent = new Set<string>();
  for (const event of auditEvents) {
    if (event.eventKind !== 'action_record.undone') continue;
    const reverted =
      (event.details as { reverts?: unknown }).reverts ?? event.subjectRecordIds[0];
    if (typeof reverted === 'string') undoneByEvent.add(reverted);
  }

  // A genuine legacy (pre-DA-H5) chain commits NO `actionHash` / `commandKind` on
  // ANY applied event. A chain where SOME applied events carry the binding but
  // others do not is a strip-and-re-sign downgrade — forge one record's `result`,
  // drop that event's `actionHash` so it reads as "legacy", recompute only its
  // own `eventHash` (the head has no successor pinning it). So the binding is
  // all-or-nothing: once any applied event commits it, EVERY applied event must,
  // or verification fails. (Truncating a hashed chain back to fully-legacy is the
  // residual the deferred envelope head-hash pin, `lastFlushedHeadHash`, closes.)
  const appliedEvents = auditEvents.filter(
    (event) => event.eventKind === 'action_record.applied'
  );
  const chainCommitsHash = appliedEvents.some(
    (event) => typeof (event.details as { actionHash?: unknown }).actionHash === 'string'
  );
  const chainCommitsKind = appliedEvents.some(
    (event) => typeof (event.details as { commandKind?: unknown }).commandKind === 'string'
  );

  let legacyCount = 0;
  for (const event of appliedEvents) {
    const actionRecordId = event.subjectRecordIds[0];
    const record = actionRecordId ? recordById.get(actionRecordId) : undefined;
    if (!record) {
      return {
        valid: false,
        brokenRecordId: actionRecordId ?? null,
        reason: 'applied audit event references a missing action record',
        legacyCount,
      };
    }
    // (2) actionKind binding — the field replay feeds as the command kind.
    const committedKind = (event.details as { commandKind?: unknown }).commandKind;
    if (typeof committedKind === 'string') {
      if (record.actionKind !== committedKind) {
        return {
          valid: false,
          brokenRecordId: record.recordId,
          reason:
            `action record actionKind "${record.actionKind}" does not match the `
            + `commandKind "${committedKind}" committed in the audit chain`,
          legacyCount,
        };
      }
    } else if (chainCommitsKind) {
      return {
        valid: false,
        brokenRecordId: record.recordId,
        reason:
          'applied audit event is missing the commandKind binding present on other '
          + 'events in this chain (mixed-chain downgrade)',
        legacyCount,
      };
    }
    // (1) result payload binding.
    const committed = (event.details as { actionHash?: unknown }).actionHash;
    if (typeof committed === 'string') {
      const recomputed = await computeActionRecordHash(record);
      if (recomputed !== committed) {
        return {
          valid: false,
          brokenRecordId: record.recordId,
          reason:
            'action record payload does not match the hash committed in the audit '
            + 'chain (the payload was altered)',
          legacyCount,
        };
      }
    } else if (chainCommitsHash) {
      return {
        valid: false,
        brokenRecordId: record.recordId,
        reason:
          'applied audit event is missing the payload hash committed by other '
          + 'events in this chain (mixed-chain downgrade)',
        legacyCount,
      };
    } else {
      legacyCount += 1;
    }
  }

  // (3) status binding — undone IFF an undo event reverts it. Catches a bare
  // status flip (drop/un-drop forgery) the count check cannot see per-record.
  for (const record of actionRecords) {
    if ((record.status === 'undone') !== undoneByEvent.has(record.recordId)) {
      return {
        valid: false,
        brokenRecordId: record.recordId,
        reason:
          record.status === 'undone'
            ? 'action record is marked undone but no matching undo event backs it'
            : 'action record has a matching undo event but is not marked undone',
        legacyCount,
      };
    }
  }

  return { valid: true, brokenRecordId: null, reason: null, legacyCount };
}
