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

  const persistence = await import('../title-ledger-persistence');
  return { persistence, db };
}

describe('title ledger persistence', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db');
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
});
