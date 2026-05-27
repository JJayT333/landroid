export const WORKSPACE_WRITE_LEASE_TTL_MS = 15_000;

export interface WorkspaceWriteLease {
  workspaceId: string;
  ownerTabId: string;
  heartbeatAt: number;
  expiresAt: number;
  fencingToken: number;
}

export interface WorkspaceWriteLeaseRequest {
  workspaceId: string;
  ownerTabId: string;
  now: number;
  ttlMs?: number;
  forceTakeover?: boolean;
}

export type WorkspaceWriteLeaseDecision =
  | {
      status: 'acquired' | 'refreshed' | 'takeover';
      lease: WorkspaceWriteLease;
    }
  | {
      status: 'blocked';
      lease: WorkspaceWriteLease;
    };

function buildLease(
  request: WorkspaceWriteLeaseRequest,
  fencingToken: number
): WorkspaceWriteLease {
  const ttlMs = request.ttlMs ?? WORKSPACE_WRITE_LEASE_TTL_MS;
  return {
    workspaceId: request.workspaceId,
    ownerTabId: request.ownerTabId,
    heartbeatAt: request.now,
    expiresAt: request.now + ttlMs,
    fencingToken,
  };
}

export function evaluateWorkspaceWriteLease(
  existing: WorkspaceWriteLease | null | undefined,
  request: WorkspaceWriteLeaseRequest
): WorkspaceWriteLeaseDecision {
  if (!existing) {
    return {
      status: 'acquired',
      lease: buildLease(request, 1),
    };
  }

  if (existing.workspaceId !== request.workspaceId) {
    return {
      status: 'acquired',
      lease: buildLease(request, 1),
    };
  }

  if (existing.ownerTabId === request.ownerTabId) {
    return {
      status: 'refreshed',
      lease: buildLease(request, existing.fencingToken),
    };
  }

  if (existing.expiresAt <= request.now || request.forceTakeover) {
    return {
      status: 'takeover',
      lease: buildLease(request, existing.fencingToken + 1),
    };
  }

  return {
    status: 'blocked',
    lease: existing,
  };
}

export function canWriteWithLease(
  lease: WorkspaceWriteLease | null | undefined,
  request: Pick<WorkspaceWriteLeaseRequest, 'workspaceId' | 'ownerTabId' | 'now'>
): boolean {
  return Boolean(
    lease
    && lease.workspaceId === request.workspaceId
    && lease.ownerTabId === request.ownerTabId
    && lease.expiresAt > request.now
  );
}
