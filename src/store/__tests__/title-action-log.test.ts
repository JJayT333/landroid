/**
 * Phase 4 title cutover — LIVE write-path wiring. Driving the real workspace
 * store (exactly as the app/AI tools do) auto-fires the journal hook, which
 * records durable ActionRecords + a verified audit chain. Proves the store stays
 * canonical, divergence is surfaced (not swallowed), and the kill switch works.
 * Synthetic fixtures only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLease, createBlankOwner, type Lease } from '../../types/owner';

const docMocks = vi.hoisted(() => ({
  deleteDocsForAttachments: vi.fn(),
  detachDocFromEntity: vi.fn(),
  renameDoc: vi.fn(),
  reorderAttachments: vi.fn(),
  listAttachmentsForNodes: vi.fn(),
  saveDoc: vi.fn(),
}));
const otherMocks = vi.hoisted(() => ({ unlinkNode: vi.fn(), unlinkDeskMap: vi.fn() }));
// A controllable wrapper around the real recordTitleMutation: `current` is what
// the hook calls (default delegates to `real`); tests may override `current`
// once, and beforeEach restores it from `real`. Typed `any` (test-only) so the
// mock can stand in for the precisely-typed export.
/* eslint-disable @typescript-eslint/no-explicit-any */
const recordSpy = vi.hoisted(() => ({
  current: null as null | ((...args: any[]) => any),
  real: null as null | ((...args: any[]) => any),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../map-store', () => ({
  useMapStore: { getState: () => ({ unlinkNode: otherMocks.unlinkNode, unlinkDeskMap: otherMocks.unlinkDeskMap }) },
}));
vi.mock('../curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));
vi.mock('../../project-records/action-layer/title-command-sourcing', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../project-records/action-layer/title-command-sourcing')
  >();
  recordSpy.real = actual.recordTitleMutation;
  recordSpy.current = vi.fn(actual.recordTitleMutation);
  const wrapped = (...args: Parameters<typeof actual.recordTitleMutation>) =>
    recordSpy.current!(...args);
  return {
    ...actual,
    recordTitleMutation: wrapped as typeof actual.recordTitleMutation,
  };
});

import { useWorkspaceStore } from '../workspace-store';
import { useOwnerStore } from '../owner-store';
import { useTitleActionLog, settleTitleActionLog } from '../title-action-log';
import { AUDIT_GENESIS_HASH, verifyAuditChain } from '../../project-records/action-layer/audit-chain';
import { ParityDivergenceError } from '../../project-records/action-layer/parity';
import { titleRecordsFromWorkspace } from '../../project-records/action-layer/title-projection';
import { replayTitleProjection } from '../../project-records/action-layer/title-replay';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import type { WorkspaceData } from '../../storage/workspace-persistence';

function sortedJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    [...records].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  );
}

/**
 * Like sortedJson but normalizes the envelope `lastModified` — the live ledger
 * stamps each record at record time, whereas a fresh adapter run stamps "now",
 * so completeness is about domain content, not the generation timestamp.
 */
function domainJson(records: readonly BackendSpineCoreRecord[]): string {
  return sortedJson(records.map((r) => ({ ...r, lastModified: '<normalized>' })));
}

function workspaceSnapshot(): WorkspaceData {
  const s = useWorkspaceStore.getState();
  return {
    workspaceId: s.workspaceId,
    projectName: s.projectName,
    nodes: s.nodes,
    deskMaps: s.deskMaps,
    leaseholdUnit: s.leaseholdUnit,
    leaseholdAssignments: s.leaseholdAssignments,
    leaseholdOrris: s.leaseholdOrris,
    leaseholdTransferOrderEntries: s.leaseholdTransferOrderEntries,
    activeDeskMapId: s.activeDeskMapId,
    activeUnitCode: s.activeUnitCode,
    instrumentTypes: s.instrumentTypes,
  };
}

const WS = 'ws-live-journal';
const LEASE: Lease = createBlankLease(WS, 'owner-1', {
  id: 'lease-1',
  leaseName: 'Live Lease',
  lessee: 'Operator A',
  royaltyRate: '1/8',
  leasedInterest: '1/2',
  effectiveDate: '2026-01-01',
  jurisdiction: 'tx_fee',
});

