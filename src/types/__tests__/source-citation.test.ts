import { describe, expect, it } from 'vitest';
import {
  normalizeSourceCitation,
  normalizeSourceCitations,
} from '../source-citation';

describe('normalizeSourceCitation', () => {
  it('preserves a full citation', () => {
    expect(
      normalizeSourceCitation({
        docId: 'doc-1',
        page: 3,
        label: 'royalty clause',
        note: 'reviewer initialed',
      })
    ).toEqual({
      docId: 'doc-1',
      page: 3,
      label: 'royalty clause',
      note: 'reviewer initialed',
    });
  });

  it('returns null when docId is missing or non-string', () => {
    expect(normalizeSourceCitation({ page: 1 })).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeSourceCitation({ docId: 42 } as any)).toBeNull();
    expect(normalizeSourceCitation({ docId: '   ' })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeSourceCitation(null)).toBeNull();
    expect(normalizeSourceCitation(undefined)).toBeNull();
    expect(normalizeSourceCitation('doc-1')).toBeNull();
    expect(normalizeSourceCitation([])).toBeNull();
    expect(normalizeSourceCitation(42)).toBeNull();
  });

  it('drops page values that are not positive finite integers', () => {
    expect(normalizeSourceCitation({ docId: 'd', page: 0 })?.page).toBeUndefined();
    expect(normalizeSourceCitation({ docId: 'd', page: -3 })?.page).toBeUndefined();
    expect(normalizeSourceCitation({ docId: 'd', page: Number.NaN })?.page).toBeUndefined();
    expect(normalizeSourceCitation({ docId: 'd', page: Infinity })?.page).toBeUndefined();
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeSourceCitation({ docId: 'd', page: '3' as any })?.page
    ).toBeUndefined();
  });

  it('floors fractional page numbers', () => {
    expect(normalizeSourceCitation({ docId: 'd', page: 3.7 })?.page).toBe(3);
  });

  it('drops whitespace-only labels and notes', () => {
    const c = normalizeSourceCitation({
      docId: 'd',
      label: '   ',
      note: '',
    });
    expect(c?.label).toBeUndefined();
    expect(c?.note).toBeUndefined();
  });
});

describe('normalizeSourceCitations', () => {
  it('returns undefined (not []) for non-arrays', () => {
    expect(normalizeSourceCitations(undefined)).toBeUndefined();
    expect(normalizeSourceCitations(null)).toBeUndefined();
    expect(normalizeSourceCitations({})).toBeUndefined();
  });

  it('returns undefined when every entry is unusable', () => {
    expect(
      normalizeSourceCitations([{ page: 1 }, 'bare', null])
    ).toBeUndefined();
  });

  it('preserves order and drops invalid entries', () => {
    expect(
      normalizeSourceCitations([
        { docId: 'a' },
        { page: 1 },
        { docId: 'b', page: 2 },
      ])
    ).toEqual([{ docId: 'a' }, { docId: 'b', page: 2 }]);
  });
});
