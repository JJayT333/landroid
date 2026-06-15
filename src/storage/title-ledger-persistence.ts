import {
  ActionRecordSchema,
  AuditEventRecordSchema,
  type ActionRecord,
  type AuditEventRecord,
} from '../backend-spine/contracts';
import { activeDbKey, storageScopedId } from './db-key-scope';
import db from './db';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWritable,
} from './workspace-write-lease';
import type {
  StoredTitleActionRecord,
  StoredTitleAuditEvent,
  StoredTitleLedgerQuarantine,
  TitleLedgerWorkspaceRows,
} from './title-ledger-stores';

function assertWorkspaceRecord(
  record: ActionRecord | AuditEventRecord,
  workspaceId: string
): void {
  if (record.workspaceId !== workspaceId) {
    throw new Error(
      `Title ledger record ${record.recordId} belongs to workspace ${record.workspaceId}, not ${workspaceId}.`
    );
  }
}

function titleLedgerStorageId(recordId: string, dbKey: string): string {
  return storageScopedId(recordId, dbKey);
}

function titleLedgerScope(dbKey: string, workspaceId: string): [string, string] {
  return [dbKey, workspaceId];
}

function toActionRow(
  record: ActionRecord,
  dbKey: string,
  position: number
): StoredTitleActionRecord {
  return {
    ...record,
    id: titleLedgerStorageId(record.recordId, dbKey),
    dbKey,
    position,
  };
}

function toAuditRow(
  record: AuditEventRecord,
  dbKey: string,
  position: number
): StoredTitleAuditEvent {
  return {
    ...record,
    id: titleLedgerStorageId(record.recordId, dbKey),
    dbKey,
    position,
  };
}

function fromActionRow(row: StoredTitleActionRecord): ActionRecord {
  const { id: _id, dbKey: _dbKey, position: _position, ...record } = row;
  return ActionRecordSchema.parse(record);
}

function fromAuditRow(row: StoredTitleAuditEvent): AuditEventRecord {
  const { id: _id, dbKey: _dbKey, position: _position, ...record } = row;
  return AuditEventRecordSchema.parse(record);
}

function byPositionThenRecordId<T extends { position: number; recordId: string }>(
  first: T,
  second: T
): number {
  return first.position - second.position
    || first.recordId.localeCompare(second.recordId);
}

export async function listTitleLedgerWorkspaceRows(
  workspaceId: string
): Promise<TitleLedgerWorkspaceRows> {
  const dbKey = activeDbKey();
  const scope = titleLedgerScope(dbKey, workspaceId);
  const [actionRows, auditRows] = await Promise.all([
    db.titleActionRecords.where('[dbKey+workspaceId]').equals(scope).toArray(),
    db.titleAuditEvents.where('[dbKey+workspaceId]').equals(scope).toArray(),
  ]);

  return {
    actionRecords: actionRows
      .sort(byPositionThenRecordId)
      .map(fromActionRow),
    auditEvents: auditRows
      .sort(byPositionThenRecordId)
      .map(fromAuditRow),
  };
}

