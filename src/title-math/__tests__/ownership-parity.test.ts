/**
 * Differential parity: the new unified ownership calculator must produce
 * byte-identical output to the live v2 engine (src/engine/math-engine.ts) for
 * every operation, across all three real project graphs plus targeted edge
 * cases. Equality is asserted via canonicalJson on the full Result envelope
 * (nodes + audit) and on validation / discrepancy / root-total surfaces.
 */
import { describe, expect, it } from 'vitest';

import { d } from '../../engine/decimal';
import * as oldEngine from '../../engine/math-engine';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import type { OwnershipNode } from '../../types/node';
import { loadRavenForest, loadSpringhill, loadVulcanMesa } from '../__diff__/projects';
import * as newEngine from '../index';

const PROJECTS = [
  { id: 'springhill', load: loadSpringhill },
  { id: 'vulcan-mesa', load: loadVulcanMesa },
  { id: 'raven-forest', load: loadRavenForest },
];

const SAMPLE = 40;

function same(label: string, oldVal: unknown, newVal: unknown): void {
  expect(canonicalJson(newVal), label).toBe(canonicalJson(oldVal));
}

function mineralParents(nodes: OwnershipNode[]): OwnershipNode[] {
  return nodes.filter(
    (node) =>
      node.type !== 'related' &&
      (node.interestClass ?? 'mineral') === 'mineral' &&
      d(node.fraction).greaterThan('0.0001')
  );
}

function rebalanceable(nodes: OwnershipNode[]): OwnershipNode[] {
  return nodes.filter(
    (node) => node.type !== 'related' && d(node.initialFraction).greaterThan('0.0001')
  );
}

