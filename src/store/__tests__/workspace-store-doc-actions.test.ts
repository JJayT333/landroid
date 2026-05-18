import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import { createBlankNode, type NodeAttachmentSummary } from '../../types/node';
import type {
  DocumentAttachment,
  DocumentRecord,
} from '../../types/document';

const docMocks = vi.hoisted(() => ({
  saveDoc: vi.fn(),
  deleteDocsForAttachments: vi.fn(),
  detachDocFromEntity: vi.fn(),
  renameDoc: vi.fn(),
  reorderAttachments: vi.fn(),
  listAttachmentsForNodes: vi.fn(),
}));

const otherMocks = vi.hoisted(() => ({
  unlinkDeskMap: vi.fn(),
  unlinkNode: vi.fn(),
  deletePdf: vi.fn(),
  unlinkCurativeNode: vi.fn(),
}));

vi.mock('../../storage/document-store', () => ({
  saveDoc: docMocks.saveDoc,
  deleteDocsForAttachments: docMocks.deleteDocsForAttachments,
  detachDocFromEntity: docMocks.detachDocFromEntity,
  renameDoc: docMocks.renameDoc,
  reorderAttachments: docMocks.reorderAttachments,
  listAttachmentsForNodes: docMocks.listAttachmentsForNodes,
}));

vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkDeskMap: otherMocks.unlinkDeskMap,
      unlinkNode: otherMocks.unlinkNode,
    }),
  },
}));

vi.mock('../../storage/pdf-store', () => ({
  deletePdf: otherMocks.deletePdf,
}));