function reset(): void {
  useOwnerStore.setState({
    owners: [createBlankOwner(WS, { id: 'owner-1', name: 'Acme Minerals LLC', entityType: 'Company' })],
    leases: [LEASE],
  });
  useWorkspaceStore.setState({
    workspaceId: WS,
    projectName: 'Live Journal Test',
    nodes: [],
    deskMaps: [],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: [],
    lastError: null,
    lastAudit: null,
    activeNodeId: null,
  });
  useWorkspaceStore.getState().createDeskMap('Tract 1', 'T1');
  useTitleActionLog.getState().reset();
  useTitleActionLog.getState().setEnabled(true);
}

function driveSevenMutations(): void {
  const store = () => useWorkspaceStore.getState();
  store().createRootNode('root', '1', { grantee: 'Root', interestClass: 'mineral', linkedOwnerId: 'owner-1' });
  store().convey('root', 'child', '0.5', { grantee: 'Child' });
  store().createNpri('root', 'npri', '0.125', { grantee: 'NPRI' });
  store().insertPredecessor('child', 'pred', '0.25', { grantee: 'Pred' });
  store().createRootNode('orphan', '0.5', { grantee: 'Orphan' });
  store().attachConveyance('orphan', 'root', '0.25', { grantee: 'Orphan' });
  store().attachLease('root', LEASE, 'leasenode-1');
}

