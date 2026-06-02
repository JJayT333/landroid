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
// A controllable wrapper around the real recordTitleMutation: default delegates
// to the real implementation; individual tests can override it once. Typed `any`
// (test-only) so the mock can stand in for the precisely-typed export.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recordSpy = vi.hoisted(() => ({ current: null as null | ((...args: any[]) => any) }));

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
import { verifyAuditChain } from '../../project-records/action-layer/audit-chain';
import { ParityDivergenceError } from '../../project-records/action-layer/parity';

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
