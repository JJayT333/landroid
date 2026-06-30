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
import { restoreSnapshot, type UndoSnapshot } from '../undo-store';

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
  const markerByWorkspace = new Map<string, string | null>();
  const clone = (rows: Rows): Rows => ({
    actionRecords: [...rows.actionRecords],
    auditEvents: [...rows.auditEvents],
  });
  const headOf = (rows: Rows): string | null =>
    (rows.auditEvents.at(-1) as { eventHash?: string } | undefined)?.eventHash ?? null;
  return {
    rowsByWorkspace,
    markerByWorkspace,
    listTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string) =>
      clone(rowsByWorkspace.get(workspaceId) ?? { actionRecords: [], auditEvents: [] })
    ),
    replaceTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string, rows: Rows) => {
      rowsByWorkspace.set(workspaceId, clone(rows));
      markerByWorkspace.set(workspaceId, headOf(rows));
    }),
    readTitleLedgerHeadMarker: vi.fn(async (workspaceId: string) =>
      markerByWorkspace.has(workspaceId)
        ? {
            id: workspaceId,
            workspaceId,
            flushedHeadHash: markerByWorkspace.get(workspaceId) ?? null,
            flushedAt: '2020-01-01T00:00:00.000Z',
          }
        : null
    ),
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
  readTitleLedgerHeadMarker: ledgerPersistenceMocks.readTitleLedgerHeadMarker,
}));
// DA-M15: the flush path is writer-gated; this single-tab test is the writer.
vi.mock('../../storage/workspace-write-lease', () => ({
  ensureWorkspaceWritable: vi.fn(async () => true),
  assertWorkspaceWriteFence: vi.fn(async () => {}),
}));
// Lets race tests inject a side effect mid-build (between settle and the
// final setState) without timing games.
const undoHook = vi.hoisted(() => ({ before: null as null | (() => void) }));
vi.mock('../../project-records/action-layer/title-undo', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../project-records/action-layer/title-undo')
  >();
  return {
    ...actual,
    undoTitleActionRecord: async (
      input: Parameters<typeof actual.undoTitleActionRecord>[0]
    ) => {
      const hook = undoHook.before;
      undoHook.before = null;
      hook?.();
      return actual.undoTitleActionRecord(input);
    },
  };
});
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
import { appendTitleUndoRecordsFromIndex, restoreSnapshotWithLedger } from '../undo-ledger';

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
    titleLedgerLength: useTitleActionLog.getState().actionRecords.length,
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
    undoHook.before = null;
    ledgerPersistenceMocks.rowsByWorkspace.clear();
    ledgerPersistenceMocks.markerByWorkspace.clear();
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

  it('a pre-turn user mutation stays applied; only the turn’s records are marked (review fix)', async () => {
    // Pre-turn user work, settled before the snapshot.
    useWorkspaceStore.getState().createRootNode('root', '1', {
      grantee: 'Root',
      interestClass: 'mineral',
      linkedOwnerId: 'owner-1',
    });
    await settleTitleActionLog();
    const snapshot = snapshotOfCurrentWorkspace('the AI turn'); // titleLedgerLength = 1

    // The AI turn.
    useWorkspaceStore.getState().convey('root', 'child', '0.5', { grantee: 'Child' });
    await settleTitleActionLog();
    await flushTitleActionLogToStorage(WS);

    await restoreSnapshotWithLedger(snapshot);

    const log = useTitleActionLog.getState();
    expect(log.actionRecords).toHaveLength(2);
    expect(log.actionRecords[0]?.status).toBe('applied'); // the user's pre-turn record
    expect(log.actionRecords[1]?.status).toBe('undone'); // the turn's record
    expect((await verifyAuditChain(log.auditEvents)).valid).toBe(true);
    // Replay (user record only) matches the restored workspace (root, no child).
    expect(useWorkspaceStore.getState().nodes.map((n) => n.id)).toEqual(['root']);
    expect(replayTitleProjection(log.actionRecords).length).toBeGreaterThan(0);
  });

  it('skips marking when the ledger is replaced mid-build (no forked chain)', async () => {
    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();
    await flushTitleActionLogToStorage(WS);

    undoHook.before = () => useTitleActionLog.getState().reset();
    const marked = await appendTitleUndoRecordsFromIndex(0, 'race test');

    expect(marked).toBe(0);
    // The reset state was left untouched — no undo events appended onto it.
    expect(useTitleActionLog.getState().auditEvents).toHaveLength(0);
  });

  it('skips marking when the chain head advances mid-build (no forked chain)', async () => {
    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();
    await flushTitleActionLogToStorage(WS);
    const eventsBefore = useTitleActionLog.getState().auditEvents.length;

    undoHook.before = () => useTitleActionLog.setState({ headHash: 'advanced-by-a-recording' });
    const marked = await appendTitleUndoRecordsFromIndex(0, 'race test');

    expect(marked).toBe(0);
    const log = useTitleActionLog.getState();
    expect(log.actionRecords[0]?.status).toBe('applied');
    expect(log.auditEvents).toHaveLength(eventsBefore);
  });

  it('refuses to restore a snapshot captured against a different workspace (defense in depth)', async () => {
    // Audit finding: a stale undo snapshot from project A, restored while
    // project B is active, would loadWorkspace A's data and the autosave loop
    // would then overwrite B on disk. The lifecycle clears the undo store on
    // every switch, but the restore itself must also refuse a cross-workspace
    // snapshot.
    const foreign = snapshotOfCurrentWorkspace('foreign empty project');
    foreign.workspaceId = 'ws-some-other-project';

    // The ACTIVE workspace then gains a node the foreign (empty) snapshot lacks.
    useWorkspaceStore.getState().createRootNode('root', '1', { grantee: 'Root' });
    await settleTitleActionLog();
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);

    await restoreSnapshotWithLedger(foreign);

    // Refused: restoreSnapshot (which would loadWorkspace the empty foreign
    // snapshot and wipe the active node) never ran, and the node survives.
    expect(restoreSnapshot).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);
  });

  it('a fresh workspace with no persisted chain keeps pre-existing behavior (baseline)', async () => {
    const snapshot = snapshotOfCurrentWorkspace('nothing recorded');
    await restoreSnapshotWithLedger(snapshot);

    const log = useTitleActionLog.getState();
    expect(log.actionRecords).toHaveLength(0);
    expect(log.lastError).toBeNull();
  });
});
