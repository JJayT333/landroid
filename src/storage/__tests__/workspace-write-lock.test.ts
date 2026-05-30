import { describe, expect, it } from 'vitest';
import {
  canWriteWithLease,
  evaluateWorkspaceWriteLease,
  WORKSPACE_WRITE_LEASE_TTL_MS,
  type WorkspaceWriteLease,
} from '../workspace-write-lock';

describe('workspace-write-lock', () => {
  it('lets the first tab acquire a workspace write lease', () => {
    const decision = evaluateWorkspaceWriteLease(null, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      now: 1000,
    });

    expect(decision.status).toBe('acquired');
    expect(decision.lease).toEqual({
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      heartbeatAt: 1000,
      expiresAt: 1000 + WORKSPACE_WRITE_LEASE_TTL_MS,
      fencingToken: 1,
    });
    expect(canWriteWithLease(decision.lease, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      now: 1001,
    })).toBe(true);
  });

  it('refreshes the owning tab without changing the fencing token', () => {
    const existing: WorkspaceWriteLease = {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      heartbeatAt: 1000,
      expiresAt: 16_000,
      fencingToken: 3,
    };

    const decision = evaluateWorkspaceWriteLease(existing, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      now: 2000,
    });

    expect(decision.status).toBe('refreshed');
    expect(decision.lease.fencingToken).toBe(3);
    expect(decision.lease.heartbeatAt).toBe(2000);
    expect(decision.lease.expiresAt).toBe(2000 + WORKSPACE_WRITE_LEASE_TTL_MS);
  });

  it('blocks a second tab while the current lease is fresh', () => {
    const existing: WorkspaceWriteLease = {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      heartbeatAt: 1000,
      expiresAt: 16_000,
      fencingToken: 2,
    };

    const decision = evaluateWorkspaceWriteLease(existing, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-b',
      now: 2000,
    });

    expect(decision.status).toBe('blocked');
    expect(decision.lease).toBe(existing);
    expect(canWriteWithLease(decision.lease, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-b',
      now: 2000,
    })).toBe(false);
  });

  it('lets another tab take over an expired lease and increments the fencing token', () => {
    const existing: WorkspaceWriteLease = {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      heartbeatAt: 1000,
      expiresAt: 2000,
      fencingToken: 7,
    };

    const decision = evaluateWorkspaceWriteLease(existing, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-b',
      now: 2000,
    });

    expect(decision.status).toBe('takeover');
    expect(decision.lease.ownerTabId).toBe('tab-b');
    expect(decision.lease.fencingToken).toBe(8);
  });

  it('allows explicit takeover before expiry when the UI has confirmed it', () => {
    const existing: WorkspaceWriteLease = {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-a',
      heartbeatAt: 1000,
      expiresAt: 16_000,
      fencingToken: 4,
    };

    const decision = evaluateWorkspaceWriteLease(existing, {
      workspaceId: 'ws-1',
      ownerTabId: 'tab-b',
      now: 2000,
      forceTakeover: true,
    });

    expect(decision.status).toBe('takeover');
    expect(decision.lease.ownerTabId).toBe('tab-b');
    expect(decision.lease.fencingToken).toBe(5);
  });
});
