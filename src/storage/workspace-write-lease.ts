/**
 * Runtime single-writer lease for workspace shard writes (Phase 0.5).
 *
 * The pure decision logic lives in {@link ./workspace-write-lock}. This module
 * wires those decisions to Dexie (`workspaceWriteLeases`) and a
 * `BroadcastChannel`, so exactly one tab per workspace may write shards. The
 * contract is pessimistic: the first tab acquires the lease and stays writable;
 * later tabs open read-only and must not write until they explicitly take over
 * (or the writer's lease expires). A `BroadcastChannel` gives live tabs fast
 * notice of a claim/release; the TTL/expiry stored on the lease is the fallback
 * for browsers that drop broadcasts or for crashed/closed tabs.
 */
import db from './db';
import { useWriteLeaseStore } from '../store/write-lease-store';
import {
  evaluateWorkspaceWriteLease,
  type WorkspaceWriteLeaseDecision,
  type WorkspaceWriteLeaseRequest,
  type WorkspaceWriteLease,
} from './workspace-write-lock';

/** This tab's relationship to the active workspace's write lease. */
export type WorkspaceWriteRole = 'idle' | 'writer' | 'reader';

/** Minimal `BroadcastChannel` surface so tests can inject a stub. */
export interface LeaseBroadcastChannel {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface WorkspaceWriteLeaseEnv {
  tabId: string;
  now: () => number;
  claimLease?: (
    request: WorkspaceWriteLeaseRequest
  ) => Promise<WorkspaceWriteLeaseDecision>;
  loadLease: (workspaceId: string) => Promise<WorkspaceWriteLease | null>;
  saveLease: (lease: WorkspaceWriteLease) => Promise<void>;
  deleteLease: (workspaceId: string) => Promise<void>;
  createChannel?: (name: string) => LeaseBroadcastChannel | null;
  onRoleChange?: (role: WorkspaceWriteRole, workspaceId: string | null) => void;
}

export interface EnsureWritableOptions {
  /** Force a takeover of a peer's still-fresh lease (explicit user action). */
  force?: boolean;
}

interface LeasePeerMessage {
  type: 'claim' | 'release';
  workspaceId: string;
  ownerTabId: string;
  fencingToken: number;
}

interface ActiveWriteFence {
  workspaceId: string;
  ownerTabId: string;
  fencingToken: number;
}

function isLeasePeerMessage(value: unknown): value is LeasePeerMessage {
  return (
    typeof value === 'object'
    && value !== null
    && ((value as LeasePeerMessage).type === 'claim'
      || (value as LeasePeerMessage).type === 'release')
    && typeof (value as LeasePeerMessage).workspaceId === 'string'
    && typeof (value as LeasePeerMessage).ownerTabId === 'string'
  );
}

export class WorkspaceWriteLeaseController {
  private role: WorkspaceWriteRole = 'idle';
  private engagedWorkspaceId: string | null = null;
  private activeFence: ActiveWriteFence | null = null;
  private channel: LeaseBroadcastChannel | null = null;
  private channelName: string | null = null;

  constructor(private readonly env: WorkspaceWriteLeaseEnv) {}

  /**
   * Acquire or refresh this tab's write lease for the workspace. Resolves true
   * when this tab is the single writer, false when another live tab holds a
   * fresh lease (and this tab stays read-only). Pass `{ force: true }` for an
   * explicit user takeover of a peer's still-fresh lease.
   */
  async ensureWritable(
    workspaceId: string,
    options: EnsureWritableOptions = {}
  ): Promise<boolean> {
    // Listen on the channel even when we end up read-only, so a reader tab
    // hears the writer's claim/release broadcasts.
    this.ensureChannel(workspaceId);

    const request: WorkspaceWriteLeaseRequest = {
      workspaceId,
      ownerTabId: this.env.tabId,
      now: this.env.now(),
      forceTakeover: options.force,
    };
    const decision = this.env.claimLease
      ? await this.env.claimLease(request)
      : await this.claimLeaseWithLoadThenSave(request);

    if (decision.status === 'blocked') {
      this.activeFence = null;
      this.setRole('reader', workspaceId);
      return false;
    }

    const wasWriter = this.role === 'writer' && this.engagedWorkspaceId === workspaceId;
    this.activeFence = {
      workspaceId,
      ownerTabId: this.env.tabId,
      fencingToken: decision.lease.fencingToken,
    };
    this.setRole('writer', workspaceId);
    if (!wasWriter) {
      // Only announce on a genuine transition to writer, so per-autosave
      // refreshes do not flood peers with redundant claims.
      this.broadcast({
        type: 'claim',
        workspaceId,
        ownerTabId: this.env.tabId,
        fencingToken: decision.lease.fencingToken,
      });
    }
    return true;
  }

