import { describe, expect, it } from 'vitest';
import type { AuditEventRecord } from '../../backend-spine/contracts';
import {
  AUDIT_GENESIS_HASH,
  appendAuditEvent,
  auditChainHead,
  buildAuditChain,
  computeAuditEventHash,
  computeAuditGenesisHash,
  verifyAuditChain,
  type AuditEventDraft,
} from '../action-layer';
import type { RecordBuildContext } from '../record-helpers';
import { NOW } from './action-layer-fixtures';

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'system',
  syncState: 'local_only',
};

const drafts: AuditEventDraft[] = [
  {
    recordId: 'audit-1',
    eventKind: 'action_record.applied',
    actorKind: 'user',
    occurredAt: '2026-06-01T12:00:00.000Z',
    subjectRecordIds: ['action-record-1'],
    details: { commandKind: 'owner.create' },
  },
  {
    recordId: 'audit-2',
    eventKind: 'action_record.applied',
    actorKind: 'import',
    occurredAt: '2026-06-01T12:01:00.000Z',
    subjectRecordIds: ['action-record-2'],
    details: { commandKind: 'lease.create' },
  },
  {
    recordId: 'audit-3',
    eventKind: 'action_record.undone',
    actorKind: 'user',
    occurredAt: '2026-06-01T12:02:00.000Z',
    subjectRecordIds: ['action-record-1'],
    details: { commandKind: 'owner.create', reverts: 'action-record-1' },
  },
];

async function chain(): Promise<AuditEventRecord[]> {
  return buildAuditChain({ context, drafts });
}

describe('Phase 4 audit hash chain', () => {
  it('pins the genesis hash constant to its preimage', async () => {
    expect(await computeAuditGenesisHash()).toBe(AUDIT_GENESIS_HASH);
  });

  it('builds a verifiable chain anchored at genesis', async () => {
    const events = await chain();
    expect(events[0].previousHash).toBe(AUDIT_GENESIS_HASH);
    expect(events[1].previousHash).toBe(events[0].eventHash);
    expect(events[2].previousHash).toBe(events[1].eventHash);

    const result = await verifyAuditChain(events);
    expect(result).toMatchObject({ valid: true, brokenAtIndex: null });
    expect(result.headHash).toBe(events[2].eventHash);
    expect(auditChainHead(events)).toBe(events[2].eventHash);
  });

  it('detects an edited event body', async () => {
    const events = await chain();
    const tampered = [...events];
    // change a field but keep the old eventHash → recomputed hash will differ
    tampered[1] = { ...events[1], eventKind: 'tampered.kind' };

    const result = await verifyAuditChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toMatch(/recomputed hash/);
  });

  it('detects reordering', async () => {
    const events = await chain();
    const reordered = [events[0], events[2], events[1]];

    const result = await verifyAuditChain(reordered);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toMatch(/previousHash/);
  });

  it('detects a dropped middle event', async () => {
    const events = await chain();
    const result = await verifyAuditChain([events[0], events[2]]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toMatch(/previousHash/);
  });

  it('detects a dropped first event (successor no longer points at genesis)', async () => {
    const events = await chain();
    const result = await verifyAuditChain([events[1], events[2]]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(0);
    expect(result.reason).toMatch(/previousHash/);
  });

  it('detects a forged eventHash', async () => {
    const events = await chain();
    const forged = [...events];
    forged[1] = { ...events[1], eventHash: 'f'.repeat(64) };

    const result = await verifyAuditChain(forged);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
  });

  it('cannot re-sign one event without rewriting the rest of the chain', async () => {
    const events = await chain();
    // Tamper event[1] AND recompute its own hash so it is self-consistent.
    const tamperedEvent: AuditEventRecord = {
      ...events[1],
      details: { commandKind: 'lease.create', injected: true },
    };
    const reSignedHash = await computeAuditEventHash(tamperedEvent);
    const reSigned: AuditEventRecord[] = [
      events[0],
      { ...tamperedEvent, eventHash: reSignedHash },
      events[2],
    ];

    const result = await verifyAuditChain(reSigned);
    expect(result.valid).toBe(false);
    // event[1] now verifies on its own, but event[2] still links to the old hash.
    expect(result.brokenAtIndex).toBe(2);
    expect(result.reason).toMatch(/previousHash/);
  });

  it('supports append-only continuation from a prior head', async () => {
    const head = await buildAuditChain({ context, drafts: drafts.slice(0, 2) });
    const priorHeadHash = auditChainHead(head);
    const appended = await buildAuditChain({
      context,
      drafts: drafts.slice(2),
      priorHeadHash,
    });

    // The appended tail verifies against the prior head...
    expect(
      (await verifyAuditChain(appended, { priorHeadHash })).valid
    ).toBe(true);
    // ...and the full chain verifies end to end from genesis.
    expect((await verifyAuditChain([...head, ...appended])).valid).toBe(true);
    expect(appended[0].previousHash).toBe(priorHeadHash);
  });

  it('threads previousHash explicitly when appending a single event', async () => {
    const events = await chain();
    const next = await appendAuditEvent({
      context,
      previousHash: auditChainHead(events),
      draft: {
        recordId: 'audit-4',
        eventKind: 'parity.checked',
        actorKind: 'system',
        occurredAt: '2026-06-01T12:03:00.000Z',
      },
    });
    expect((await verifyAuditChain([...events, next])).valid).toBe(true);
  });
});
