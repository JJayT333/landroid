import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode } from '../../types/node';
import { createBlankLease } from '../../types/owner';

interface CurativeIssueRow {
  id?: string;
  issueType: string;
  affectedNodeId: string | null;
  affectedDeskMapId?: string | null;
  status?: string;
  priority?: string;
  resolutionNotes?: string;
}

const mocks = vi.hoisted(() => ({
  unlinkDeskMap: vi.fn(),
  unlinkNode: vi.fn(),
  // Default to a resolved promise so the cascade-delete helper's `.catch`
  // doesn't trip on `undefined`. Individual tests can override with
  // `mockRejectedValueOnce` if they need to exercise the error path.
  deleteDocsForAttachments: vi.fn(async () => undefined),
  unlinkCurativeNode: vi.fn(),
  removeOwner: vi.fn(async () => undefined),
  removeLease: vi.fn(async () => undefined),
  // Stateful curative mock so the raise -> resolve -> undo -> redo handoff is
  // actually exercised (the real store persists + mutates titleIssues; the
  // missing-link undo cascades read it back). addIssue de-dups by id (mirrors
  // the store's same-id overwrite), updateIssue mutates in place, removeIssue
  // drops by id.
  addCurativeIssue: vi.fn(async (issue: CurativeIssueRow) => {
    const idx = mocks.curativeTitleIssues.findIndex((i) => i.id === issue.id);
    if (idx >= 0) mocks.curativeTitleIssues[idx] = { ...issue };
    else mocks.curativeTitleIssues.unshift({ ...issue });
  }),
  updateCurativeIssue: vi.fn(async (id: string, fields: Partial<CurativeIssueRow>) => {
    const target = mocks.curativeTitleIssues.find((i) => i.id === id);
    if (target) Object.assign(target, fields);
  }),
  removeCurativeIssue: vi.fn(async (id: string) => {
    const idx = mocks.curativeTitleIssues.findIndex((i) => i.id === id);
    if (idx >= 0) mocks.curativeTitleIssues.splice(idx, 1);
  }),
  curativeTitleIssues: [] as CurativeIssueRow[],
  ownerState: {
    leases: [] as Array<{ id: string; ownerId: string }>,
  },
}));

vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkDeskMap: mocks.unlinkDeskMap,
      unlinkNode: mocks.unlinkNode,
    }),
  },
}));

vi.mock('../../storage/document-store', () => ({
  // Phase 5: workspace-store cleans removed node attachment rows via document-store.
  // Other document-store functions land on `attachDocToNode` etc. and
  // are exercised in `workspace-store-doc-actions.test.ts`.
  deleteDocsForAttachments: mocks.deleteDocsForAttachments,
  saveDoc: vi.fn(),
  detachDocFromEntity: vi.fn(),
  renameDoc: vi.fn(),
  reorderAttachments: vi.fn(),
  listAttachmentsForNodes: vi.fn(),
}));

// The undo cascade capture is Dexie-backed; stub it so destructive-mutation
// tests run without IndexedDB (its own logic is tested in
// storage/__tests__/undo-cascade-bundle.test.ts and the undo wiring tests).
vi.mock('../../storage/undo-cascade-bundle', () => ({
  captureCascadeBundle: vi.fn(async () => ({ kind: 'fake-bundle' })),
  restoreCascadeBundle: vi.fn(async () => ({})),
  // Redo path for destructive mutations — stubbed so the missing-link delete
  // undo/redo tests don't reach into Dexie.
  captureCascadeReapply: vi.fn(async () => ({ kind: 'fake-reapply' })),
  reapplyCascadeBundle: vi.fn(async () => ({})),
  planOwnerRecordCleanup: vi.fn(
    (
      removedNodes: Array<{ linkedOwnerId: string | null; linkedLeaseId: string | null }>,
      survivingNodes: Array<{ linkedOwnerId: string | null; linkedLeaseId: string | null }>,
      leases: Array<{ id: string; ownerId: string }>
    ) => {
      // Mirror the real planner so the owner-cleanup tests keep their teeth.
      const removedOwners = new Set(removedNodes.map((n) => n.linkedOwnerId).filter(Boolean));
      const removedLeases = new Set(removedNodes.map((n) => n.linkedLeaseId).filter(Boolean));
      const survivingOwners = new Set(survivingNodes.map((n) => n.linkedOwnerId).filter(Boolean));
      const survivingLeases = new Set(survivingNodes.map((n) => n.linkedLeaseId).filter(Boolean));
      for (const lease of leases) {
        if (survivingLeases.has(lease.id)) survivingOwners.add(lease.ownerId);
      }
      const ownerIdsToRemove = [...removedOwners].filter((id) => !survivingOwners.has(id));
      const ownerSet = new Set(ownerIdsToRemove);
      const leaseIdsToRemove = [...removedLeases].filter((leaseId) => {
        if (survivingLeases.has(leaseId)) return false;
        const lease = leases.find((candidate) => candidate.id === leaseId);
        return !lease || !ownerSet.has(lease.ownerId);
      });
      return { ownerIdsToRemove, leaseIdsToRemove };
    }
  ),
}));

