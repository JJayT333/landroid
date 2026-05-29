import { describe, expect, it } from 'vitest';
import {
  WorkspaceWriteLeaseController,
  type LeaseBroadcastChannel,
  type WorkspaceWriteLeaseEnv,
} from '../workspace-write-lease';
import {
  WORKSPACE_WRITE_LEASE_TTL_MS,
  type WorkspaceWriteLease,
} from '../workspace-write-lock';

function makeLeaseStore() {
  const leases = new Map<string, WorkspaceWriteLease>();
  return {
    leases,
    load: async (workspaceId: string) => leases.get(workspaceId) ?? null,
    save: async (lease: WorkspaceWriteLease) => {
      leases.set(lease.workspaceId, lease);
    },
    del: async (workspaceId: string) => {
      leases.delete(workspaceId);
    },
  };
}

// A synchronous in-process BroadcastChannel hub: posting a message delivers it
// to every other channel sharing the same name (never back to the sender).
function makeChannelHub() {
  const registered: { name: string; tabId: string; channel: LeaseBroadcastChannel }[] = [];
  return {
    createFor: (tabId: string) => (name: string): LeaseBroadcastChannel => {
      const channel: LeaseBroadcastChannel = {
        onmessage: null,
        postMessage: (message) => {
          for (const entry of registered) {
            if (entry.name === name && entry.tabId !== tabId) {
              entry.channel.onmessage?.({ data: message });
            }
          }
        },
        close: () => {},
      };
      registered.push({ name, tabId, channel });
      return channel;
    },
  };
}

function makeEnv(
  store: ReturnType<typeof makeLeaseStore>,
  tabId: string,
  clock: { value: number },
  createChannel?: WorkspaceWriteLeaseEnv['createChannel']
): WorkspaceWriteLeaseEnv {
  return {
    tabId,
    now: () => clock.value,
    loadLease: store.load,
    saveLease: store.save,
    deleteLease: store.del,
    createChannel,
  };
}

describe('WorkspaceWriteLeaseController', () => {
  it('lets the first tab become the single writer', async () => {
    const store = makeLeaseStore();
    const clock = { value: 1000 };
    const tabA = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-a', clock));

    await expect(tabA.ensureWritable('ws-1')).resolves.toBe(true);
    expect(tabA.canWrite('ws-1')).toBe(true);
    expect(store.leases.get('ws-1')).toMatchObject({
      ownerTabId: 'tab-a',
      fencingToken: 1,
      expiresAt: 1000 + WORKSPACE_WRITE_LEASE_TTL_MS,
    });
  });

  it('keeps a second tab read-only while the first lease is fresh', async () => {
    const store = makeLeaseStore();
    const clock = { value: 1000 };
    const tabA = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-a', clock));
    const tabB = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-b', clock));

    await tabA.ensureWritable('ws-1');
    clock.value = 2000;

    await expect(tabB.ensureWritable('ws-1')).resolves.toBe(false);
    expect(tabB.canWrite('ws-1')).toBe(false);
    // The fresh lease still belongs to tab-a; tab-b did not overwrite it.
    expect(store.leases.get('ws-1')).toMatchObject({ ownerTabId: 'tab-a' });
  });

  it('lets a second tab take over a stale lease', async () => {
    const store = makeLeaseStore();
    const clock = { value: 1000 };
    const tabA = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-a', clock));
    const tabB = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-b', clock));

    await tabA.ensureWritable('ws-1');
    clock.value = 1000 + WORKSPACE_WRITE_LEASE_TTL_MS + 1;

    await expect(tabB.ensureWritable('ws-1')).resolves.toBe(true);
    expect(tabB.canWrite('ws-1')).toBe(true);
    expect(store.leases.get('ws-1')).toMatchObject({
      ownerTabId: 'tab-b',
      fencingToken: 2,
    });
  });

  it('steps the prior writer down when a peer broadcasts a takeover', async () => {
    const store = makeLeaseStore();
    const clock = { value: 1000 };
    const hub = makeChannelHub();
    const tabA = new WorkspaceWriteLeaseController(
      makeEnv(store, 'tab-a', clock, hub.createFor('tab-a'))
    );
    const tabB = new WorkspaceWriteLeaseController(
      makeEnv(store, 'tab-b', clock, hub.createFor('tab-b'))
    );

    await tabA.ensureWritable('ws-1');
    expect(tabA.canWrite('ws-1')).toBe(true);

    clock.value = 1000 + WORKSPACE_WRITE_LEASE_TTL_MS + 1;
    await tabB.ensureWritable('ws-1');

    // tab-b's claim broadcast reaches tab-a, which steps down to read-only.
    expect(tabB.canWrite('ws-1')).toBe(true);
    expect(tabA.canWrite('ws-1')).toBe(false);
  });

  it('releases the lease so a peer can claim it immediately', async () => {
    const store = makeLeaseStore();
    const clock = { value: 1000 };
    const tabA = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-a', clock));
    const tabB = new WorkspaceWriteLeaseController(makeEnv(store, 'tab-b', clock));

    await tabA.ensureWritable('ws-1');
    await tabA.release('ws-1');
    expect(store.leases.has('ws-1')).toBe(false);

    await expect(tabB.ensureWritable('ws-1')).resolves.toBe(true);
  });
});
