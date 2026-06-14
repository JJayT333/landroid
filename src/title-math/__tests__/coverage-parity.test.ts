/**
 * Differential parity: the new coverage calculator must produce byte-identical
 * output to the live deskmap-coverage math across all three real project graphs
 * -- per-tract coverage summaries and per-owner lease allocations.
 */
import { describe, expect, it } from 'vitest';

import * as oldCoverage from '../../components/deskmap/deskmap-coverage';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import type { Lease } from '../../types/owner';
import { loadRavenForest, loadSpringhill, loadVulcanMesa } from '../__diff__/projects';
import * as newCoverage from '../calculators/coverage';

const PROJECTS = [
  { id: 'springhill', load: loadSpringhill },
  { id: 'vulcan-mesa', load: loadVulcanMesa },
  { id: 'raven-forest', load: loadRavenForest },
];

function leasesByOwnerId(leases: Lease[]): Map<string, Lease[]> {
  const result = new Map<string, Lease[]>();
  for (const lease of leases) {
    const current = result.get(lease.ownerId) ?? [];
    current.push(lease);
    result.set(lease.ownerId, current);
  }
  return result;
}

function same(label: string, oldVal: unknown, newVal: unknown): void {
  expect(canonicalJson(newVal), label).toBe(canonicalJson(oldVal));
}

describe('unified coverage calculator parity with deskmap-coverage', () => {
  for (const project of PROJECTS) {
    describe(project.id, () => {
      const input = project.load();
      const { nodes, deskMaps } = input.workspace;
      const byOwner = leasesByOwnerId(input.leases);

      it('calculateDeskMapCoverageSummary matches per tract', () => {
        for (const deskMap of deskMaps) {
          const tractNodes = nodes.filter((node) => deskMap.nodeIds.includes(node.id));
          same(
            `coverage ${deskMap.code}`,
            oldCoverage.calculateDeskMapCoverageSummary(tractNodes, byOwner, nodes),
            newCoverage.calculateDeskMapCoverageSummary(tractNodes, byOwner, nodes)
          );
        }
      });

      it('allocateLeaseCoverage matches for sampled owner fractions', () => {
        const scopeIndex = oldCoverage.buildLeaseScopeIndex(nodes);
        const newScopeIndex = newCoverage.buildLeaseScopeIndex(nodes);
        same('leaseScopeIndex.linkedLeaseIds', [...scopeIndex.linkedLeaseIds].sort(), [...newScopeIndex.linkedLeaseIds].sort());

        nodes
          .filter((node) => node.type !== 'related' && node.linkedOwnerId)
          .slice(0, 60)
          .forEach((node) => {
            const ownerLeases = oldCoverage.getLeasesForOwnerNode(
              byOwner.get(node.linkedOwnerId!) ?? [],
              node,
              scopeIndex
            );
            const newOwnerLeases = newCoverage.getLeasesForOwnerNode(
              byOwner.get(node.linkedOwnerId!) ?? [],
              node,
              newScopeIndex
            );
            same(`getLeasesForOwnerNode ${node.id}`, ownerLeases.map((l) => l.id), newOwnerLeases.map((l) => l.id));
            same(
              `allocate ${node.id}`,
              oldCoverage.allocateLeaseCoverage(ownerLeases, node.fraction),
              newCoverage.allocateLeaseCoverage(newOwnerLeases, node.fraction)
            );
          });
      });
    });
  }
});
