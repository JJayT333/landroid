import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import { getDeskMapDocumentLabel } from '../DeskMapDocumentBadge';

describe('getDeskMapDocumentLabel', () => {
  it('uses the stored attachment filename when available', () => {
    expect(
      getDeskMapDocumentLabel({
        ...createBlankNode('node-1'),
        hasDoc: true,
        docFileName: 'lease-signed.pdf',
        docNo: '20260001',
      })
    ).toBe('lease-signed.pdf');
  });

  it('falls back to the document number for older nodes', () => {
    expect(
      getDeskMapDocumentLabel({
        ...createBlankNode('node-1'),
        hasDoc: true,
        docFileName: '',
        docNo: '20260001',
      })
    ).toBe('20260001.pdf');
  });

  it('returns null when no PDF is attached', () => {
    expect(getDeskMapDocumentLabel(createBlankNode('node-1'))).toBeNull();
  });
});
