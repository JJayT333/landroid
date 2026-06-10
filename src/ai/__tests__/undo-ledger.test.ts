/**
 * DA-H2 regression — "Undo last AI change" must hydrate-then-append, never
 * erase the durable title ledger. Keeps the workspace store and title action
 * log real; mocks the Dexie ledger boundary (in-memory rows) and the live
 * side-store restore inside restoreSnapshot (covered by undo-store tests).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankOwner } from '../../types/owner';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { verifyAuditChain } from '../../project-records/action-layer/audit-chain';
import { replayTitleProjection } from '../../project-records/action-layer/title-replay';
import type { UndoSnapshot } from '../undo-store';

const docMocks = vi.hoisted(() => ({
  deleteDocsForAttachments: vi.fn(async () => {}),
  detachDocFromEntity: vi.fn(async () => {}),
  renameDoc: vi.fn(async () => {}),
  reorderAttachments: vi.fn(async () => {}),
  listAttachmentsForNodes: vi.fn(async () => new Map()),
  saveDoc: vi.fn(),
}));
const otherMocks = vi.hoisted(() => ({ unlinkNode: vi.fn(), unlinkDeskMap: vi.fn() }));
const ledgerPersistenceMocks = vi.hoisted(() => {
  type Rows = { actionRecords: unknown[]; auditEvents: unknown[] };
  const rowsByWorkspace = new Map<string, Rows>();
  const clone = (rows: Rows): Rows => ({
    actionRecords: [...rows.actionRecords],
    auditEvents: [...rows.auditEvents],
  });
  return {
    rowsByWorkspace,
    listTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string) =>
      clone(rowsByWorkspace.get(workspaceId) ?? { actionRecords: [], auditEvents: [] })
    ),
    replaceTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string, rows: Rows) => {
      rowsByWorkspace.set(workspaceId, clone(rows));
    }),
  };
});

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../../store/map-store', () => ({
  useMapStore: {
    getState: () => ({ unlinkNode: otherMocks.unlinkNode, unlinkDeskMap: otherMocks.unlinkDeskMap }),
  },
}));
vi.mock('../../store/curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));
vi.mock('../../storage/title-ledger-persistence', () => ({
  listTitleLedgerWorkspaceRows: ledgerPersistenceMocks.listTitleLedgerWorkspaceRows,
  replaceTitleLedgerWorkspaceRows: ledgerPersistenceMocks.replaceTitleLedgerWorkspaceRows,
}));
// DA-M15: the flush path is writer-gated; this single-tab test is the writer.
vi.mock('../../storage/workspace-write-lease', () => ({
  ensureWorkspaceWritable: vi.fn(async () => true),
  assertWorkspaceWriteFence: vi.fn(async () => {}),
}));
// The live side-store restore (owner/doc/curative/map Dexie writes) is owned
// by undo-store's own tests; here it is reduced to the ledger-relevant part —
// the loadWorkspace that resets the title action log.
vi.mock('../undo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../undo-store')>();
  return {
    ...actual,
    restoreSnapshot: vi.fn(async (snapshot: import('../undo-store').UndoSnapshot) => {
      const { useWorkspaceStore } = await import('../../store/workspace-store');
      useWorkspaceStore.getState().loadWorkspace({
        workspaceId: snapshot.workspaceId,
        projectName: snapshot.workspace.projectName,
        nodes: snapshot.workspace.nodes,
        deskMaps: snapshot.workspace.deskMaps,
        leaseholdUnit: snapshot.workspace.leaseholdUnit,
        leaseholdAssignments: snapshot.workspace.leaseholdAssignments,
        leaseholdOrris: snapshot.workspace.leaseholdOrris,
        leaseholdTransferOrderEntries: snapshot.workspace.leaseholdTransferOrderEntries,
        activeDeskMapId: snapshot.workspace.activeDeskMapId,
        activeUnitCode: snapshot.workspace.activeUnitCode,
      });
    }),
  };
});

import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  flushTitleActionLogToStorage,
  settleTitleActionLog,
  useTitleActionLog,
} from '../../store/title-action-log';
import { restoreSnapshotWithLedger } from '../undo-ledger';

const WS = 'ws-undo-ledger';

function seedEmptyWorkspace(): void {
  useOwnerStore.setState({
    owners: [createBlankOwner(WS, { id: 'owner-1', name: 'Acme Minerals LLC', entityType: 'Company' })],
    leases: [],
  });
  useWorkspaceStore.setState({
    workspaceId: WS,
    projectName: 'Undo Ledger Test',
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

function snapshotOfCurrentWorkspace(label: string): UndoSnapshot {
  const ws = useWorkspaceStore.getState();
  return {
    capturedAt: Date.now(),
    workspaceId: WS,
    label,
    workspace: structuredClone({
      projectName: ws.projectName,
      nodes: ws.nodes,
      deskMaps: ws.deskMaps,
      leaseholdUnit: ws.leaseholdUnit ?? createBlankLeaseholdUnit(),
      leaseholdAssignments: ws.leaseholdAssignments,
      leaseholdOrris: ws.leaseholdOrris,
      leaseholdTransferOrderEntries: ws.leaseholdTransferOrderEntries,
      activeDeskMapId: ws.activeDeskMapId,
      activeUnitCode: ws.activeUnitCode,
      activeNodeId: ws.activeNodeId,
    }),
    owner: { owners: useOwnerStore.getState().owners, leases: [], contacts: [], docs: [] },
    curative: { issues: [] } as never,
    map: { assets: [] } as never,
    documents: { documents: [], attachments: [] } as never,
  };
}

describe('AI undo keeps the durable title ledger (DA-H2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledgerPersistenceMocks.rowsByWorkspace.clear();
    seedEmptyWorkspace();
  });

  it('record 2 mutations, flush, undo: chain hydrated and marked undone, never erased', async () => {
    const snapshot = snapshotOfCurrentWorkspace('add root and child');

    const store = () => useWorkspaceStore.getState();
    store().createRootNode('root', '1', { grantee: 'Root', interestClass: 'mineral', linkedOwnerId: 'owner-1' });
    store().convey('root', 'child', '0.5', { grantee: 'Child' });
    await settleTitleActionLog();
    await flushTitleActionLogToStorage(WS);
    expect(useTitleActionLog.getState().actionRecords).toHaveLength(2);

    await restoreSnapshotWithLedger(snapshot);

    const log = useTitleActionLog.getState();
    // The chain survived the undo: both records present, both marked undone,
    // plus their two append-only undo audit events.
    expect(log.actionRecords).toHaveLength(2);
    expect(log.actionRecords.every((record) => record.status === 'undone')).toBe(true);
    expect(log.auditEvents).toHaveLength(4);
    expect(log.auditEvents.at(-1)?.eventKind).toBe('action_record.undone');
    expect((await verifyAuditChain(log.auditEvents)).valid).toBe(true);

    // Replay skips the undone records — the projection matches the restored
    // (empty) workspace.
    expect(replayTitleProjection(log.actionRecords)).toHaveLength(0);
    expect(useWorkspaceStore.getState().nodes).toHaveLength(0);

    // And the durable rows match memory (the undo was flushed).
    const persisted = ledgerPersistenceMocks.rowsByWorkspace.get(WS);
    expect(persisted?.actionRecords).toHaveLength(2);
    expect(persisted?.auditEvents).toHaveLength(4);
  });

  it('an unflushed in-memory chain is persisted before the restore (provenance survives)', async () => {
    const snapshot = snapshotOfCurrentWorkspace('single mutation');
    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();
    // No explicit flush — the pre-undo flush inside restoreSnapshotWithLedger
    // must persist the chain before loadWorkspace resets it.
    await restoreSnapshotWithLedger(snapshot);

    const log = useTitleActionLog.getState();
    expect(log.actionRecords).toHaveLength(1);
    expect(log.actionRecords[0]?.status).toBe('undone');
    expect((await verifyAuditChain(log.auditEvents)).valid).toBe(true);
    expect(replayTitleProjection(log.actionRecords)).toHaveLength(0);
  });

  it('a fresh workspace with no persisted chain keeps pre-existing behavior (baseline)', async () => {
    const snapshot = snapshotOfCurrentWorkspace('nothing recorded');
    await restoreSnapshotWithLedger(snapshot);

    const log = useTitleActionLog.getState();
    expect(log.actionRecords).toHaveLength(0);
    expect(log.lastError).toBeNull();
  });
});
