import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  getPageDimensions,
  getPageSizeOptionLabel,
  getPageSizeDefinition,
  getPrintPageSize,
} from '../flowchart-pages';

describe('flowchart-pages', () => {
  it('defaults to ANSI A', () => {
    expect(DEFAULT_PAGE_SIZE).toBe('ansi-a');
    expect(getPageSizeDefinition(DEFAULT_PAGE_SIZE).label).toContain('ANSI A');
  });

  it('returns landscape and portrait dimensions for ANSI B', () => {
    const landscape = getPageDimensions('ansi-b', 'landscape');
    const portrait = getPageDimensions('ansi-b', 'portrait');

    expect(landscape.pw).toBe(1632);
    expect(landscape.ph).toBe(1056);
    expect(portrait.pw).toBe(1056);
    expect(portrait.ph).toBe(1632);
  });

  it('formats custom print page sizes for larger sheets', () => {
    expect(getPrintPageSize('arch-e', 'landscape')).toBe('48in 36in');
    expect(getPrintPageSize('arch-e', 'portrait')).toBe('36in 48in');
  });

  it('includes inch dimensions in the paper option label', () => {
    expect(getPageSizeOptionLabel('ansi-a')).toBe('ANSI A (Letter) - 8.5" x 11"');
    expect(getPageSizeOptionLabel('arch-d')).toBe('Arch D - 24" x 36"');
  });
});
