import type {
  ActionRecord,
  AuditEventRecord,
} from '../backend-spine/contracts';

export type StoredTitleActionRecord = ActionRecord & {
  id: string;
  dbKey?: string;
  position: number;
};

export type StoredTitleAuditEvent = AuditEventRecord & {
  id: string;
  dbKey?: string;
  position: number;
};

export interface TitleLedgerWorkspaceRows {
  actionRecords: ActionRecord[];
  auditEvents: AuditEventRecord[];
}

/**
 * DA-H4: a preserved copy of a title ledger chain that failed verification on
 * hydrate. Rather than warn-and-erase (destroying the tamper/corruption
 * evidence), the bad rows are copied here before a fresh baseline replaces them,
 * so they survive a reload and can be reviewed or downloaded.
 */
export interface StoredTitleLedgerQuarantine {
  id: string;
  dbKey?: string;
  workspaceId: string;
  quarantinedAt: string;
  /** Where the rejected chain came from. */
  source: 'storage' | 'file';
  /** Human-readable reason the chain was rejected. */
  reason: string;
  actionRecords: ActionRecord[];
  auditEvents: AuditEventRecord[];
}

export const TITLE_LEDGER_STORE_DEFINITIONS = {
  titleActionRecords:
    'id, dbKey, workspaceId, projectId, recordId, actionKind, appliedAt, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
  titleAuditEvents:
    'id, dbKey, workspaceId, projectId, recordId, eventKind, occurredAt, eventHash, previousHash, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
} as const;

export const TITLE_LEDGER_QUARANTINE_STORE_DEFINITION = {
  titleLedgerQuarantine:
    'id, dbKey, workspaceId, quarantinedAt, [dbKey+workspaceId]',
} as const;
