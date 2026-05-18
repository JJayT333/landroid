import { describe, expect, it } from 'vitest';
import {
  createBlankNode,
  normalizeOwnershipNode,
  type NodeAttachmentSummary,
} from '../node';

const validAttachment: NodeAttachmentSummary = {
  docId: 'doc-1',
  attachmentId: 'att-1',
  fileName: 'deed.pdf',
  kind: 'deed',
};

describe('OwnershipNode.attachments[] (Phase 5)', () => {
  it('createBlankNode initializes an empty attachments array', () => {
    const node = createBlankNode('node-1');
    expect(node.attachments).toEqual([]);
  });

  it('normalizeOwnershipNode preserves a valid attachments array', () => {
    const node = normalizeOwnershipNode({
      id: 'node-1',
      attachments: [validAttachment],
    });
    expect(node.attachments).toEqual([validAttachment]);
  });

  it('falls back to [] when attachments is missing', () => {
    const node = normalizeOwnershipNode({ id: 'node-1' });
    expect(node.attachments).toEqual([]);
  });

  it('falls back to [] when attachments is not an array', () => {
    const node = normalizeOwnershipNode({
      id: 'node-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: 'oops' as any,
    });
    expect(node.attachments).toEqual([]);
  });

  it('drops entries without a docId or attachmentId', () => {
    const node = normalizeOwnershipNode({
      id: 'node-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: [
        { docId: '', attachmentId: 'att-1', fileName: 'x.pdf', kind: 'deed' },
        { docId: 'd-2', attachmentId: '', fileName: 'y.pdf', kind: 'deed' },
        validAttachment,
        null,
        'bare',
      ] as any,
    });
    expect(node.attachments).toEqual([validAttachment]);
  });

  it('coerces an unknown kind to "other"', () => {
    const node = normalizeOwnershipNode({
      id: 'node-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: [
        {
          docId: 'doc-1',
          attachmentId: 'att-1',
          fileName: 'mystery.pdf',
          kind: 'mystery_kind',
        },
      ] as any,
    });
    expect(node.attachments[0].kind).toBe('other');
  });

  it('defaults a missing fileName to empty string (not undefined)', () => {
    const node = normalizeOwnershipNode({
      id: 'node-1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: [
        {
          docId: 'doc-1',
          attachmentId: 'att-1',
          kind: 'deed',
        },
      ] as any,
    });
    expect(node.attachments[0].fileName).toBe('');
  });

  it('preserves attachment ordering', () => {
    const entries: NodeAttachmentSummary[] = [
      { docId: 'd1', attachmentId: 'a1', fileName: '1.pdf', kind: 'deed' },
      { docId: 'd2', attachmentId: 'a2', fileName: '2.pdf', kind: 'obit' },
      {
        docId: 'd3',
        attachmentId: 'a3',
        fileName: '3.pdf',
        kind: 'affidavit',
      },
    ];
    const node = normalizeOwnershipNode({ id: 'n', attachments: entries });
    expect(node.attachments.map((a) => a.docId)).toEqual(['d1', 'd2', 'd3']);
  });

  it('throws on malformed persisted fraction text instead of coercing to 0', () => {
    expect(() =>
      normalizeOwnershipNode({
        id: 'node-bad-fraction',
        fraction: 'not-a-number',
      })
    ).toThrow(/invalid fraction/i);
  });

  it('throws on negative persisted initialFraction values', () => {
    expect(() =>
      normalizeOwnershipNode({
        id: 'node-negative',
        initialFraction: '-0.25',
      })
    ).toThrow(/invalid initialFraction/i);
  });
});