describe('unified ownership calculator parity with v2 engine', () => {
  for (const project of PROJECTS) {
    describe(project.id, () => {
      const nodes = project.load().workspace.nodes;

      it('validateOwnershipGraph matches', () => {
        same('validate', oldEngine.validateOwnershipGraph(nodes), newEngine.validateOwnershipGraph(nodes));
      });

      it('findNpriBranchDiscrepancies matches', () => {
        same(
          'discrepancies',
          oldEngine.findNpriBranchDiscrepancies(nodes),
          newEngine.findNpriBranchDiscrepancies(nodes)
        );
      });

      it('rootOwnershipTotal matches', () => {
        same(
          'rootTotal',
          oldEngine.rootOwnershipTotal(nodes).toString(),
          newEngine.rootOwnershipTotal(nodes).toString()
        );
      });

      it('executeConveyance matches across sampled parents (incl. over-conveyance)', () => {
        const parents = mineralParents(nodes).slice(0, SAMPLE);
        parents.forEach((parent, i) => {
          const half = d(parent.fraction).div(2).toString();
          for (const share of [half, d(parent.fraction).mul(3).toString(), '0', '-1']) {
            const params = {
              allNodes: nodes,
              parentId: parent.id,
              newNodeId: `parity-convey-${i}`,
              share,
              form: { grantee: 'Parity Test' } as Partial<OwnershipNode>,
            };
            same(
              `convey ${parent.id} share=${share}`,
              oldEngine.executeConveyance(params),
              newEngine.executeConveyance(params)
            );
          }
        });
      });

      it('executeCreateNpri matches across sampled mineral nodes', () => {
        mineralParents(nodes)
          .slice(0, SAMPLE)
          .forEach((parent, i) => {
            const params = {
              allNodes: nodes,
              parentId: parent.id,
              newNodeId: `parity-npri-${i}`,
              share: '0.0625',
              form: { royaltyKind: 'fixed' } as Partial<OwnershipNode>,
            };
            same(
              `npri ${parent.id}`,
              oldEngine.executeCreateNpri(params),
              newEngine.executeCreateNpri(params)
            );
          });
      });

      it('executeRebalance matches across sampled nodes (incl. root-total guard)', () => {
        rebalanceable(nodes)
          .slice(0, SAMPLE)
          .forEach((node) => {
            for (const factor of ['0.5', '1.25', '2']) {
              const newInitial = d(node.initialFraction).mul(factor).toString();
              const params = {
                allNodes: nodes,
                nodeId: node.id,
                newInitialFraction: newInitial,
              };
              same(
                `rebalance ${node.id} x${factor}`,
                oldEngine.executeRebalance(params),
                newEngine.executeRebalance(params)
              );
            }
          });
      });

      it('executePredecessorInsert matches across sampled nodes', () => {
        rebalanceable(nodes)
          .slice(0, SAMPLE)
          .forEach((node, i) => {
            const params = {
              allNodes: nodes,
              activeNodeId: node.id,
              activeNodeParentId: node.parentId,
              newPredecessorId: `parity-pred-${i}`,
              newInitialFraction: d(node.initialFraction).toString(),
              form: {} as Partial<OwnershipNode>,
            };
            same(
              `precede ${node.id}`,
              oldEngine.executePredecessorInsert(params),
              newEngine.executePredecessorInsert(params)
            );
          });
      });

      it('executeDeleteBranch matches across sampled nodes', () => {
        nodes.slice(0, SAMPLE).forEach((node) => {
          const params = { allNodes: nodes, nodeId: node.id };
          same(
            `delete ${node.id}`,
            oldEngine.executeDeleteBranch(params),
            newEngine.executeDeleteBranch(params)
          );
        });
      });

      it('executeAttachConveyance matches for sampled compatible pairs', () => {
        const minerals = mineralParents(nodes);
        const destination = minerals[0];
        if (!destination) return;
        minerals.slice(1, SAMPLE).forEach((source) => {
          const params = {
            allNodes: nodes,
            activeNodeId: source.id,
            attachParentId: destination.id,
            calcShare: d(destination.fraction).div(4).toString(),
            form: {} as Partial<OwnershipNode>,
          };
          same(
            `attach ${source.id} -> ${destination.id}`,
            oldEngine.executeAttachConveyance(params),
            newEngine.executeAttachConveyance(params)
          );
        });
      });
    });
  }

  it('executeCreateRootNode matches', () => {
    const base = loadVulcanMesa().workspace.nodes;
    for (const initial of ['0.5', '1', '1.5', '0', '-0.25']) {
      const params = {
        allNodes: base,
        newNodeId: 'parity-root',
        initialFraction: initial,
        form: { grantee: 'Root Parity' } as Partial<OwnershipNode>,
      };
      same(
        `create-root ${initial}`,
        oldEngine.executeCreateRootNode(params),
        newEngine.executeCreateRootNode(params)
      );
    }
  });

  it('calculateShare matches uncapped across modes (Van Dyke / warn-don\'t-cap)', () => {
    const cases = [
      { conveyanceMode: 'all', splitBasis: 'remaining', numerator: '0', denominator: '1', manualAmount: '0', parentFraction: '0.5', parentInitialFraction: '0.75' },
      { conveyanceMode: 'fixed', splitBasis: 'whole', numerator: '0', denominator: '1', manualAmount: '0.123456789', parentFraction: '0.5', parentInitialFraction: '0.75' },
      { conveyanceMode: 'fraction', splitBasis: 'whole', numerator: '3', denominator: '4', parentFraction: '0.5', parentInitialFraction: '0.5', manualAmount: '0' },
      { conveyanceMode: 'fraction', splitBasis: 'remaining', numerator: '3', denominator: '4', parentFraction: '0.5', parentInitialFraction: '0.5', manualAmount: '0' },
      { conveyanceMode: 'fraction', splitBasis: 'initial', numerator: '5', denominator: '4', parentFraction: '0.25', parentInitialFraction: '0.5', manualAmount: '0' },
      { conveyanceMode: 'fraction', splitBasis: 'remaining', numerator: '1', denominator: '0', parentFraction: '0.5', parentInitialFraction: '0.5', manualAmount: '0' },
    ] as const;
    for (const params of cases) {
      same(
        `share ${params.conveyanceMode}/${params.splitBasis} ${params.numerator}/${params.denominator}`,
        oldEngine.calculateShare(params).toString(),
        newEngine.calculateShare(params).toString()
      );
    }
  });
});