  /** True when this tab currently holds the write lease for the workspace. */
  canWrite(workspaceId: string): boolean {
    return (
      this.role === 'writer'
      && this.engagedWorkspaceId === workspaceId
      && this.activeFence?.workspaceId === workspaceId
    );
  }

  getActiveFence(workspaceId: string): ActiveWriteFence | null {
    if (!this.canWrite(workspaceId)) return null;
    return this.activeFence;
  }

  async assertFence(workspaceId: string): Promise<void> {
    const fence = this.getActiveFence(workspaceId);
    if (!fence) {
      throw new Error('Workspace is read-only because this tab does not hold the write lease.');
    }
    const current = await this.env.loadLease(workspaceId);
    if (
      !current
      || current.ownerTabId !== fence.ownerTabId
      || current.fencingToken !== fence.fencingToken
      || current.expiresAt <= this.env.now()
    ) {
      this.activeFence = null;
      this.setRole('reader', workspaceId);
      throw new Error('Workspace write lease is stale; reload or take over before saving.');
    }
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
    if (this.engagedWorkspaceId === workspaceId) {
      this.activeFence = null;
      this.setRole('idle', null);
    }
  }

  private async claimLeaseWithLoadThenSave(
    request: WorkspaceWriteLeaseRequest
  ): Promise<WorkspaceWriteLeaseDecision> {
    const existing = await this.env.loadLease(request.workspaceId);
    const decision = evaluateWorkspaceWriteLease(existing, request);
    if (decision.status !== 'blocked') {
      await this.env.saveLease(decision.lease);
    }
    return decision;
  }

  private setRole(role: WorkspaceWriteRole, workspaceId: string | null): void {
    const changed = this.role !== role || this.engagedWorkspaceId !== workspaceId;
    this.role = role;
    this.engagedWorkspaceId = workspaceId;
    if (changed) {
      this.env.onRoleChange?.(role, workspaceId);
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
    if (data.workspaceId !== this.engagedWorkspaceId) return;

    if (data.type === 'claim' && this.role === 'writer') {
      // A peer claimed the lease we held; step down to read-only. The next
      // write re-evaluates against Dexie.
      this.activeFence = null;
      this.setRole('reader', this.engagedWorkspaceId);
    } else if (data.type === 'release' && this.role === 'reader') {
      // The writer released; try to promote this read-only tab without making
      // the user click takeover.
      void this.ensureWritable(this.engagedWorkspaceId);
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
    claimLease: async (request) =>
      db.transaction('rw', db.workspaceWriteLeases, async () => {
        const existing =
          (await db.workspaceWriteLeases.get(request.workspaceId)) ?? null;
        const decision = evaluateWorkspaceWriteLease(existing, request);
        if (decision.status !== 'blocked') {
          await db.workspaceWriteLeases.put(decision.lease);
        }
        return decision;
      }),
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
    onRoleChange: (role, workspaceId) => {
      useWriteLeaseStore.getState().setRole(role, workspaceId);
    },
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
 * This is the gate the shard/canvas autosave paths call before writing.
 */
export async function ensureWorkspaceWritable(workspaceId: string): Promise<boolean> {
  return getController().ensureWritable(workspaceId);
}

export async function ensureWorkspaceWriteFence(workspaceId: string): Promise<void> {
  const writable = await getController().ensureWritable(workspaceId);
  if (!writable) {
    throw new Error('Workspace is read-only because another tab holds the write lease.');
  }
}

export async function assertWorkspaceWriteFence(workspaceId: string): Promise<void> {
  await getController().assertFence(workspaceId);
}

/**
 * Engage the lease for the active workspace at startup / after a workspace
 * swap, so this tab's read-only state is known before the first edit.
 */
export async function initWorkspaceWriteLease(workspaceId: string): Promise<boolean> {
  return getController().ensureWritable(workspaceId);
}

/** Explicit user takeover: force this tab to become the single writer. */
export async function takeoverWorkspaceWrite(workspaceId: string): Promise<boolean> {
  return getController().ensureWritable(workspaceId, { force: true });
}

export async function releaseWorkspaceWriteLease(workspaceId: string): Promise<void> {
  return getController().release(workspaceId);
}
