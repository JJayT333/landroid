/**
 * DA-H3 — verdict plumbing between the title journal hook and the store's
 * mutators, tested with a fake hook (the real hook's cutover behavior is
 * covered in title-action-log.test.ts). Pins three contracts:
 * a {rolledBack: true} verdict makes mutators report failure and skip
 * cascades; a void return (legacy hook) means not-rolled-back; and a hook
 * exception is surfaced as lastError instead of being swallowed, with the
 * mutation left standing (the hook owns its cutover rollback internally).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankNode, normalizeOwnershipNode, type OwnershipNode } from '../../types/node';

const docMocks = vi.hoisted(() => ({
  deleteDocsForAttachments: vi.fn(async () => {}),
  detachDocFromEntity: vi.fn(async () => {}),
  renameDoc: vi.fn(async () => {}),
  reorderAttachments: vi.fn(async () => {}),
  listAttachmentsForNodes: vi.fn(async () => new Map()),
  saveDoc: vi.fn(),
}));
const otherMocks = vi.hoisted(() => ({ unlinkNode: vi.fn(), unlinkDeskMap: vi.fn() }));

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({ unlinkNode: otherMocks.unlinkNode, unlinkDeskMap: otherMocks.unlinkDeskMap }),
  },
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

import { setTitleJournalHook, useWorkspaceStore } from '../workspace-store';

function titleNode(overrides: Partial<OwnershipNode> & { id: string }): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(overrides.id), ...overrides });
}

function seed(): void {
  useWorkspaceStore.setState({
    workspaceId: 'ws-verdict',
    projectName: 'Verdict Test',
    nodes: [
      titleNode({
        id: 'root',
        grantee: 'Root Owner',
        fraction: '0.500000000',
        initialFraction: '1.000000000',
        interestClass: 'mineral',
      }),
      titleNode({
        id: 'child',
        parentId: 'root',
        grantee: 'Child Owner',
        fraction: '0.500000000',
        initialFraction: '0.500000000',
        interestClass: 'mineral',
      }),
    ],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: null,
        grossAcres: '',
        pooledAcres: '',
        description: '',
        nodeIds: ['root', 'child'],
      },
    ],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: [],
    lastError: null,
    lastAudit: null,
    activeNodeId: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seed();
});

afterEach(() => {
  setTitleJournalHook(null);
});

describe('title journal verdict plumbing (DA-H3)', () => {
  it('a rolledBack verdict makes mutators fail and skips removeNode cascades', () => {
    setTitleJournalHook(() => ({ rolledBack: true }));

    const ok = useWorkspaceStore.getState().convey('root', 'c2', '0.1', { grantee: 'C2' });
    expect(ok).toBe(false);
    expect(useWorkspaceStore.getState().lastError).toMatch(/Mutation reverted: cutover parity divergence/);

    vi.clearAllMocks();
    useWorkspaceStore.getState().removeNode('child');
    expect(docMocks.deleteDocsForAttachments).not.toHaveBeenCalled();
    expect(otherMocks.unlinkNode).not.toHaveBeenCalled();
  });

  it('a void hook return (legacy shape) means not rolled back', () => {
    setTitleJournalHook(() => undefined);

    const ok = useWorkspaceStore.getState().convey('root', 'c2', '0.1', { grantee: 'C2' });
    expect(ok).toBe(true);
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'c2')).toBe(true);
    expect(useWorkspaceStore.getState().lastError).toBeNull();
  });

  it('a hook exception surfaces as lastError and the mutation stands', () => {
    setTitleJournalHook(() => {
      throw new Error('journal exploded');
    });

    const ok = useWorkspaceStore.getState().convey('root', 'c2', '0.1', { grantee: 'C2' });
    expect(ok).toBe(true);
    expect(useWorkspaceStore.getState().nodes.some((n) => n.id === 'c2')).toBe(true);
    expect(useWorkspaceStore.getState().lastError).toMatch(/Title journal hook failed for convey: journal exploded/);
  });
});