export async function replaceTitleLedgerWorkspaceRows(
  workspaceId: string,
  rows: TitleLedgerWorkspaceRows
): Promise<void> {
  for (const record of rows.actionRecords) {
    assertWorkspaceRecord(record, workspaceId);
  }
  for (const record of rows.auditEvents) {
    assertWorkspaceRecord(record, workspaceId);
  }

  const dbKey = activeDbKey();
  const scope = titleLedgerScope(dbKey, workspaceId);
  const actionRows = rows.actionRecords.map((record, index) =>
    toActionRow(record, dbKey, index)
  );
  const auditRows = rows.auditEvents.map((record, index) =>
    toAuditRow(record, dbKey, index)
  );

  // DA-M15: ledger rows are fenced like every other store — only the lease
  // holder writes, and the fence is re-asserted inside the rw transaction so
  // a tab demoted mid-flight cannot clobber the writer's chain.
  const writable = await ensureWorkspaceWritable(workspaceId);
  if (!writable) {
    throw new Error('Workspace is read-only because another tab holds the write lease.');
  }
  await db.transaction(
    'rw',
    db.workspaceWriteLeases,
    db.titleActionRecords,
    db.titleAuditEvents,
    async () => {
      await assertWorkspaceWriteFence(workspaceId);
      await db.titleActionRecords.where('[dbKey+workspaceId]').equals(scope).delete();
      await db.titleAuditEvents.where('[dbKey+workspaceId]').equals(scope).delete();
      if (actionRows.length > 0) {
        await db.titleActionRecords.bulkPut(actionRows);
      }
      if (auditRows.length > 0) {
        await db.titleAuditEvents.bulkPut(auditRows);
      }
    }
  );
}

export async function clearTitleLedgerWorkspaceRows(
  workspaceId: string
): Promise<void> {
  const dbKey = activeDbKey();
  const scope = titleLedgerScope(dbKey, workspaceId);
  const writable = await ensureWorkspaceWritable(workspaceId);
  if (!writable) {
    throw new Error('Workspace is read-only because another tab holds the write lease.');
  }
  await db.transaction(
    'rw',
    db.workspaceWriteLeases,
    db.titleActionRecords,
    db.titleAuditEvents,
    async () => {
      await assertWorkspaceWriteFence(workspaceId);
      await db.titleActionRecords.where('[dbKey+workspaceId]').equals(scope).delete();
      await db.titleAuditEvents.where('[dbKey+workspaceId]').equals(scope).delete();
    }
  );
}

export async function clearTitleLedgerRowsForActiveKey(): Promise<void> {
  const dbKey = activeDbKey();
  await db.transaction(
    'rw',
    db.titleActionRecords,
    db.titleAuditEvents,
    async () => {
      await db.titleActionRecords.where('dbKey').equals(dbKey).delete();
      await db.titleAuditEvents.where('dbKey').equals(dbKey).delete();
    }
  );
}

/**
 * DA-H4: preserve a rejected ledger chain before a fresh baseline overwrites it.
 * Append-only and deliberately NOT lease-fenced — evidence preservation must not
 * be blocked by a read-only tab, and each capture gets a unique id (the head
 * hash + timestamp), so concurrent captures coexist rather than clobber.
 */
export async function quarantineTitleLedgerRows(input: {
  workspaceId: string;
  rows: TitleLedgerWorkspaceRows;
  reason: string;
  source: 'storage' | 'file';
  quarantinedAt: string;
}): Promise<StoredTitleLedgerQuarantine> {
  const dbKey = activeDbKey();
  const headMarker =
    input.rows.auditEvents.at(-1)?.eventHash
    ?? `n${input.rows.actionRecords.length}`;
  const record: StoredTitleLedgerQuarantine = {
    id: titleLedgerStorageId(
      `${input.workspaceId}::quarantine::${input.quarantinedAt}::${headMarker}`,
      dbKey
    ),
    dbKey,
    workspaceId: input.workspaceId,
    quarantinedAt: input.quarantinedAt,
    source: input.source,
    reason: input.reason,
    actionRecords: input.rows.actionRecords,
    auditEvents: input.rows.auditEvents,
  };
  await db.titleLedgerQuarantine.put(record);
  return record;
}

export async function listTitleLedgerQuarantine(
  workspaceId: string
): Promise<StoredTitleLedgerQuarantine[]> {
  const dbKey = activeDbKey();
  const scope = titleLedgerScope(dbKey, workspaceId);
  const rows = await db.titleLedgerQuarantine
    .where('[dbKey+workspaceId]')
    .equals(scope)
    .toArray();
  return rows.sort((first, second) =>
    first.quarantinedAt < second.quarantinedAt ? -1 : 1
  );
}
