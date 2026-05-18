import { describe, expect, it } from 'vitest';
import { shouldShowDemoDataMenu } from '../navbar-policy';

describe('navbar hosted policy', () => {
  it('shows demo data in hosted mode for signed-in POC fixture workflows', () => {
    expect(shouldShowDemoDataMenu()).toBe(true);
  });

  it('keeps demo data available for local fixture workflows', () => {
    expect(shouldShowDemoDataMenu()).toBe(true);
  });
});