vi.mock('../curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkCurativeNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));

import { useWorkspaceStore } from '../workspace-store';

function fakeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-test',
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    byteLength: 8,
    contentHash: 'h',
    blob: new Blob([new Uint8Array(8)]),
    kind: 'deed',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

function fakeAttachment(
  overrides: Partial<DocumentAttachment> = {}
): DocumentAttachment {
  return {
    attachmentId: 'att-1',
    workspaceId: 'ws-test',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

function seed(nodes: { id: string; attachments?: NodeAttachmentSummary[] }[] = []) {
  useWorkspaceStore.setState({
    workspaceId: 'ws-test',
    projectName: 'Doc Actions Test',
    nodes: nodes.map((spec) => ({
      ...createBlankNode(spec.id),
      attachments: spec.attachments ?? [],
    })),
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
}

describe('workspace-store document actions (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attachDocToNode', () => {
    it('persists through saveDoc and appends to the node attachments cache', async () => {
      seed([{ id: 'node-1' }]);
      docMocks.saveDoc.mockResolvedValue({
        document: fakeDocument({ docId: 'doc-1', fileName: 'a.pdf', kind: 'deed' }),
        attachment: fakeAttachment({ attachmentId: 'att-1', docId: 'doc-1' }),
      });

      const file = new File([new Uint8Array(8)], 'a.pdf', {
        type: 'application/pdf',
      });
      const summary = await useWorkspaceStore.getState().attachDocToNode(
        'node-1',
        file,
        { kind: 'deed' }
      );

      expect(docMocks.saveDoc).toHaveBeenCalledOnce();
      expect(docMocks.saveDoc.mock.calls[0][0]).toMatchObject({
        workspaceId: 'ws-test',
        entityKind: 'node',
        entityId: 'node-1',
        kind: 'deed',
      });
      expect(summary).toEqual({
        docId: 'doc-1',
        attachmentId: 'att-1',
        fileName: 'a.pdf',
        kind: 'deed',
      });
      expect(useWorkspaceStore.getState().nodes[0].attachments).toEqual([summary]);
    });

    it('returns null without writing when the node id does not exist', async () => {
      seed([{ id: 'node-1' }]);
      const summary = await useWorkspaceStore.getState().attachDocToNode(
        'missing',
        new Blob([new Uint8Array(1)])
      );
      expect(summary).toBeNull();
      expect(docMocks.saveDoc).not.toHaveBeenCalled();
    });

    it('preserves existing attachments when appending', async () => {
      const existing: NodeAttachmentSummary = {
        docId: 'doc-pre',
        attachmentId: 'att-pre',
        fileName: 'pre.pdf',
        kind: 'obit',
      };
      seed([{ id: 'node-1', attachments: [existing] }]);
      docMocks.saveDoc.mockResolvedValue({
        document: fakeDocument({ docId: 'doc-new', fileName: 'new.pdf' }),
        attachment: fakeAttachment({ attachmentId: 'att-new', docId: 'doc-new' }),
      });

      await useWorkspaceStore.getState().attachDocToNode(
        'node-1',
        new Blob([new Uint8Array(2)])
      );

      const updated = useWorkspaceStore.getState().nodes[0].attachments;
      expect(updated.map((a) => a.attachmentId)).toEqual(['att-pre', 'att-new']);
    });
  });

  describe('detachDocFromNode', () => {
    it('detaches the attachment row and removes it from the cache', async () => {
      seed([
        {
          id: 'node-1',
          attachments: [
            {
              docId: 'doc-keep',
              attachmentId: 'att-keep',
              fileName: 'keep.pdf',
              kind: 'deed',
            },
            {
              docId: 'doc-drop',
              attachmentId: 'att-drop',
              fileName: 'drop.pdf',
              kind: 'other',
            },
          ],
        },
      ]);
      docMocks.detachDocFromEntity.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().detachDocFromNode('node-1', 'att-drop');

      expect(docMocks.detachDocFromEntity).toHaveBeenCalledWith('att-drop');
      expect(useWorkspaceStore.getState().nodes[0].attachments).toEqual([
        {
          docId: 'doc-keep',
          attachmentId: 'att-keep',
          fileName: 'keep.pdf',
          kind: 'deed',
        },
      ]);
    });

    it('is a no-op if the attachment is not on the node', async () => {
      seed([{ id: 'node-1' }]);
      await useWorkspaceStore.getState().detachDocFromNode('node-1', 'missing');
      expect(docMocks.detachDocFromEntity).not.toHaveBeenCalled();
    });
  });

  describe('renameDocOnNode', () => {
    it('renames the doc in Dexie and updates the cache on every node that references it', async () => {
      seed([
        {
          id: 'node-1',
          attachments: [
            {
              docId: 'doc-shared',
              attachmentId: 'att-a',
              fileName: 'old.pdf',
              kind: 'deed',
            },
          ],
        },
        {
          id: 'node-2',
          attachments: [
            {
              docId: 'doc-shared',
              attachmentId: 'att-b',
              fileName: 'old.pdf',
              kind: 'deed',
            },
            {
              docId: 'doc-other',
              attachmentId: 'att-c',
              fileName: 'untouched.pdf',
              kind: 'obit',
            },
          ],
        },
      ]);
      docMocks.renameDoc.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().renameDocOnNode('doc-shared', '  new.pdf  ');

      expect(docMocks.renameDoc).toHaveBeenCalledWith('doc-shared', 'new.pdf');
      const nodes = useWorkspaceStore.getState().nodes;
      expect(nodes[0].attachments[0].fileName).toBe('new.pdf');
      expect(nodes[1].attachments[0].fileName).toBe('new.pdf');
      expect(nodes[1].attachments[1].fileName).toBe('untouched.pdf');
    });

    it('rejects an empty / whitespace-only name without touching Dexie', async () => {
      seed([
        {
          id: 'node-1',
          attachments: [
            {
              docId: 'doc-1',
              attachmentId: 'att-1',
              fileName: 'before.pdf',
              kind: 'deed',
            },
          ],
        },
      ]);
      await useWorkspaceStore.getState().renameDocOnNode('doc-1', '   ');
      expect(docMocks.renameDoc).not.toHaveBeenCalled();
      expect(useWorkspaceStore.getState().nodes[0].attachments[0].fileName).toBe(
        'before.pdf'
      );
    });
  });

  describe('reorderNodeAttachments', () => {
    it('persists the new order and reflects it in the cache', async () => {
      seed([
        {
          id: 'node-1',
          attachments: [
            { docId: 'd1', attachmentId: 'a1', fileName: '1.pdf', kind: 'deed' },
            { docId: 'd2', attachmentId: 'a2', fileName: '2.pdf', kind: 'obit' },
            {
              docId: 'd3',
              attachmentId: 'a3',
              fileName: '3.pdf',
              kind: 'affidavit',
            },
          ],
        },
      ]);
      docMocks.reorderAttachments.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().reorderNodeAttachments('node-1', [
        'a3',
        'a1',
        'a2',
      ]);

      expect(docMocks.reorderAttachments).toHaveBeenCalledWith(
        'node',
        'node-1',
        ['a3', 'a1', 'a2']
      );
      const order = useWorkspaceStore
        .getState()
        .nodes[0].attachments.map((a) => a.attachmentId);
      expect(order).toEqual(['a3', 'a1', 'a2']);
    });

    it('appends unnamed attachments at the end in their original order', async () => {
      seed([
        {
          id: 'node-1',
          attachments: [
            { docId: 'd1', attachmentId: 'a1', fileName: '1.pdf', kind: 'deed' },
            { docId: 'd2', attachmentId: 'a2', fileName: '2.pdf', kind: 'obit' },
            {
              docId: 'd3',
              attachmentId: 'a3',
              fileName: '3.pdf',
              kind: 'affidavit',
            },
          ],
        },
      ]);
      docMocks.reorderAttachments.mockResolvedValue(undefined);

      // Only re-rank a3; a1 and a2 keep their relative order behind it.
      await useWorkspaceStore.getState().reorderNodeAttachments('node-1', ['a3']);

      const order = useWorkspaceStore
        .getState()
        .nodes[0].attachments.map((a) => a.attachmentId);
      expect(order).toEqual(['a3', 'a1', 'a2']);
    });

    it('is a no-op when the node id is unknown', async () => {
      seed([{ id: 'node-1' }]);
      await useWorkspaceStore
        .getState()
        .reorderNodeAttachments('missing', ['a1']);
      expect(docMocks.reorderAttachments).not.toHaveBeenCalled();
    });
  });

  describe('hydrateNodeAttachments', () => {
    it('replaces in-memory attachments with the order returned from Dexie', async () => {
      // listAttachmentsForNodes is responsible for sorting by position
      // (covered by its own tests). The store action trusts that order and
      // does not re-sort.
      seed([{ id: 'node-1' }, { id: 'node-2' }]);
      docMocks.listAttachmentsForNodes.mockResolvedValue(
        new Map([
          [
            'node-1',
            [
              {
                attachmentId: 'att-1a',
                docId: 'doc-1a',
                position: 0,
                fileName: 'a.pdf',
                kind: 'deed',
              },
              {
                attachmentId: 'att-1b',
                docId: 'doc-1b',
                position: 1,
                fileName: 'b.pdf',
                kind: 'obit',
              },
            ],
          ],
        ])
      );

      await useWorkspaceStore.getState().hydrateNodeAttachments();

      expect(docMocks.listAttachmentsForNodes).toHaveBeenCalledWith(
        'ws-test',
        ['node-1', 'node-2']
      );
      const [n1, n2] = useWorkspaceStore.getState().nodes;
      expect(n1.attachments.map((a) => a.attachmentId)).toEqual([
        'att-1a',
        'att-1b',
      ]);
      expect(n1.attachments[0].fileName).toBe('a.pdf');
      expect(n1.attachments[0].kind).toBe('deed');
      expect(n2.attachments).toEqual([]);
    });

    it('is a no-op when there are no nodes', async () => {
      seed([]);
      await useWorkspaceStore.getState().hydrateNodeAttachments();
      expect(docMocks.listAttachmentsForNodes).not.toHaveBeenCalled();
    });

    it('leaves existing attachments alone when Dexie returns an empty map', async () => {
      const preExisting = [
        {
          docId: 'd1',
          attachmentId: 'a1',
          fileName: '1.pdf',
          kind: 'deed' as const,
        },
      ];
      seed([{ id: 'node-1', attachments: preExisting }]);
      docMocks.listAttachmentsForNodes.mockResolvedValue(new Map());
      await useWorkspaceStore.getState().hydrateNodeAttachments();
      expect(useWorkspaceStore.getState().nodes[0].attachments).toEqual(
        preExisting
      );
    });
  });
});