describe('Phase 4 LIVE title journal (real store auto-records)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the real-delegating recorder (a prior test may have overridden it).
    recordSpy.current = vi.fn(recordSpy.real!);
    reset();
  });

  it('records a durable ActionRecord + verified audit chain for live mutations', async () => {
    driveSevenMutations();
    useWorkspaceStore.getState().removeNode('npri'); // 8th: deleteNode
    await settleTitleActionLog();

    const log = useTitleActionLog.getState();
    expect(log.lastDivergence).toBeNull();
    expect(log.lastError).toBeNull();
    expect(log.recordedMutationCount).toBe(8);
    expect(log.actionRecords).toHaveLength(8);
    expect(log.actionRecords.every((r) => r.recordType === 'action_record')).toBe(true);

    const verification = await verifyAuditChain(log.auditEvents);
    expect(verification.valid).toBe(true);
    expect(verification.length).toBe(8);

    // the store is still canonical and correct
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'npri')).toBe(false);
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'leasenode-1')).toBe(true);
  });

  it('surfaces a parity divergence without rolling back the canonical store', async () => {
    // Force the next recording to diverge.
    recordSpy.current = vi.fn().mockRejectedValueOnce(
      new ParityDivergenceError([
        { workflow: 'title_tree', clean: false, expectedCount: 1, derivedCount: 0, divergences: [] },
      ])
    );

    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();

    const log = useTitleActionLog.getState();
    // surfaced, not swallowed; not appended
    expect(log.lastDivergence).not.toBeNull();
    expect(log.lastDivergence?.mutation).toBe('createRootNode');
    expect(log.recordedMutationCount).toBe(0);
    expect(log.actionRecords).toHaveLength(0);
    // but the canonical store committed the mutation
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'root')).toBe(true);
  });

  it('captures field edits (updateNode) so the ledger replays to the adapter', async () => {
    const store = () => useWorkspaceStore.getState();
    store().createRootNode('root', '1', { grantee: 'Root', interestClass: 'mineral', linkedOwnerId: 'owner-1' });
    store().convey('root', 'child', '0.5', { grantee: 'Child' });
    // a committed field edit — changes projected fields (grantee, docNo, remarks)
    store().updateNode('child', { grantee: 'Renamed Child', docNo: 'MD-99', remarks: 'edited' });
    await settleTitleActionLog();

    const log = useTitleActionLog.getState();
    expect(log.lastDivergence).toBeNull();
    expect(log.recordedMutationCount).toBe(3); // create, convey, update
    expect(log.actionRecords.map((r) => r.actionKind)).toEqual([
      'title.create_root_node',
      'title.convey',
      'title.update',
    ]);

    // COMPLETENESS: replaying the durable ledger reproduces the live adapter
    // projection exactly — including the field edit. The ledger is now a
    // complete title-node source-of-truth, not just structural mutations.
    const adapterTitleRecords = titleRecordsFromWorkspace({
      workspace: workspaceSnapshot(),
      ownerData: { owners: useOwnerStore.getState().owners, leases: useOwnerStore.getState().leases },
      projectId: WS,
      generatedAt: '2026-06-02T00:00:00.000Z',
    });
    expect(domainJson(replayTitleProjection(log.actionRecords))).toBe(domainJson(adapterTitleRecords));
  });

  it('skips a no-op update (no projected change → no ledger record)', async () => {
    const store = () => useWorkspaceStore.getState();
    store().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();
    const countAfterCreate = useTitleActionLog.getState().recordedMutationCount;

    // set a field to a value that does not change the projected records
    store().updateNode('root', { isCollapsed: true }); // UI-only field, not projected
    await settleTitleActionLog();

    expect(useTitleActionLog.getState().recordedMutationCount).toBe(countAfterCreate);
  });

  it('resets the ledger and audit chain when a workspace is replaced', async () => {
    const store = () => useWorkspaceStore.getState();
    store().createRootNode('root-a', '1', { grantee: 'Root A', linkedOwnerId: 'owner-1' });
    await settleTitleActionLog();

    const workspaceAHeadHash = useTitleActionLog.getState().headHash;
    expect(workspaceAHeadHash).toBeDefined();

    let releaseOldRecording: () => void = () => {};
    let markOldRecordingStarted: () => void = () => {};
    const oldRecordingStarted = new Promise<void>((resolve) => {
      markOldRecordingStarted = resolve;
    });
    const releaseOldRecordingWait = new Promise<void>((resolve) => {
      releaseOldRecording = resolve;
    });
    recordSpy.current = vi.fn(async (...args: Parameters<NonNullable<typeof recordSpy.real>>) => {
      markOldRecordingStarted();
      await releaseOldRecordingWait;
      return recordSpy.real!(...args);
    });

    store().convey('root-a', 'child-a', '0.5', { grantee: 'Child A' });
    await oldRecordingStarted;

    useWorkspaceStore.getState().loadWorkspace({
      workspaceId: 'ws-b',
      projectName: 'Workspace B',
      nodes: [],
      deskMaps: [
        {
          id: 'dm-b',
          name: 'Tract B',
          code: 'TB',
          tractId: 'TB',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-b',
      instrumentTypes: ['Deed'],
    });

    expect(useTitleActionLog.getState().actionRecords).toHaveLength(0);
    expect(useTitleActionLog.getState().auditEvents).toHaveLength(0);
    expect(useTitleActionLog.getState().headHash).toBeUndefined();

    releaseOldRecording();
    await settleTitleActionLog();
    expect(useTitleActionLog.getState().actionRecords).toHaveLength(0);

    recordSpy.current = vi.fn(recordSpy.real!);
    useOwnerStore.setState({
      owners: [createBlankOwner('ws-b', { id: 'owner-b', name: 'Workspace B Owner', entityType: 'Company' })],
      leases: [],
    });
    store().createRootNode('root-b', '1', { grantee: 'Root B', linkedOwnerId: 'owner-b' });
    await settleTitleActionLog();

    const log = useTitleActionLog.getState();
    expect(log.actionRecords).toHaveLength(1);
    expect(log.actionRecords[0]?.workspaceId).toBe('ws-b');
    expect(log.auditEvents).toHaveLength(1);
    expect(log.auditEvents[0]?.previousHash).toBe(AUDIT_GENESIS_HASH);
    expect(log.auditEvents[0]?.previousHash).not.toBe(workspaceAHeadHash);
  });

  it('kill switch: setEnabled(false) stops all recording', async () => {
    useTitleActionLog.getState().setEnabled(false);
    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();

    expect(useTitleActionLog.getState().recordedMutationCount).toBe(0);
    expect(useTitleActionLog.getState().actionRecords).toHaveLength(0);
    // store still canonical
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'root')).toBe(true);
  });
});
