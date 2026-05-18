import { describe, expect, it } from 'vitest';
import { shouldShowDemoDataMenu } from '../navbar-policy';

describe('navbar hosted policy', () => {
  it('hides demo data in hosted mode to avoid overwriting a signed-in workspace', () => {
    expect(shouldShowDemoDataMenu(true)).toBe(false);
  });

  it('keeps demo data available for local fixture workflows', () => {
    expect(shouldShowDemoDataMenu(false)).toBe(true);
  });
});
