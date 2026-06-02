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
