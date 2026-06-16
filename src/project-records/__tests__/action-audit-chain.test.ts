import { describe, expect, it } from 'vitest';
import {
  ActionRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
} from '../../backend-spine/contracts';
import {
  AUDIT_GENESIS_HASH,
  appendAuditEvent,
  auditChainHead,
  buildAuditChain,
  computeActionRecordHash,
  computeAuditEventHash,
  computeAuditGenesisHash,
  verifyActionPayloadHashes,
  verifyAuditChain,
  type AuditEventDraft,
} from '../action-layer';
import type { RecordBuildContext } from '../record-helpers';
import { envelope, HASH, NOW } from './action-layer-fixtures';

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

function actionRecord(id: string, summary: string): ActionRecord {
  return ActionRecordSchema.parse({
    ...envelope('action_record', id),
    actionKind: 'title.convey',
    status: 'applied',
    approvedBy: 'user',
    appliedAt: NOW,
    result: { commandId: `cmd-${id}`, surface: 'title_tree', mutation: 'convey', summary },
  });
}

async function appliedEvent(
  recordId: string,
  actionRecordId: string,
  details: Record<string, unknown>
): Promise<AuditEventDraft> {
  return {
    recordId,
    eventKind: 'action_record.applied',
    actorKind: 'user',
    occurredAt: NOW,
    subjectRecordIds: [actionRecordId],
    details,
  };
}

