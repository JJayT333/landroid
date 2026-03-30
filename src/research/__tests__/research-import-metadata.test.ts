import { describe, expect, it } from 'vitest';
import { createBlankResearchImport } from '../../types/research';
import {
  buildResearchImportFileFingerprint,
  createResearchImportMetadataDraft,
  researchImportMetadataDraftIsDirty,
} from '../research-import-metadata';

describe('research-import-metadata', () => {
  it('builds a local metadata draft from the saved import fields', () => {
    const researchImport = createBlankResearchImport(
      'ws-1',
      new Blob(['doc'], { type: 'text/plain' }),
      {
        fileName: 'permit.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: {
          title: 'Pending Permit',
          notes: 'Needs review',
        },
      }
    );

    expect(createResearchImportMetadataDraft(researchImport)).toEqual({
      title: 'Pending Permit',
      datasetId: 'drilling-permits',
      notes: 'Needs review',
    });
  });

  it('detects when the local draft matches the saved metadata exactly', () => {
    const researchImport = createBlankResearchImport(
      'ws-1',
      new Blob(['doc'], { type: 'text/plain' }),
      {
        fileName: 'permit.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: {
          title: 'Pending Permit',
          notes: 'Needs review',
        },
      }
    );

    const draft = createResearchImportMetadataDraft(researchImport);

    expect(researchImportMetadataDraftIsDirty(researchImport, draft)).toBe(false);
    expect(
      researchImportMetadataDraftIsDirty(researchImport, {
        ...draft,
        notes: 'Reviewed and staged',
      })
    ).toBe(true);
    expect(
      researchImportMetadataDraftIsDirty(researchImport, {
        ...draft,
        datasetId: 'wells',
      })
    ).toBe(true);
  });

  it('builds a stable file fingerprint from file-backed fields only', () => {
    const first = createBlankResearchImport(
      'ws-1',
      new Blob(['first'], { type: 'text/plain' }),
      {
        fileName: 'first.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: { id: 'imp-1', title: 'First file', notes: 'One' },
      }
    );
    const second = createBlankResearchImport(
      'ws-1',
      new Blob(['second'], { type: 'text/plain' }),
      {
        fileName: 'second.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: { id: 'imp-2', title: 'Second file', notes: 'Two' },
      }
    );

    const forward = buildResearchImportFileFingerprint([first, second]);
    const reversed = buildResearchImportFileFingerprint([second, first]);

    expect(forward).toBe(reversed);
    expect(forward).toContain('imp-1:first.txt:text/plain:5:0');
    expect(forward).toContain('imp-2:second.txt:text/plain:6:0');
  });

  it('changes the fingerprint when the decoder-relevant file inputs change', () => {
    const original = createBlankResearchImport(
      'ws-1',
      new Blob(['permit'], { type: 'text/plain' }),
      {
        fileName: 'pending.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: { id: 'imp-1' },
      }
    );
    const renamed = createBlankResearchImport(
      'ws-1',
      new Blob(['permit'], { type: 'text/plain' }),
      {
        fileName: 'pending-renamed.txt',
        mimeType: 'text/plain',
        datasetId: 'drilling-permits',
        overrides: { id: 'imp-1' },
      }
    );

    expect(buildResearchImportFileFingerprint([original])).not.toBe(
      buildResearchImportFileFingerprint([renamed])
    );
  });
});
