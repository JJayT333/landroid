import { describe, expect, it } from 'vitest';
import { createBlankNode, type NodeAttachmentSummary } from '../../../types/node';
import { getDeskMapDocumentLabel } from '../DeskMapDocumentBadge';

const sampleAttachment: NodeAttachmentSummary = {
  docId: 'doc-1',
  attachmentId: 'att-1',
  fileName: 'lease-signed.pdf',
  kind: 'lease',
};

describe('getDeskMapDocumentLabel', () => {
  it('uses the first attachment filename when available', () => {
    expect(
      getDeskMapDocumentLabel({
        ...createBlankNode('node-1'),
        attachments: [sampleAttachment],
        docNo: '20260001',
      })
    ).toBe('lease-signed.pdf');
  });

  it('falls back to the document number when the attachment has no filename', () => {
    expect(
      getDeskMapDocumentLabel({
        ...createBlankNode('node-1'),
        attachments: [{ ...sampleAttachment, fileName: '' }],
        docNo: '20260001',
      })
    ).toBe('20260001.pdf');
  });

  it('falls back to a generic placeholder when filename and docNo are both empty', () => {
    expect(
      getDeskMapDocumentLabel({
        ...createBlankNode('node-1'),
        attachments: [{ ...sampleAttachment, fileName: '' }],
        docNo: '',
      })
    ).toBe('PDF attached');
  });

  it('returns null when no documents are attached', () => {
    expect(getDeskMapDocumentLabel(createBlankNode('node-1'))).toBeNull();
  });
});
