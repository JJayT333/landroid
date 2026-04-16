import { describe, expect, it } from 'vitest';
import { buildCombinatorialWorkspaceData } from '../seed-test-data';

describe('buildCombinatorialWorkspaceData', () => {
  it('keeps owner-card names unique across the combinatorial sample', () => {
    const workspace = buildCombinatorialWorkspaceData();
    const visiblePartyNames = workspace.nodes
      .filter((node) => node.type !== 'related')
      .map((node) => node.grantee.trim())
      .filter((name) => name.length > 0);

    expect(visiblePartyNames.length).toBeGreaterThan(0);
    expect(new Set(visiblePartyNames).size).toBe(visiblePartyNames.length);
  });

  it('marks combinatorial fixed NPRI demo nodes as whole-tract burdens', () => {
    const workspace = buildCombinatorialWorkspaceData();
    const fixedNpriNodes = workspace.nodes.filter(
      (node) => node.type !== 'related'
        && node.interestClass === 'npri'
        && node.royaltyKind === 'fixed'
    );

    expect(fixedNpriNodes.length).toBeGreaterThan(0);
    expect(fixedNpriNodes.every((node) => node.fixedRoyaltyBasis === 'whole_tract')).toBe(true);
  });
});
