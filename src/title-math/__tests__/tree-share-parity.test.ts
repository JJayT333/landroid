/**
 * Differential parity: the new tree-share calculator must produce byte-identical
 * live ownership fractions (grant / remaining / relative share) to the live
 * tree-layout implementation across all three real project graphs.
 */
import { describe, expect, it } from 'vitest';

import { computeLiveOwnershipFractions as oldCompute } from '../../engine/tree-layout';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import type { LiveOwnershipFractions } from '../../engine/tree-layout';
import { loadRavenForest, loadSpringhill, loadVulcanMesa } from '../__diff__/projects';
import { computeLiveOwnershipFractions as newCompute } from '../calculators/tree-share';

const PROJECTS = [
  { id: 'springhill', load: loadSpringhill },
  { id: 'vulcan-mesa', load: loadVulcanMesa },
  { id: 'raven-forest', load: loadRavenForest },
];

function normalize(map: Map<string, LiveOwnershipFractions>): Record<string, LiveOwnershipFractions> {
  const out: Record<string, LiveOwnershipFractions> = {};
  for (const key of [...map.keys()].sort()) {
    out[key] = map.get(key) as LiveOwnershipFractions;
  }
  return out;
}

describe('unified tree-share parity with tree-layout', () => {
  it.each(PROJECTS)('$id: computeLiveOwnershipFractions matches', ({ load }) => {
    const nodes = load().workspace.nodes;
    expect(canonicalJson(normalize(newCompute(nodes)))).toBe(
      canonicalJson(normalize(oldCompute(nodes)))
    );
  });
});
