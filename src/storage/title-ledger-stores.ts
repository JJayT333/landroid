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

/**
 * DA-H4 residual: the last-flushed head-hash marker. A hashed audit chain that
 * is truncated back to a fully-legacy (re-hashed) chain still verifies
 * internally, so internal verification alone cannot detect that replacement.
 * Written atomically with each ledger flush, this single per-workspace row pins
 * the `eventHash` of the chain head at that flush; on hydrate, a stored head that
 * contradicts the marker means the chain was replaced and is quarantined.
 *
 * Scope note: same-database marker — it raises the bar against a naive
 * truncate-to-legacy edit (the marker is left untouched), but a marker-aware
 * tamper that also rewrites this row is out of scope (that needs backend-anchored
 * hashing). One marker per workspace; `put` overwrites it on every flush.
 */
export interface StoredTitleLedgerHeadMarker {
  id: string;
  dbKey?: string;
  workspaceId: string;
  /** `eventHash` of the chain head at the last flush; null only for an empty chain. */
  flushedHeadHash: string | null;
  flushedAt: string;
}

export const TITLE_LEDGER_HEAD_MARKER_STORE_DEFINITION = {
  titleLedgerHeadMarkers: 'id, dbKey, workspaceId, [dbKey+workspaceId]',
} as const;