vi.mock('../curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: mocks.unlinkCurativeNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
      // DA-M1: convey() reads titleIssues (idempotency guard) and calls addIssue.
      workspaceId: 'ws-test',
      titleIssues: mocks.curativeTitleIssues,
      addIssue: mocks.addCurativeIssue,
      updateIssue: mocks.updateCurativeIssue,
      removeIssue: mocks.removeCurativeIssue,
    }),
  },
}));

vi.mock('../owner-store', () => ({
  useOwnerStore: {
    getState: () => ({
      leases: mocks.ownerState.leases,
      removeOwner: mocks.removeOwner,
      removeLease: mocks.removeLease,
    }),
  },
}));

import { useWorkspaceStore } from '../workspace-store';

describe('workspace-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ownerState.leases = [];
    mocks.curativeTitleIssues.length = 0;
    useWorkspaceStore.setState({
      workspaceId: 'ws-test',
      projectName: 'Workspace Store Test',
      nodes: [],
      deskMaps: [],
      leaseholdUnit: createBlankLeaseholdUnit(),
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
      activeDeskMapId: null,
      activeUnitCode: null,
      instrumentTypes: ['Deed'],
      _hydrated: true,
      activeNodeId: null,
      lastAudit: null,
      lastError: null,
      startupWarning: null,
    });
  });

  it('DA-M2: a raw addNode with a negative fraction is flagged but still lands (warn-dont-cap)', () => {
    const bad = { ...createBlankNode('bad', null), fraction: '-0.500000000', grantee: 'Bad Node' };
    useWorkspaceStore.getState().addNode(bad);

    // warn-don't-cap: the entry STANDS
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'bad')).toBe(true);
    // and is surfaced as a curative title issue on that node
    expect(mocks.addCurativeIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        issueType: 'Other',
        affectedNodeId: 'bad',
        id: 'structural-negative_fraction-bad',
      })
    );
  });

  it('DA-M2: a valid raw addNode raises no structural issue', () => {
    useWorkspaceStore.getState().addNode({ ...createBlankNode('good', null), grantee: 'Good' });
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'good')).toBe(true);
    expect(mocks.addCurativeIssue).not.toHaveBeenCalled();
  });

  it('addNodeToActiveDeskMap is idempotent — a re-add does not duplicate the nodeId', () => {
    const node = { ...createBlankNode('n1', null), grantee: 'A' };
    useWorkspaceStore.setState({
      nodes: [node],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-1',
    });

    useWorkspaceStore.getState().addNodeToActiveDeskMap('n1');
    useWorkspaceStore.getState().addNodeToActiveDeskMap('n1');

    const dm = useWorkspaceStore.getState().deskMaps.find((d) => d.id === 'dm-1');
    expect(dm?.nodeIds).toEqual(['n1']);
  });

  it('books an over-conveyance and raises an Over-conveyance title issue (DA-M1)', async () => {
    const root = {
      ...createBlankNode('root', null),
      grantee: 'Root Owner',
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    };
    useWorkspaceStore.setState({
      nodes: [root],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['root'],
        },
      ],
      activeDeskMapId: 'dm-1',
    });

    // Recite 0.75 from a grantor holding only 0.5 -> over-conveyance: the engine
    // books the 0.5 remainder, captures the stated 0.75, and the store flags it.
    const ok = useWorkspaceStore
      .getState()
      .convey('root', 'child-over', '0.75', { grantee: 'Over Grantee', docNo: '2026-OC-1' });
    expect(ok).toBe(true);

    const child = useWorkspaceStore.getState().nodes.find((n) => n.id === 'child-over');
    expect(child?.fraction).toBe('0.500000000');
    expect(child?.statedFraction).toBe('0.750000000');

    expect(mocks.addCurativeIssue).toHaveBeenCalledTimes(1);
    expect(mocks.addCurativeIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        issueType: 'Over-conveyance',
        affectedNodeId: 'child-over',
        affectedDeskMapId: 'dm-1',
        sourceDocNo: '2026-OC-1',
        priority: 'High',
      })
    );
  });

  it('surfaces lastError (never silently) if the over-conveyance title issue fails to persist (F1)', async () => {
    // warn-don't-cap: the over-conveyance is BOOKED, so a failed title-issue
    // write must not leave the capped number with no surfaced warning.
    mocks.addCurativeIssue.mockRejectedValueOnce(new Error('quota exceeded'));
    const root = {
      ...createBlankNode('root', null),
      grantee: 'Root Owner',
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    };
    useWorkspaceStore.setState({
      nodes: [root],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['root'],
        },
      ],
      activeDeskMapId: 'dm-1',
    });

    const ok = useWorkspaceStore
      .getState()
      .convey('root', 'child-over', '0.75', { grantee: 'Over Grantee' });
    expect(ok).toBe(true);
    // The booking itself is still correct.
    expect(useWorkspaceStore.getState().nodes.find((n) => n.id === 'child-over')?.fraction).toBe(
      '0.500000000'
    );
    // The warning is NOT lost: the persistence failure surfaces via lastError.
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().lastError).toMatch(/Over-conveyance booked/);
    });
  });

  it('does not raise an Over-conveyance issue for a within-remainder conveyance', async () => {
    const root = {
      ...createBlankNode('root', null),
      grantee: 'Root Owner',
      initialFraction: '1.000000000',
      fraction: '1.000000000',
    };
    useWorkspaceStore.setState({
      nodes: [root],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['root'],
        },
      ],
      activeDeskMapId: 'dm-1',
    });

    const ok = useWorkspaceStore
      .getState()
      .convey('root', 'child-ok', '0.25', { grantee: 'Normal Grantee' });
    expect(ok).toBe(true);
    expect(mocks.addCurativeIssue).not.toHaveBeenCalled();
  });

  describe('Missing Link placeholder', () => {
    function seedRootChild(): void {
      // grandma (root) -> grandson (child); we bridge an unproven link between.
      const root = {
        ...createBlankNode('root', null),
        grantee: 'Grandma',
        initialFraction: '1.000000000',
        fraction: '0.000000000',
      };
      const child = {
        ...createBlankNode('child', 'root'),
        grantee: 'Grandson',
        conveyanceMode: 'all' as const,
        initialFraction: '1.000000000',
        fraction: '1.000000000',
      };
      useWorkspaceStore.setState({
        nodes: [root, child],
        deskMaps: [
          {
            id: 'dm-1',
            name: 'Tract 1',
            code: 'T1',
            tractId: null,
            grossAcres: '100',
            pooledAcres: '100',
            description: '',
            nodeIds: ['root', 'child'],
          },
        ],
        activeDeskMapId: 'dm-1',
      });
    }

    it('insertMissingLink raises a High "Missing link" issue on the new node', async () => {
      seedRootChild();
      const ok = useWorkspaceStore
        .getState()
        .insertMissingLink('child', 'mlink', { placeholderMissing: 'both' });
      expect(ok).toBe(true);

      const nodes = useWorkspaceStore.getState().nodes;
      const placeholder = nodes.find((n) => n.id === 'mlink');
      // The placeholder is a full pass-through conveyance IN the main line.
      expect(placeholder?.provenance).toBe('placeholder');
      expect(placeholder?.conveyanceMode).toBe('all');
      expect(placeholder?.type).toBe('conveyance');
      expect(placeholder?.grantee).toBe('??? — missing link');
      // child now hangs UNDER the placeholder, carrying its interest unchanged.
      expect(nodes.find((n) => n.id === 'child')?.parentId).toBe('mlink');
      // The placeholder takes 100% of the node's interest (no silent zero).
      expect(placeholder?.initialFraction).toBe('1.000000000');
      // It joined the same tract.
      expect(
        useWorkspaceStore
          .getState()
          .deskMaps.find((d) => d.id === 'dm-1')
          ?.nodeIds
      ).toContain('mlink');

      expect(mocks.addCurativeIssue).toHaveBeenCalledTimes(1);
      expect(mocks.addCurativeIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueType: 'Missing link',
          priority: 'High',
          affectedNodeId: 'mlink',
          affectedDeskMapId: 'dm-1',
          id: 'missing-link-mlink',
        })
      );
    });

    it('insertMissingLink is NOT blocked by the placeholder (warn-dont-block save)', () => {
      seedRootChild();
      const ok = useWorkspaceStore.getState().insertMissingLink('child', 'mlink');
      expect(ok).toBe(true);
      expect(useWorkspaceStore.getState().lastError).toBeNull();
      // A placeholder legitimately has no recorded instrument and is a full
      // pass-through; the graph stays valid (no hard-error on save).
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')?.instrument
      ).toBe('');
    });

    it('setPlaceholderPassthrough toggles indeterminate <-> assume', () => {
      seedRootChild();
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink');
      // Default is the absent 'indeterminate'.
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')
          ?.placeholderPassthrough
      ).toBeUndefined();

      expect(
        useWorkspaceStore.getState().setPlaceholderPassthrough('mlink', 'assume')
      ).toBe(true);
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')
          ?.placeholderPassthrough
      ).toBe('assume');

      expect(
        useWorkspaceStore.getState().setPlaceholderPassthrough('mlink', 'indeterminate')
      ).toBe(true);
      // Back to the absent default (round-trip clean).
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')
          ?.placeholderPassthrough
      ).toBeUndefined();
    });

    it('setPlaceholderPassthrough is a no-op on a recorded (non-placeholder) node', () => {
      seedRootChild();
      expect(
        useWorkspaceStore.getState().setPlaceholderPassthrough('child', 'assume')
      ).toBe(false);
    });

    it('resolveMissingLink clears the placeholder, closes the issue, and math flows', async () => {
      seedRootChild();
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink', {
        placeholderMissing: 'instrument',
        placeholderPassthrough: 'assume',
      });
      // The insert already raised the still-open issue (stateful curative mock),
      // so the close path has a real target to find.
      expect(
        mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink')?.status
      ).toBe('Open');

      const ok = useWorkspaceStore.getState().resolveMissingLink('mlink', {
        instrument: 'Affidavit of Heirship',
        docNo: 'AH-2026-1',
        grantor: 'Grandma Estate',
        grantee: 'Proven Heir',
      });
      expect(ok).toBe(true);

      const promoted = useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink');
      // Placeholder markers cleared; promoted to an ordinary recorded node.
      expect(promoted?.provenance).toBeUndefined();
      expect(promoted?.placeholderPassthrough).toBeUndefined();
      expect(promoted?.placeholderMissing).toBeUndefined();
      // Real instrument + parties written.
      expect(promoted?.instrument).toBe('Affidavit of Heirship');
      expect(promoted?.grantee).toBe('Proven Heir');
      // Structure intact: child still hangs under it, interest preserved.
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'child')?.parentId
      ).toBe('mlink');
      expect(promoted?.initialFraction).toBe('1.000000000');

      // The linked Missing link issue was closed (Resolved).
      expect(mocks.updateCurativeIssue).toHaveBeenCalledWith(
        'missing-link-mlink',
        expect.objectContaining({ status: 'Resolved' })
      );
    });

    it('resolveMissingLink is a no-op on a recorded (non-placeholder) node', () => {
      seedRootChild();
      expect(useWorkspaceStore.getState().resolveMissingLink('child')).toBe(false);
      expect(mocks.updateCurativeIssue).not.toHaveBeenCalled();
    });

    it('resolveMissingLink strips engine-structural fields from the promotion payload (#3)', () => {
      seedRootChild();
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink');
      const before = useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink');
      // Engine-set values the promotion must not be able to overwrite.
      const beforeInitialFraction = before?.initialFraction;
      const beforeFraction = before?.fraction;
      expect(beforeInitialFraction).toBe('1.000000000');
      expect(before?.conveyanceMode).toBe('all');

      // Attempt to re-fraction + re-mode the node out from under the engine on
      // promotion; those structural keys must be ignored.
      const ok = useWorkspaceStore.getState().resolveMissingLink('mlink', {
        grantee: 'Proven Heir',
        initialFraction: '0.250000000',
        fraction: '0.250000000',
        conveyanceMode: 'fraction',
        statedFraction: '0.500000000',
      });
      expect(ok).toBe(true);

      const promoted = useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink');
      // Descriptive field landed...
      expect(promoted?.grantee).toBe('Proven Heir');
      // ...but the structural/fraction keys did NOT (full pass-through preserved).
      expect(promoted?.initialFraction).toBe(beforeInitialFraction);
      expect(promoted?.fraction).toBe(beforeFraction);
      expect(promoted?.conveyanceMode).toBe('all');
      expect(promoted?.statedFraction).toBeUndefined();
    });

    it('undo of insertMissingLink removes the raised issue; redo re-raises it (#1, #7)', async () => {
      seedRootChild();
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink', {
        placeholderMissing: 'both',
      });
      // The High issue was raised.
      expect(
        mocks.curativeTitleIssues.some((i) => i.id === 'missing-link-mlink')
      ).toBe(true);

      // Undo: the placeholder node is gone AND its orphaned issue is removed.
      const undone = await useWorkspaceStore.getState().undoLastTitleMutation();
      expect(undone).toBe(true);
      expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'mlink')).toBe(false);
      expect(
        mocks.curativeTitleIssues.some((i) => i.id === 'missing-link-mlink')
      ).toBe(false);

      // Redo: the placeholder returns AND the issue is re-raised.
      const redone = await useWorkspaceStore.getState().redoLastTitleMutation();
      expect(redone).toBe(true);
      expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'mlink')).toBe(true);
      const reraised = mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink');
      expect(reraised).toBeDefined();
      expect(reraised?.issueType).toBe('Missing link');
      expect(reraised?.priority).toBe('High');
      expect(reraised?.affectedNodeId).toBe('mlink');
    });

    it('undo of resolveMissingLink reopens the issue; redo re-closes it (#2, #7)', async () => {
      seedRootChild();
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink');
      const ok = useWorkspaceStore.getState().resolveMissingLink('mlink', {
        instrument: 'Affidavit of Heirship',
        grantee: 'Proven Heir',
      });
      expect(ok).toBe(true);
      // The link was closed (Resolved) and the node promoted.
      expect(
        mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink')?.status
      ).toBe('Resolved');
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')?.provenance
      ).toBeUndefined();

      // Undo: the placeholder is reopened (provenance back) AND the issue reopens.
      const undone = await useWorkspaceStore.getState().undoLastTitleMutation();
      expect(undone).toBe(true);
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')?.provenance
      ).toBe('placeholder');
      expect(
        mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink')?.status
      ).toBe('Open');

      // Redo: the promotion re-applies AND the issue re-closes.
      const redone = await useWorkspaceStore.getState().redoLastTitleMutation();
      expect(redone).toBe(true);
      expect(
        useWorkspaceStore.getState().nodes.find((n) => n.id === 'mlink')?.provenance
      ).toBeUndefined();
      expect(
        mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink')?.status
      ).toBe('Resolved');
    });

    it('deleting a placeholder closes its still-open Missing link issue; undo restores it (#4, #7)', async () => {
      seedRootChild();
      // Bridge the unproven link, then delete a leaf under it so the placeholder
      // survives, then delete the placeholder itself.
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink', {
        placeholderMissing: 'both',
      });
      expect(
        mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink')?.status
      ).toBe('Open');

      // Delete the placeholder branch (mlink + its child).
      useWorkspaceStore.getState().removeNode('mlink');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The placeholder is gone and its High issue is auto-closed (no longer
      // holding payout or lighting a dot for a node that no longer exists).
      expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'mlink')).toBe(false);
      const closed = mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink');
      expect(closed?.status).toBe('Resolved');

      // Undo of the delete reopens + relinks the issue to its restored placeholder.
      const undone = await useWorkspaceStore.getState().undoLastTitleMutation();
      expect(undone).toBe(true);
      expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'mlink')).toBe(true);
      const restored = mocks.curativeTitleIssues.find((i) => i.id === 'missing-link-mlink');
      expect(restored?.status).toBe('Open');
      expect(restored?.affectedNodeId).toBe('mlink');
    });

    it('raiseMissingLinkIssue de-dups by deterministic id under rapid double-insert (#6)', () => {
      seedRootChild();
      // First insert raises missing-link-mlink. Pre-seed the SAME id with a
      // mismatched affectedNodeId to model the async addIssue lag: the guard must
      // reject by id alone, not by node match.
      mocks.curativeTitleIssues.push({
        id: 'missing-link-mlink2',
        issueType: 'Missing link',
        affectedNodeId: null,
        status: 'Open',
      });
      useWorkspaceStore.getState().insertMissingLink('child', 'mlink2');
      // Only the pre-existing row remains — no duplicate raise for the same id.
      expect(
        mocks.curativeTitleIssues.filter((i) => i.id === 'missing-link-mlink2')
      ).toHaveLength(1);
      expect(mocks.addCurativeIssue).not.toHaveBeenCalled();
    });
  });

  it('repairs an invalid active desk map id while loading a workspace', () => {
    const rootNode = {
      ...createBlankNode('node-1', null),
      grantee: 'Root Owner',
      instrument: 'Patent',
      initialFraction: '1.000000000',
      fraction: '1.000000000',
      numerator: '1',
      denominator: '1',
    };

    useWorkspaceStore.getState().loadWorkspace({
      workspaceId: 'ws-loaded',
      projectName: 'Loaded Workspace',
      nodes: [rootNode],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['node-1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'missing-desk-map',
      instrumentTypes: ['Deed'],
    });

    expect(useWorkspaceStore.getState().activeDeskMapId).toBe('dm-1');
    expect(useWorkspaceStore.getState().getActiveDeskMapNodes()).toEqual([
      expect.objectContaining({ id: 'node-1' }),
    ]);
  });

  it('adds nodes to the first desk map when the active desk map pointer is stale', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'missing-desk-map',
    });

    useWorkspaceStore.getState().addNodeToActiveDeskMap('node-99');

    const state = useWorkspaceStore.getState();
    expect(state.activeDeskMapId).toBe('dm-1');
    expect(state.deskMaps[0]?.nodeIds).toEqual(['node-99']);
    expect(state.deskMaps[1]?.nodeIds).toEqual([]);
  });

  it('tracks active unit code and creates new tracts inside the selected unit', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-a1',
          name: 'A Tract 1',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
        {
          id: 'dm-b1',
          name: 'B Tract 1',
          code: 'B1',
          tractId: 'B1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit B',
          unitCode: 'B',
        },
      ],
      activeDeskMapId: 'dm-a1',
      activeUnitCode: 'A',
    });

    useWorkspaceStore.getState().setActiveUnitCode('B');
    const newDeskMapId = useWorkspaceStore.getState().createDeskMap(
      'B Tract 2',
      'B2',
      [],
      {
        unitName: 'Raven Forest Unit B',
        unitCode: 'B',
      }
    );

    const state = useWorkspaceStore.getState();
    expect(state.activeUnitCode).toBe('B');
    expect(state.activeDeskMapId).toBe(newDeskMapId);
    expect(state.deskMaps.find((deskMap) => deskMap.id === newDeskMapId)).toEqual(
      expect.objectContaining({
        unitName: 'Raven Forest Unit B',
        unitCode: 'B',
      })
    );
  });

  it('defaults new unit-scope leasehold records to the active unit', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-a1',
          name: 'A Tract 1',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
      ],
      activeDeskMapId: 'dm-a1',
      activeUnitCode: 'A',
    });

    const assignmentId = useWorkspaceStore.getState().addLeaseholdAssignment({
      scope: 'unit',
      assignee: 'Caprock Resources',
    });
    const orriId = useWorkspaceStore.getState().addLeaseholdOrri({
      scope: 'unit',
      payee: 'Override Owner',
    });

    const state = useWorkspaceStore.getState();
    expect(state.leaseholdAssignments.find((item) => item.id === assignmentId)).toEqual(
      expect.objectContaining({ unitCode: 'A' })
    );
    expect(state.leaseholdOrris.find((item) => item.id === orriId)).toEqual(
      expect.objectContaining({ unitCode: 'A' })
    );
  });

  it('refreshes linked lease node display fields from the canonical lease record', () => {
    const parentNode = {
      ...createBlankNode('owner-node', null),
      grantee: 'Ava Moonwhistle',
      landDesc: 'Abstract 1, Example County, Texas',
      linkedOwnerId: 'owner-1',
      initialFraction: '1',
      fraction: '1',
    };
    const leaseNode = {
      ...createBlankNode('lease-node', 'owner-node'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      grantee: 'Old Lessee',
      remarks: 'stale remarks',
      linkedOwnerId: 'owner-1',
      linkedLeaseId: 'lease-1',
    };
    const lease = createBlankLease('ws-test', 'owner-1', {
      id: 'lease-1',
      leaseName: 'Updated Lease',
      lessee: 'Bluebonnet Operating',
      royaltyRate: '1/8',
      leasedInterest: '1',
      status: 'Active',
      docNo: '2026-1001',
      notes: 'Fresh notes',
    });

    useWorkspaceStore.setState({
      nodes: [parentNode, leaseNode],
    });

    useWorkspaceStore.getState().syncLeaseNodesFromRecord(lease);

    expect(useWorkspaceStore.getState().nodes).toEqual([
      expect.objectContaining({ id: 'owner-node' }),
      expect.objectContaining({
        id: 'lease-node',
        grantee: 'Bluebonnet Operating',
        docNo: '2026-1001',
        linkedLeaseId: 'lease-1',
      }),
    ]);
    expect(useWorkspaceStore.getState().nodes[1]?.remarks).toContain(
      'Lease: Updated Lease'
    );
    expect(useWorkspaceStore.getState().nodes[1]?.remarks).toContain(
      'Royalty: 1/8'
    );
  });

  it('neutralizes stale lessee card facts when a linked lease record is deleted', () => {
    const leaseNode = {
      ...createBlankNode('lease-node', 'owner-node'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      date: '2026-01-01',
      fileDate: '2026-01-02',
      docNo: '2026-1001',
      grantee: 'Old Lessee',
      remarks: 'Lease: Old Lease | Royalty: 1/8',
      linkedLeaseId: 'lease-1',
    };

    useWorkspaceStore.setState({
      nodes: [leaseNode],
    });

    useWorkspaceStore.getState().clearLinkedLease('lease-1');

    expect(useWorkspaceStore.getState().nodes[0]).toEqual(
      expect.objectContaining({
        linkedLeaseId: null,
        date: '',
        fileDate: '',
        docNo: '',
        grantee: '',
        remarks: 'Lease record removed; review or delete this lessee card.',
      })
    );
  });

  it('clears the active desk map nodes and scoped leasehold rows without deleting other tracts', async () => {
    const root = {
      ...createBlankNode('root-1', null),
      grantee: 'Root Owner',
      initialFraction: '1',
      fraction: '0.5',
      attachments: [
        {
          docId: 'doc-root-1',
          attachmentId: 'att-root-1',
          fileName: 'root.pdf',
          kind: 'deed' as const,
        },
      ],
    };
    const child = {
      ...createBlankNode('child-1', 'root-1'),
      grantee: 'Child Owner',
      initialFraction: '0.5',
      fraction: '0.5',
      attachments: [
        {
          docId: 'doc-child-1',
          attachmentId: 'att-child-1',
          fileName: 'child.pdf',
          kind: 'obit' as const,
        },
      ],
    };
    const otherRoot = {
      ...createBlankNode('root-2', null),
      grantee: 'Other Tract Owner',
      initialFraction: '1',
      fraction: '1',
    };

    useWorkspaceStore.setState({
      nodes: [root, child, otherRoot],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-1', 'child-1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-2'],
        },
      ],
      activeDeskMapId: 'dm-1',
      activeNodeId: 'child-1',
      leaseholdAssignments: [
        {
          id: 'assignment-1',
          assignor: '',
          assignee: '',
          scope: 'tract',
          deskMapId: 'dm-1',
          workingInterestFraction: '',
          effectiveDate: '',
          sourceDocNo: '',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-1',
          payee: '',
          scope: 'tract',
          deskMapId: 'dm-1',
          burdenFraction: '',
          burdenBasis: 'gross_8_8',
          effectiveDate: '',
          sourceDocNo: '',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdTransferOrderEntries: [
        {
          id: 'entry-1',
          sourceRowId: 'royalty-dm-1-owner-1',
          ownerNumber: '',
          status: 'draft',
          notes: '',
        },
        {
          id: 'entry-2',
          sourceRowId: 'assignment-other',
          ownerNumber: '',
          status: 'draft',
          notes: '',
        },
      ],
    });

    useWorkspaceStore.getState().clearDeskMapNodes('dm-1');
    // Cascades now run after the (mocked) undo capture settles.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = useWorkspaceStore.getState();
    expect(state.nodes.map((node) => node.id)).toEqual(['root-2']);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-1')?.nodeIds).toEqual([]);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-2')?.nodeIds).toEqual(['root-2']);
    expect(state.activeNodeId).toBeNull();
    expect(state.leaseholdAssignments).toEqual([]);
    expect(state.leaseholdOrris).toEqual([]);
    expect(state.leaseholdTransferOrderEntries).toEqual([
      expect.objectContaining({ sourceRowId: 'assignment-other' }),
    ]);
    // Cascade cleanup now removes attachment rows and only deletes orphaned docs.
    expect(mocks.deleteDocsForAttachments).toHaveBeenCalledWith([
      'att-root-1',
      'att-child-1',
    ]);
    expect(mocks.unlinkNode).toHaveBeenCalledWith('root-1');
    expect(mocks.unlinkNode).toHaveBeenCalledWith('child-1');
    expect(mocks.unlinkCurativeNode).toHaveBeenCalledWith('root-1');
    expect(mocks.unlinkCurativeNode).toHaveBeenCalledWith('child-1');
  });

  it('removes shared nodes from the cleared desk map without deleting their records', () => {
    const sharedRoot = {
      ...createBlankNode('shared-root', null),
      grantee: 'Shared Owner',
      initialFraction: '1',
      fraction: '1',
    };

    useWorkspaceStore.setState({
      nodes: [sharedRoot],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['shared-root'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['shared-root'],
        },
      ],
      activeDeskMapId: 'dm-1',
      activeNodeId: 'shared-root',
    });

    useWorkspaceStore.getState().clearDeskMapNodes('dm-1');

    const state = useWorkspaceStore.getState();
    expect(state.nodes.map((node) => node.id)).toEqual(['shared-root']);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-1')?.nodeIds).toEqual([]);
    expect(state.deskMaps.find((deskMap) => deskMap.id === 'dm-2')?.nodeIds).toEqual([
      'shared-root',
    ]);
    expect(mocks.deleteDocsForAttachments).not.toHaveBeenCalled();
    expect(mocks.unlinkNode).not.toHaveBeenCalled();
  });

  it('removes owner and lease records only linked to cleared desk map nodes', async () => {
    const clearedRoot = {
      ...createBlankNode('root-1', null),
      grantee: 'Cleared Owner',
      initialFraction: '1',
      fraction: '1',
      linkedOwnerId: 'owner-cleared',
    };
    const clearedLease = {
      ...createBlankNode('lease-node-1', 'root-1'),
      grantee: 'Cleared Lessee',
      initialFraction: '1',
      fraction: '1',
      linkedLeaseId: 'lease-cleared',
    };
    const survivingRoot = {
      ...createBlankNode('root-2', null),
      grantee: 'Surviving Owner',
      initialFraction: '1',
      fraction: '1',
      linkedOwnerId: 'owner-shared',
    };
    const sharedLease = {
      ...createBlankNode('lease-node-2', 'root-2'),
      grantee: 'Surviving Lessee',
      initialFraction: '1',
      fraction: '1',
      linkedLeaseId: 'lease-shared',
    };
    mocks.ownerState.leases = [
      { id: 'lease-cleared', ownerId: 'owner-cleared' },
      { id: 'lease-shared', ownerId: 'owner-shared' },
    ];

    useWorkspaceStore.setState({
      nodes: [clearedRoot, clearedLease, survivingRoot, sharedLease],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-2', 'lease-node-2'],
        },
      ],
    });

    useWorkspaceStore.getState().clearDeskMapNodes('dm-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.removeOwner).toHaveBeenCalledWith('owner-cleared');
    expect(mocks.removeOwner).not.toHaveBeenCalledWith('owner-shared');
    expect(mocks.removeLease).not.toHaveBeenCalledWith('lease-shared');
  });

  it('surfaces document cascade cleanup failures after deleting a branch', async () => {
    const root = {
      ...createBlankNode('root-1', null),
      initialFraction: '1',
      fraction: '1',
      attachments: [
        {
          docId: 'doc-root-1',
          attachmentId: 'att-root-1',
          fileName: 'root.pdf',
          kind: 'deed' as const,
        },
      ],
    };
    useWorkspaceStore.setState({ nodes: [root] });
    mocks.deleteDocsForAttachments.mockRejectedValueOnce(new Error('dexie failed'));

    useWorkspaceStore.getState().removeNode('root-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWorkspaceStore.getState().nodes).toEqual([]);
    expect(useWorkspaceStore.getState().lastError).toMatch(/Document cleanup failed/i);
    expect(useWorkspaceStore.getState().lastError).toMatch(/dexie failed/i);
  });

  it('rejects createRootNode when explicit deskMapId does not exist (audit M2)', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-real',
          name: 'Real Tract',
          code: 'R1',
          tractId: 'R1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-real',
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-x',
      '1',
      { grantee: 'Typed Wrong ID', instrument: 'Patent' },
      'dm-does-not-exist'
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(false);
    expect(state.nodes).toEqual([]);
    expect(state.deskMaps[0]?.nodeIds).toEqual([]);
    expect(state.lastError).toMatch(/not found/i);
  });

  it('batchAttachConveyance is atomic — one invalid orphan aborts all (audit M1)', () => {
    const parent = {
      ...createBlankNode('parent', null),
      grantee: 'Common Grantor',
      instrument: 'Patent',
      interestClass: 'mineral' as const,
      initialFraction: '1.000000000',
      fraction: '1.000000000',
    };
    const orphanA = {
      ...createBlankNode('orphan-a', null),
      grantee: 'Orphan A',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    const orphanB = {
      ...createBlankNode('orphan-b', null),
      grantee: 'Orphan B',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    useWorkspaceStore.setState({
      nodes: [parent, orphanA, orphanB],
      deskMaps: [],
    });

    const snapshotParentIds = () =>
      useWorkspaceStore.getState().nodes.map((n) => [n.id, n.parentId]);
    const before = snapshotParentIds();

    const result = useWorkspaceStore.getState().batchAttachConveyance([
      {
        activeNodeId: 'orphan-a',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
      {
        activeNodeId: 'does-not-exist',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.attached).toEqual([]);
    expect(result.failed).toHaveLength(1);
    // Critical: no parent IDs changed despite orphan-a being valid.
    expect(snapshotParentIds()).toEqual(before);
  });

  it('batchAttachConveyance commits all orphans when every item is valid (audit M1)', () => {
    const parent = {
      ...createBlankNode('parent', null),
      grantee: 'Common Grantor',
      instrument: 'Patent',
      interestClass: 'mineral' as const,
      initialFraction: '1.000000000',
      fraction: '1.000000000',
    };
    const orphanA = {
      ...createBlankNode('orphan-a', null),
      grantee: 'Orphan A',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    const orphanB = {
      ...createBlankNode('orphan-b', null),
      grantee: 'Orphan B',
      instrument: 'Deed',
      interestClass: 'mineral' as const,
      initialFraction: '0.250000000',
      fraction: '0.250000000',
    };
    useWorkspaceStore.setState({
      nodes: [parent, orphanA, orphanB],
      deskMaps: [],
    });

    const result = useWorkspaceStore.getState().batchAttachConveyance([
      {
        activeNodeId: 'orphan-a',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
      {
        activeNodeId: 'orphan-b',
        attachParentId: 'parent',
        calcShare: '0.25',
        form: {},
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.attached.sort()).toEqual(['orphan-a', 'orphan-b']);
    const parentIds = Object.fromEntries(
      useWorkspaceStore.getState().nodes.map((n) => [n.id, n.parentId])
    );
    expect(parentIds['orphan-a']).toBe('parent');
    expect(parentIds['orphan-b']).toBe('parent');
  });

  it('falls back to the active desk map when deskMapId is omitted', () => {
    useWorkspaceStore.setState({
      deskMaps: [
        {
          id: 'dm-active',
          name: 'Active Tract',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: [],
        },
      ],
      activeDeskMapId: 'dm-active',
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-y',
      '1',
      { grantee: 'Omitted DM', instrument: 'Patent' }
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(true);
    expect(state.deskMaps[0]?.nodeIds).toEqual(['root-y']);
  });

  it('createRootNode rejects a duplicate node id (DA-M2 — Add Root validation)', () => {
    useWorkspaceStore.setState({
      nodes: [{ ...createBlankNode('root-dup', null), initialFraction: '1', fraction: '1' }],
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-dup',
      '1',
      { grantee: 'Dup', instrument: 'Patent' }
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(false);
    expect(state.lastError).toBeTruthy();
    expect(state.nodes).toHaveLength(1);
  });

  it('createRootNode rejects a non-positive or over-1 initial fraction (DA-M2)', () => {
    const zero = useWorkspaceStore.getState().createRootNode('root-zero', '0', {});
    expect(zero).toBe(false);

    const over = useWorkspaceStore.getState().createRootNode('root-over', '1.5', {});
    expect(over).toBe(false);

    expect(useWorkspaceStore.getState().nodes).toHaveLength(0);
  });

  it('createRootNode allows a second independent root even at 100% total (DA-M2 — multi-tract working state stays editable)', () => {
    useWorkspaceStore.setState({
      nodes: [{ ...createBlankNode('root-1', null), initialFraction: '1', fraction: '1' }],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['root-1'],
        },
      ],
      activeDeskMapId: 'dm-1',
    });

    const ok = useWorkspaceStore.getState().createRootNode(
      'root-2',
      '1',
      { grantee: 'Second Tract Owner', instrument: 'Patent' }
    );

    const state = useWorkspaceStore.getState();
    expect(ok).toBe(true);
    expect(state.nodes).toHaveLength(2);
    expect(state.deskMaps.find((dm) => dm.id === 'dm-1')?.nodeIds).toContain('root-2');
  });
});
