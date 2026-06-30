import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ActionRecord,
  AuditEventRecord,
} from '../../backend-spine/contracts';
import type {
  StoredTitleActionRecord,
  StoredTitleAuditEvent,
} from '../title-ledger-stores';
import { TITLE_LEDGER_STORE_DEFINITIONS } from '../title-ledger-stores';

const NOW = '2026-06-04T12:00:00.000Z';

type LedgerRow = {
  id: string;
  dbKey?: string;
  workspaceId: string;
};

function makeLedgerTable<Row extends LedgerRow>(initial: Row[] = []) {
  const rows = new Map<string, Row>();
  for (const row of initial) rows.set(row.id, row);

  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => [...rows.values()].filter(predicate)),
    delete: vi.fn(async () => {
      for (const [key, row] of [...rows.entries()]) {
        if (predicate(row)) rows.delete(key);
      }
    }),
  });

  return {
    rows,
    bulkPut: vi.fn(async (newRows: Row[]) => {
      for (const row of newRows) rows.set(row.id, row);
    }),
    put: vi.fn(async (row: Row) => {
      rows.set(row.id, row);
      return row.id;
    }),
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) =>
        collection((row) => {
          if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
            const [dbKey, workspaceId] = value as [string, string];
            return row.dbKey === dbKey && row.workspaceId === workspaceId;
          }
          return (row as unknown as Record<string, unknown>)[field] === value;
        })
      ),
    })),
  };
}

function fakeActionRecord(
  overrides: Partial<ActionRecord> = {}
): ActionRecord {
  return {
    recordId: 'action-1',
    recordType: 'action_record',
    workspaceId: 'ws-1',
    projectId: 'ws-1',
    schemaVersion: 1,
    lastModified: NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
    actionKind: 'title.create_root',
    status: 'applied',
    approvedBy: 'user',
    appliedAt: NOW,
    result: {},
    ...overrides,
  };
}

function fakeAuditEventRecord(
  overrides: Partial<AuditEventRecord> = {}
): AuditEventRecord {
  return {
    recordId: 'audit-1',
    recordType: 'audit_event',
    workspaceId: 'ws-1',
    projectId: 'ws-1',
    schemaVersion: 1,
    lastModified: NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
    eventKind: 'action_record.applied',
    actorKind: 'user',
    subjectRecordIds: ['action-1'],
    occurredAt: NOW,
    details: {},
    ...overrides,
  };
}

function storedAction(
  record: ActionRecord,
  dbKey: string,
  position: number
): StoredTitleActionRecord {
  return {
    ...record,
    id: `${dbKey}::${record.recordId}`,
    dbKey,
    position,
  };
}

function storedAudit(
  record: AuditEventRecord,
  dbKey: string,
  position: number
): StoredTitleAuditEvent {
  return {
    ...record,
    id: `${dbKey}::${record.recordId}`,
    dbKey,
    position,
  };
}

async function loadTitleLedgerPersistence({
  workspaceKey,
  actionRows = [],
  auditRows = [],
}: {
  workspaceKey: string;
  actionRows?: StoredTitleActionRecord[];
  auditRows?: StoredTitleAuditEvent[];
}) {
  vi.resetModules();

  const db = {
    titleActionRecords: makeLedgerTable(actionRows),
    titleAuditEvents: makeLedgerTable(auditRows),
    titleLedgerQuarantine: makeLedgerTable(),
    titleLedgerHeadMarkers: makeLedgerTable(),
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') {
        throw new Error('transaction callback missing');
      }
      return callback();
    }),
  };

  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => workspaceKey,
  }));
  vi.doMock('../db', () => ({ default: db }));
  // DA-M15: ledger writes are fenced; default the lease to writable so the
  // scoping tests stay focused, and let fence tests override per call.
  const lease = {
    ensureWorkspaceWritable: vi.fn(async () => true),
    assertWorkspaceWriteFence: vi.fn(async () => {}),
  };
  vi.doMock('../workspace-write-lease', () => lease);

  const persistence = await import('../title-ledger-persistence');
  return { persistence, db, lease };
}

