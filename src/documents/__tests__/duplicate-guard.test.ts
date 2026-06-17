import { describe, expect, it } from 'vitest';
import {
  buildDuplicateInspection,
  hasDuplicates,
} from '../duplicate-guard';

const HASH = 'a'.repeat(64);

describe('buildDuplicateInspection', () => {
  it('reports no matches when nothing in the workspace shares the bytes', () => {
    const inspection = buildDuplicateInspection(HASH, []);
    expect(inspection.contentHash).toBe(HASH);
    expect(inspection.matches).toEqual([]);
    expect(hasDuplicates(inspection)).toBe(false);
  });

  it('projects every byte-identical existing document into a match (no blob)', () => {
    const inspection = buildDuplicateInspection(HASH, [
      {
        docId: 'doc-1',
        fileName: 'mineral-deed.pdf',
        kind: 'deed',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        docId: 'doc-2',
        fileName: 'deed-rescan.pdf',
        kind: 'related',
        createdAt: '2026-03-04T00:00:00.000Z',
      },
    ]);

    expect(hasDuplicates(inspection)).toBe(true);
    expect(inspection.matches).toEqual([
      {
        docId: 'doc-1',
        fileName: 'mineral-deed.pdf',
        kind: 'deed',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        docId: 'doc-2',
        fileName: 'deed-rescan.pdf',
        kind: 'related',
        createdAt: '2026-03-04T00:00:00.000Z',
      },
    ]);
    // carries only display metadata — never the blob.
    expect(Object.keys(inspection.matches[0])).toEqual([
      'docId',
      'fileName',
      'kind',
      'createdAt',
    ]);
  });
});
