/**
 * Runtime single-writer lease for workspace shard writes (Phase 0.5).
 *
 * The pure decision logic lives in {@link ./workspace-write-lock}. This module
 * wires those decisions to Dexie (`workspaceWriteLeases`) and a
 * `BroadcastChannel`, so exactly one tab per workspace may write shards. The
 * contract is pessimistic: the first tab acquires the lease and stays writable;
 * later tabs are blocked until the lease expires (or is explicitly taken over)
 * and must not write. A `BroadcastChannel` gives live tabs fast notice of a
 * takeover; the TTL/expiry stored on the lease is the fallback for browsers
 * that drop broadcasts or for crashed/closed tabs.
 */
import db from './db';
import {
  evaluateWorkspaceWriteLease,
  type WorkspaceWriteLease,
} from './workspace-write-lock';

/** Minimal `BroadcastChannel` surface so tests can inject a stub. */
export interface LeaseBroadcastChannel {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface WorkspaceWriteLeaseEnv {
  tabId: string;
  now: () => number;
  loadLease: (workspaceId: string) => Promise<WorkspaceWriteLease | null>;
  saveLease: (lease: WorkspaceWriteLease) => Promise<void>;
  deleteLease: (workspaceId: string) => Promise<void>;
  createChannel?: (name: string) => LeaseBroadcastChannel | null;
}

interface LeasePeerMessage {
  type: 'claim' | 'release';
  workspaceId: string;
  ownerTabId: string;
  fencingToken: number;
}

function isLeasePeerMessage(value: unknown): value is LeasePeerMessage {
  return (
    typeof value === 'object'
    && value !== null
    && (value as LeasePeerMessage).type !== undefined
    && typeof (value as LeasePeerMessage).workspaceId === 'string'
    && typeof (value as LeasePeerMessage).ownerTabId === 'string'
  );
}

export class WorkspaceWriteLeaseController {
  private writableWorkspaceId: string | null = null;
  private channel: LeaseBroadcastChannel | null = null;
  private channelName: string | null = null;

  constructor(private readonly env: WorkspaceWriteLeaseEnv) {}

  /**
   * Acquire or refresh the write lease for the workspace. Resolves true when
   * this tab is the single writer, false when another live tab still holds a
   * fresh lease and this tab must stay read-only.
   */
  async ensureWritable(workspaceId: string): Promise<boolean> {
    const existing = await this.env.loadLease(workspaceId);
    const decision = evaluateWorkspaceWriteLease(existing, {
      workspaceId,
      ownerTabId: this.env.tabId,
      now: this.env.now(),
    });

    if (decision.status === 'blocked') {
      if (this.writableWorkspaceId === workspaceId) {
        this.writableWorkspaceId = null;
      }
      return false;
    }

    await this.env.saveLease(decision.lease);
    this.writableWorkspaceId = workspaceId;
    this.ensureChannel(workspaceId);
    this.broadcast({
      type: 'claim',
      workspaceId,
      ownerTabId: this.env.tabId,
      fencingToken: decision.lease.fencingToken,
    });
    return true;
  }

  /** Last known writable state for the workspace, without touching storage. */
  canWrite(workspaceId: string): boolean {
    return this.writableWorkspaceId === workspaceId;
  }

  /** Release the lease if this tab owns it, so a peer can take over at once. */
  async release(workspaceId: string): Promise<void> {
    const existing = await this.env.loadLease(workspaceId);
    if (existing && existing.ownerTabId === this.env.tabId) {
      await this.env.deleteLease(workspaceId);
      this.broadcast({
        type: 'release',
        workspaceId,
        ownerTabId: this.env.tabId,
        fencingToken: existing.fencingToken,
      });
    }
    if (this.writableWorkspaceId === workspaceId) {
      this.writableWorkspaceId = null;
    }
  }

  private ensureChannel(workspaceId: string): void {
    if (!this.env.createChannel) return;
    const name = `landroid-write-lease:${workspaceId}`;
    if (this.channelName === name && this.channel) return;
    this.channel?.close();
    this.channel = this.env.createChannel(name);
    this.channelName = this.channel ? name : null;
    if (this.channel) {
      this.channel.onmessage = (event) => this.handlePeerMessage(event.data);
    }
  }

  private handlePeerMessage(data: unknown): void {
    if (!isLeasePeerMessage(data)) return;
    if (data.ownerTabId === this.env.tabId) return;
    if (data.type === 'claim' && data.workspaceId === this.writableWorkspaceId) {
      // A peer claimed the lease for the workspace we believed we owned. Step
      // down to read-only; the next write re-evaluates against Dexie.
      this.writableWorkspaceId = null;
    }
  }

  private broadcast(message: LeasePeerMessage): void {
    this.channel?.postMessage(message);
  }
}

function randomTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function defaultEnv(): WorkspaceWriteLeaseEnv {
  return {
    tabId: randomTabId(),
    now: () => Date.now(),
    loadLease: async (workspaceId) =>
      (await db.workspaceWriteLeases.get(workspaceId)) ?? null,
    saveLease: async (lease) => {
      await db.workspaceWriteLeases.put(lease);
    },
    deleteLease: async (workspaceId) => {
      await db.workspaceWriteLeases.delete(workspaceId);
    },
    createChannel: (name) =>
      typeof BroadcastChannel !== 'undefined'
        ? (new BroadcastChannel(name) as unknown as LeaseBroadcastChannel)
        : null,
  };
}

let controller: WorkspaceWriteLeaseController | null = null;

function getController(): WorkspaceWriteLeaseController {
  if (!controller) {
    controller = new WorkspaceWriteLeaseController(defaultEnv());
  }
  return controller;
}

/**
 * Acquire or refresh the active tab's write lease for the workspace. Returns
 * false when another live tab holds the lease and this tab must not write.
 */
export async function ensureWorkspaceWritable(workspaceId: string): Promise<boolean> {
  return getController().ensureWritable(workspaceId);
}

export async function releaseWorkspaceWriteLease(workspaceId: string): Promise<void> {
  return getController().release(workspaceId);
}
