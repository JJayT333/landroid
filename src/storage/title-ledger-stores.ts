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

export const TITLE_LEDGER_STORE_DEFINITIONS = {
  titleActionRecords:
    'id, dbKey, workspaceId, projectId, recordId, actionKind, appliedAt, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
  titleAuditEvents:
    'id, dbKey, workspaceId, projectId, recordId, eventKind, occurredAt, eventHash, previousHash, position, [dbKey+workspaceId], [dbKey+workspaceId+recordId], [dbKey+workspaceId+position], [workspaceId+recordId]',
} as const;