describe('DA-H5 action payload hashing', () => {
  async function hashedRows(): Promise<{
    actionRecords: ActionRecord[];
    auditEvents: AuditEventRecord[];
  }> {
    const r1 = actionRecord('action-record-1', 'one');
    const r2 = actionRecord('action-record-2', 'two');
    const auditEvents = await buildAuditChain({
      context,
      drafts: [
        await appliedEvent('audit-1', r1.recordId, {
          commandKind: r1.actionKind,
          actionHash: await computeActionRecordHash(r1),
        }),
        await appliedEvent('audit-2', r2.recordId, {
          commandKind: r2.actionKind,
          actionHash: await computeActionRecordHash(r2),
        }),
      ],
    });
    return { actionRecords: [r1, r2], auditEvents };
  }

  // Append an `action_record.undone` event (as the DA-H2 undo write path does)
  // that reverts `recordId`, chained off the existing head.
  async function withUndoEvent(
    recordId: string,
    auditEvents: AuditEventRecord[]
  ): Promise<AuditEventRecord[]> {
    const [undone] = await buildAuditChain({
      context,
      priorHeadHash: auditEvents.at(-1)?.eventHash,
      drafts: [
        {
          recordId: `audit-undone-${recordId}`,
          eventKind: 'action_record.undone',
          actorKind: 'user',
          occurredAt: NOW,
          subjectRecordIds: [recordId],
          details: { reverts: recordId, actionKind: 'title.convey' },
        },
      ],
    });
    return [...auditEvents, undone];
  }

  function markUndone(record: ActionRecord): ActionRecord {
    return ActionRecordSchema.parse({
      ...record,
      status: 'undone',
      revision: record.revision + 1,
      lastModified: '2026-06-02T00:00:00.000Z',
    });
  }

  it('verifies clean payloads with no legacy events', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    expect(await verifyActionPayloadHashes(actionRecords, auditEvents)).toEqual({
      valid: true,
      brokenRecordId: null,
      reason: null,
      legacyCount: 0,
    });
  });

  it('rejects a tampered ActionRecord payload the event-body chain alone misses', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    // Edit the payload that replay consumes; leave the (already-valid) event
    // chain untouched, exactly as a Dexie/`.landroid` edit would.
    const tampered = actionRecords.map((record) =>
      record.recordId === 'action-record-1'
        ? { ...record, result: { ...record.result, summary: 'forged' } }
        : record
    );

    // The event-body chain still verifies — this is the gap DA-H5 closes.
    expect((await verifyAuditChain(auditEvents)).valid).toBe(true);

    const verdict = await verifyActionPayloadHashes(tampered, auditEvents);
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenRecordId).toBe('action-record-1');
    expect(verdict.reason).toMatch(/payload was altered/);
  });

  it('keeps verifying a record undone in place WITH its backing undo event (DA-H2)', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    // A legitimate DA-H2 undo: status/revision rewritten in place (result intact)
    // AND a matching action_record.undone event appended.
    const records = actionRecords.map((record) =>
      record.recordId === 'action-record-1' ? markUndone(record) : record
    );
    const events = await withUndoEvent('action-record-1', auditEvents);
    expect((await verifyActionPayloadHashes(records, events)).valid).toBe(true);
  });

  it('rejects a bare status flip with no backing undo event (DA-H5/F1 drop forgery)', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    // The attack the result-only hash misses: flip status to `undone` so replay
    // silently DROPS the mutation, without adding any undo event. `result` is
    // untouched, so the payload hash and the event chain both still verify.
    const forged = actionRecords.map((record) =>
      record.recordId === 'action-record-1' ? markUndone(record) : record
    );
    expect((await verifyAuditChain(auditEvents)).valid).toBe(true);
    const verdict = await verifyActionPayloadHashes(forged, auditEvents);
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenRecordId).toBe('action-record-1');
    expect(verdict.reason).toMatch(/marked undone but no matching undo event/);
  });

  it('rejects an undo event with no matching undone record (DA-H5/F1 un-drop forgery)', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    // The inverse: an undo event reverts action-record-1 but the record is left
    // `applied`, re-introducing a mutation that should have been dropped.
    const events = await withUndoEvent('action-record-1', auditEvents);
    const verdict = await verifyActionPayloadHashes(actionRecords, events);
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenRecordId).toBe('action-record-1');
    expect(verdict.reason).toMatch(/has a matching undo event but is not marked undone/);
  });

  it('rejects an actionKind relabel the result hash misses (DA-H5/F1)', async () => {
    const { actionRecords, auditEvents } = await hashedRows();
    // Replay feeds actionKind as the command kind; relabel it while leaving
    // `result` (and so the committed actionHash) untouched.
    const relabeled = actionRecords.map((record) =>
      record.recordId === 'action-record-1'
        ? ActionRecordSchema.parse({ ...record, actionKind: 'title.precede' })
        : record
    );
    expect((await verifyAuditChain(auditEvents)).valid).toBe(true);
    const verdict = await verifyActionPayloadHashes(relabeled, auditEvents);
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenRecordId).toBe('action-record-1');
    expect(verdict.reason).toMatch(/actionKind .* does not match the commandKind/);
  });

  it('accepts a legacy chain (no committed actionHash) and counts it', async () => {
    const r1 = actionRecord('action-record-1', 'one');
    const legacyEvents = await buildAuditChain({
      context,
      drafts: [await appliedEvent('audit-1', r1.recordId, { commandKind: 'title.convey' })],
    });
    const verdict = await verifyActionPayloadHashes([r1], legacyEvents);
    expect(verdict.valid).toBe(true);
    expect(verdict.legacyCount).toBe(1);
  });

  it('actionHash is stable across a JSON export/import round-trip (no false-positive quarantine)', async () => {
    // The inverse of the tamper risk: a legitimate `.landroid` export→import must
    // not perturb canonicalJson(result) and wrongly reject a valid chain. Uses a
    // 24-sig-digit decimal fraction string, as recordEffects carry.
    const record = ActionRecordSchema.parse({
      ...actionRecord('action-record-rt', 'rt'),
      result: {
        commandId: 'cmd-rt',
        surface: 'title_tree',
        mutation: 'convey',
        summary: 'rt',
        recordEffects: [{ kind: 'upsert', fraction: '0.333333333333333333333333' }],
      },
    });
    const before = await computeActionRecordHash(record);
    const roundTripped = ActionRecordSchema.parse(JSON.parse(JSON.stringify(record)));
    expect(await computeActionRecordHash(roundTripped)).toBe(before);
  });

  it('flags an applied event that references a missing action record', async () => {
    const events = await buildAuditChain({
      context,
      drafts: [await appliedEvent('audit-1', 'action-record-missing', { actionHash: HASH })],
    });
    const verdict = await verifyActionPayloadHashes([], events);
    expect(verdict.valid).toBe(false);
    expect(verdict.brokenRecordId).toBe('action-record-missing');
    expect(verdict.reason).toMatch(/missing action record/);
  });
});
