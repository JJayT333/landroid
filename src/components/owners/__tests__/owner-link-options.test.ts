import { describe, expect, it } from 'vitest';
import { createBlankOwner } from '../../../types/owner';
import {
  buildOwnerLinkOptions,
  resolveExistingOwnerSelection,
} from '../owner-link-options';

describe('owner-link-options', () => {
  it('builds sorted owner choices with county and prospect context', () => {
    const options = buildOwnerLinkOptions([
      createBlankOwner('ws-1', {
        id: 'owner-b',
        name: 'Bravo Minerals',
        county: 'Reeves',
        prospect: 'Raven Bend',
      }),
      createBlankOwner('ws-1', {
        id: 'owner-a',
        name: 'Alpha Minerals',
        county: 'Loving',
      }),
    ]);

    expect(options).toEqual([
      {
        id: 'owner-a',
        label: 'Alpha Minerals',
        detail: 'Loving',
      },
      {
        id: 'owner-b',
        label: 'Bravo Minerals',
        detail: 'Reeves • Raven Bend',
      },
    ]);
  });

  it('only resolves owner ids that are still present in the picker', () => {
    const options = buildOwnerLinkOptions([
      createBlankOwner('ws-1', { id: 'owner-a', name: 'Alpha Minerals' }),
    ]);

    expect(resolveExistingOwnerSelection(options, 'owner-a')).toBe('owner-a');
    expect(resolveExistingOwnerSelection(options, 'missing-owner')).toBeNull();
    expect(resolveExistingOwnerSelection(options, '')).toBeNull();
  });
});
