import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createBlankNode,
  type NodeAttachmentSummary,
} from '../../../types/node';
import DeskMapDocumentChips, {
  getAttachmentChipLabel,
} from '../DeskMapDocumentChips';

function makeAttachment(
  overrides: Partial<NodeAttachmentSummary> = {}
): NodeAttachmentSummary {
  return {
    docId: 'doc-1',
    attachmentId: 'att-1',
    fileName: 'a.pdf',
    kind: 'deed',
    ...overrides,
  };
}

describe('getAttachmentChipLabel', () => {
  it('prefers the attachment filename', () => {
    expect(
      getAttachmentChipLabel(
        makeAttachment({ fileName: 'lease-signed.pdf' }),
        { docNo: '20260001' }
      )
    ).toBe('lease-signed.pdf');
  });

  it('falls back to the node docNo when the attachment has no filename', () => {
    expect(
      getAttachmentChipLabel(makeAttachment({ fileName: '' }), {
        docNo: '20260001',
      })
    ).toBe('20260001.pdf');
  });

  it('falls back to "PDF attached" when both are empty', () => {
    expect(
      getAttachmentChipLabel(makeAttachment({ fileName: '' }), { docNo: '' })
    ).toBe('PDF attached');
  });
});

describe('DeskMapDocumentChips render output', () => {
  it('renders nothing when the node has no attachments', () => {
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips
        node={{ ...createBlankNode('n1') }}
        onViewDoc={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders one chip per attachment when under the visibility cap', () => {
    const node = {
      ...createBlankNode('n1'),
      attachments: [
        makeAttachment({ docId: 'd1', attachmentId: 'a1', fileName: '1.pdf' }),
        makeAttachment({ docId: 'd2', attachmentId: 'a2', fileName: '2.pdf' }),
      ],
    };
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} />
    );
    expect(html).toContain('1.pdf');
    expect(html).toContain('2.pdf');
    expect(html).toContain('data-attachment-id="a1"');
    expect(html).toContain('data-doc-id="d1"');
    expect(html).toContain('data-document-kind="deed"');
    expect(html).not.toContain('more');
    expect(html).not.toContain('show fewer');
  });

  it('caps at 4 visible chips by default and shows a "+N more" overflow chip', () => {
    const attachments = Array.from({ length: 7 }, (_, i) =>
      makeAttachment({
        docId: `d${i}`,
        attachmentId: `a${i}`,
        fileName: `${i}.pdf`,
      })
    );
    const node = { ...createBlankNode('n1'), attachments };
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} />
    );
    expect(html).toContain('0.pdf');
    expect(html).toContain('3.pdf');
    expect(html).not.toContain('4.pdf');
    expect(html).toContain('+3 more');
  });

  it('renders all chips when total <= maxVisible', () => {
    const attachments = Array.from({ length: 4 }, (_, i) =>
      makeAttachment({
        docId: `d${i}`,
        attachmentId: `a${i}`,
        fileName: `${i}.pdf`,
      })
    );
    const node = { ...createBlankNode('n1'), attachments };
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} />
    );
    for (let i = 0; i < 4; i += 1) {
      expect(html).toContain(`${i}.pdf`);
    }
    expect(html).not.toContain('more');
  });

  it('respects a custom maxVisible cap', () => {
    const attachments = Array.from({ length: 5 }, (_, i) =>
      makeAttachment({
        docId: `d${i}`,
        attachmentId: `a${i}`,
        fileName: `${i}.pdf`,
      })
    );
    const node = { ...createBlankNode('n1'), attachments };
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips
        node={node}
        onViewDoc={() => {}}
        maxVisible={2}
      />
    );
    expect(html).toContain('0.pdf');
    expect(html).toContain('1.pdf');
    expect(html).not.toContain('2.pdf');
    expect(html).toContain('+3 more');
  });

  it('uses tone-specific styling on the chip and overflow elements', () => {
    const attachments = Array.from({ length: 6 }, (_, i) =>
      makeAttachment({
        docId: `d${i}`,
        attachmentId: `a${i}`,
        fileName: `${i}.pdf`,
      })
    );
    const node = { ...createBlankNode('n1'), attachments };
    const leather = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} tone="leather" />
    );
    const emerald = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} tone="emerald" />
    );
    const amber = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} tone="amber" />
    );

    expect(leather).toContain('text-leather');
    expect(leather).not.toContain('text-tint-green-ink');
    expect(emerald).toContain('text-tint-green-ink');
    expect(amber).toContain('text-tint-amber-ink');
  });

  it('singularizes "more PDF" in the overflow tooltip when N === 1', () => {
    const attachments = Array.from({ length: 5 }, (_, i) =>
      makeAttachment({
        docId: `d${i}`,
        attachmentId: `a${i}`,
        fileName: `${i}.pdf`,
      })
    );
    const node = { ...createBlankNode('n1'), attachments };
    const html = renderToStaticMarkup(
      <DeskMapDocumentChips node={node} onViewDoc={() => {}} />
    );
    // 5 total, 4 visible → 1 overflow.
    expect(html).toContain('+1 more');
    expect(html).toContain('Show 1 more attached PDF"');
    // The plural form is "PDFs", which we do NOT want here.
    expect(html).not.toContain('1 more attached PDFs');
  });
});
