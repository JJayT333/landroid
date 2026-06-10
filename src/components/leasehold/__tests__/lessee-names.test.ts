import { describe, expect, it } from 'vitest';

import { distinctLesseeNames } from '../lessee-names';

function lease(lessee: string) {
  return { lessee };
}

describe('distinctLesseeNames', () => {
  it('returns distinct lessees sorted alphabetically', () => {
    const names = distinctLesseeNames([
      lease('Permian Resources'),
      lease('Apache Corp'),
      lease('Permian Resources'),
      lease('COG Operating LLC'),
    ]);

    expect(names).toEqual([
      'Apache Corp',
      'COG Operating LLC',
      'Permian Resources',
    ]);
  });

  it('dedupes case-insensitively, preserving first-seen casing', () => {
    const names = distinctLesseeNames([
      lease('COG Operating LLC'),
      lease('cog operating llc'),
      lease('Cog Operating Llc'),
    ]);

    expect(names).toEqual(['COG Operating LLC']);
  });

  it('drops empty and whitespace-only lessees, trimming the rest', () => {
    const names = distinctLesseeNames([
      lease(''),
      lease('   '),
      lease('  Apache Corp  '),
    ]);

    expect(names).toEqual(['Apache Corp']);
  });

  it('returns an empty list for no leases', () => {
    expect(distinctLesseeNames([])).toEqual([]);
  });
});