describe('title ledger persistence', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db');
    vi.doUnmock('../workspace-write-lease');
    vi.resetModules();
  });

  it('defines scoped Dexie stores for title action and audit rows', () => {
    expect(TITLE_LEDGER_STORE_DEFINITIONS).toEqual({
      titleActionRecords:
        'id, dbKey, workspaceId, projectId, recordId, actionKind, appliedAt, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
      titleAuditEvents:
        'id, dbKey, workspaceId, projectId, recordId, eventKind, occurredAt, eventHash, previousHash, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
    });
  });

  it('writes, reads, and clears a head-hash marker pinning the flushed chain head', async () => {
    const action = fakeActionRecord({ recordId: 'a1' });
    const audit = fakeAuditEventRecord({
      recordId: 'e1',
      subjectRecordIds: ['a1'],
      eventHash: 'b'.repeat(64),
    });
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
    });

    await persistence.replaceTitleLedgerWorkspaceRows('ws-1', {
      actionRecords: [action],
      auditEvents: [audit],
    });

    // The marker row pins the head event's hash, scoped to the active dbKey.
    const markerRows = [...db.titleLedgerHeadMarkers.rows.values()];
    expect(markerRows).toHaveLength(1);
    expect(markerRows[0]).toEqual(
      expect.objectContaining({
        id: 'user-alice::ws-1',
        dbKey: 'user-alice',
        workspaceId: 'ws-1',
        flushedHeadHash: audit.eventHash,
      })
    );
    const marker = await persistence.readTitleLedgerHeadMarker('ws-1');
    expect(marker?.flushedHeadHash).toBe(audit.eventHash);

    // Clearing the workspace rows drops the marker too (no stale pin left behind).
    await persistence.clearTitleLedgerWorkspaceRows('ws-1');
    expect([...db.titleLedgerHeadMarkers.rows.values()]).toHaveLength(0);
    expect(await persistence.readTitleLedgerHeadMarker('ws-1')).toBeNull();
  });

  it('writes and reads only the active dbKey workspace rows without rewriting record ids', async () => {
    const action = fakeActionRecord({ recordId: 'shared-action' });
    const audit = fakeAuditEventRecord({
      recordId: 'shared-audit',
      subjectRecordIds: ['shared-action'],
    });
    const bobAction = storedAction(action, 'user-bob', 0);
    const bobAudit = storedAudit(audit, 'user-bob', 0);
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
      actionRows: [bobAction],
      auditRows: [bobAudit],
    });

    await persistence.replaceTitleLedgerWorkspaceRows('ws-1', {
      actionRecords: [action],
      auditEvents: [audit],
    });

    expect([...db.titleActionRecords.rows.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'user-alice::shared-action',
          dbKey: 'user-alice',
          recordId: 'shared-action',
          position: 0,
        }),
        bobAction,
      ])
    );
    expect([...db.titleAuditEvents.rows.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'user-alice::shared-audit',
          dbKey: 'user-alice',
          recordId: 'shared-audit',
          position: 0,
        }),
        bobAudit,
      ])
    );

    const listed = await persistence.listTitleLedgerWorkspaceRows('ws-1');
    expect(listed).toEqual({
      actionRecords: [action],
      auditEvents: [audit],
    });
    expect(listed.actionRecords[0]).not.toHaveProperty('id');
    expect(listed.auditEvents[0]).not.toHaveProperty('dbKey');
  });

  it('reads a non-active project ledger when given an explicit dbKey (duplicate source-head read)', async () => {
    const action = fakeActionRecord({ recordId: 'src-action' });
    const audit = fakeAuditEventRecord({
      recordId: 'src-audit',
      subjectRecordIds: ['src-action'],
    });
    // Source rows live under the SOURCE's own dbKey; the active project differs.
    const { persistence } = await loadTitleLedgerPersistence({
      workspaceKey: 'active-dbkey',
      actionRows: [storedAction(action, 'source-dbkey', 0)],
      auditRows: [storedAudit(audit, 'source-dbkey', 0)],
    });

    // Default (active) scope cannot see a background source's rows — this is the
    // exact gap that silently nulled the duplicate's source-ledger head.
    const underActive = await persistence.listTitleLedgerWorkspaceRows('ws-1');
    expect(underActive.auditEvents).toHaveLength(0);
    expect(underActive.actionRecords).toHaveLength(0);

    // An explicit source dbKey reads them, so the duplicate path can capture the
    // source ledger head even though the source is not the active workspace.
    const underSource = await persistence.listTitleLedgerWorkspaceRows('ws-1', 'source-dbkey');
    expect(underSource.auditEvents).toEqual([audit]);
    expect(underSource.actionRecords).toEqual([action]);
  });

  it('refuses to write ledger rows from a read-only tab (DA-M15)', async () => {
    const action = fakeActionRecord({ recordId: 'fenced-action' });
    const audit = fakeAuditEventRecord({
      recordId: 'fenced-audit',
      subjectRecordIds: ['fenced-action'],
    });
    const { persistence, db, lease } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
    });
    lease.ensureWorkspaceWritable.mockResolvedValueOnce(false);

    await expect(
      persistence.replaceTitleLedgerWorkspaceRows('ws-1', {
        actionRecords: [action],
        auditEvents: [audit],
      })
    ).rejects.toThrow(/read-only/);
    expect(db.titleActionRecords.rows.size).toBe(0);
    expect(db.titleAuditEvents.rows.size).toBe(0);
  });

  it('asserts the fence inside the transaction and aborts on a stale lease (DA-M15)', async () => {
    const seeded = storedAction(fakeActionRecord({ recordId: 'kept' }), 'user-alice', 0);
    const seededAudit = storedAudit(
      fakeAuditEventRecord({ recordId: 'kept-audit', subjectRecordIds: ['kept'] }),
      'user-alice',
      0
    );
    const { persistence, db, lease } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
      actionRows: [seeded],
      auditRows: [seededAudit],
    });
    lease.assertWorkspaceWriteFence.mockRejectedValueOnce(
      new Error('Workspace write lease is stale')
    );

    await expect(
      persistence.replaceTitleLedgerWorkspaceRows('ws-1', {
        actionRecords: [fakeActionRecord({ recordId: 'clobber' })],
        auditEvents: [fakeAuditEventRecord({ recordId: 'clobber-audit', subjectRecordIds: ['clobber'] })],
      })
    ).rejects.toThrow(/stale/);
    // The writer's rows survive: the fence threw before any delete ran.
    expect([...db.titleActionRecords.rows.values()]).toEqual([seeded]);
    expect([...db.titleAuditEvents.rows.values()]).toEqual([seededAudit]);
  });

  it('clears only the active dbKey workspace rows and is idempotent', async () => {
    const aliceWs1 = storedAction(fakeActionRecord({ recordId: 'a1' }), 'user-alice', 0);
    const aliceWs2 = storedAction(
      fakeActionRecord({
        recordId: 'a2',
        workspaceId: 'ws-2',
        projectId: 'ws-2',
      }),
      'user-alice',
      0
    );
    const bobWs1 = storedAction(fakeActionRecord({ recordId: 'b1' }), 'user-bob', 0);
    const aliceAuditWs1 = storedAudit(
      fakeAuditEventRecord({ recordId: 'ev-a1' }),
      'user-alice',
      0
    );
    const bobAuditWs1 = storedAudit(
      fakeAuditEventRecord({ recordId: 'ev-b1' }),
      'user-bob',
      0
    );
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
      actionRows: [aliceWs1, aliceWs2, bobWs1],
      auditRows: [aliceAuditWs1, bobAuditWs1],
    });

    await persistence.clearTitleLedgerWorkspaceRows('ws-1');
    await persistence.clearTitleLedgerWorkspaceRows('ws-1');

    expect([...db.titleActionRecords.rows.values()]).toEqual([aliceWs2, bobWs1]);
    expect([...db.titleAuditEvents.rows.values()]).toEqual([bobAuditWs1]);
  });

  it('clears every ledger row for the active dbKey while leaving another user intact', async () => {
    const aliceWs1 = storedAction(fakeActionRecord({ recordId: 'a1' }), 'user-alice', 0);
    const aliceWs2 = storedAction(
      fakeActionRecord({
        recordId: 'a2',
        workspaceId: 'ws-2',
        projectId: 'ws-2',
      }),
      'user-alice',
      0
    );
    const bobWs1 = storedAction(fakeActionRecord({ recordId: 'b1' }), 'user-bob', 0);
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
      actionRows: [aliceWs1, aliceWs2, bobWs1],
      auditRows: [
        storedAudit(fakeAuditEventRecord({ recordId: 'ev-a1' }), 'user-alice', 0),
        storedAudit(fakeAuditEventRecord({ recordId: 'ev-b1' }), 'user-bob', 0),
      ],
    });

    await persistence.clearTitleLedgerRowsForActiveKey();

    expect([...db.titleActionRecords.rows.values()]).toEqual([bobWs1]);
    expect([...db.titleAuditEvents.rows.values()]).toEqual([
      expect.objectContaining({ dbKey: 'user-bob', recordId: 'ev-b1' }),
    ]);
  });

  it('quarantines a rejected chain and reads it back scoped to the workspace (DA-H4)', async () => {
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
    });

    const rows = {
      actionRecords: [fakeActionRecord({ recordId: 'bad-action' })],
      auditEvents: [fakeAuditEventRecord({ recordId: 'bad-event' })],
    };
    const stored = await persistence.quarantineTitleLedgerRows({
      workspaceId: 'ws-1',
      rows,
      reason: 'audit chain failed at index 0',
      source: 'storage',
      quarantinedAt: NOW,
    });

    // persisted under the active db key, scoped to the workspace, evidence intact
    expect(stored.dbKey).toBe('user-alice');
    expect([...db.titleLedgerQuarantine.rows.values()]).toHaveLength(1);

    const read = await persistence.listTitleLedgerQuarantine('ws-1');
    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({
      workspaceId: 'ws-1',
      source: 'storage',
      reason: 'audit chain failed at index 0',
    });
    expect(read[0].actionRecords).toHaveLength(1);
    expect(read[0].auditEvents).toHaveLength(1);

    // a different workspace sees none of it
    expect(await persistence.listTitleLedgerQuarantine('ws-2')).toHaveLength(0);
  });

  it('re-quarantining the same invalid chain is idempotent — no duplicate rows on reload (DA-H4 content-addressed id)', async () => {
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
    });

    // The same invalid chain, captured twice (e.g. a read-only tab re-quarantining
    // it on each reload) with DIFFERENT wall-clock timestamps. The id is now
    // content-addressed on the chain's head hash, not the timestamp, so the second
    // capture overwrites the first instead of appending a duplicate row.
    const rows = {
      actionRecords: [fakeActionRecord({ recordId: 'bad-action' })],
      auditEvents: [fakeAuditEventRecord({ recordId: 'bad-event' })],
    };
    const first = await persistence.quarantineTitleLedgerRows({
      workspaceId: 'ws-1',
      rows,
      reason: 'audit chain failed at index 0',
      source: 'storage',
      quarantinedAt: '2026-06-04T12:00:00.000Z',
    });
    const second = await persistence.quarantineTitleLedgerRows({
      workspaceId: 'ws-1',
      rows,
      reason: 'audit chain failed at index 0',
      source: 'storage',
      quarantinedAt: '2026-06-04T13:00:00.000Z',
    });

    expect(second.id).toBe(first.id);
    expect([...db.titleLedgerQuarantine.rows.values()]).toHaveLength(1);
    expect(await persistence.listTitleLedgerQuarantine('ws-1')).toHaveLength(1);
  });

  it('keeps DISTINCT invalid chains separate — different content yields different ids, no overwrite (DA-H4)', async () => {
    const { persistence, db } = await loadTitleLedgerPersistence({
      workspaceKey: 'user-alice',
    });

    // Two genuinely different rejected chains captured into the same workspace.
    // The content-addressed id must not collapse them (which would overwrite and
    // lose one chain's evidence).
    const a = await persistence.quarantineTitleLedgerRows({
      workspaceId: 'ws-1',
      rows: {
        actionRecords: [fakeActionRecord({ recordId: 'bad-a' })],
        auditEvents: [fakeAuditEventRecord({ recordId: 'evt-a' })],
      },
      reason: 'chain A failed',
      source: 'storage',
      quarantinedAt: NOW,
    });
    const b = await persistence.quarantineTitleLedgerRows({
      workspaceId: 'ws-1',
      rows: {
        actionRecords: [fakeActionRecord({ recordId: 'bad-b' })],
        auditEvents: [fakeAuditEventRecord({ recordId: 'evt-b' })],
      },
      reason: 'chain B failed',
      source: 'storage',
      quarantinedAt: NOW,
    });

    expect(b.id).not.toBe(a.id);
    expect([...db.titleLedgerQuarantine.rows.values()]).toHaveLength(2);
    expect(await persistence.listTitleLedgerQuarantine('ws-1')).toHaveLength(2);
  });
});
