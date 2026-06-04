import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import type { DeskMap } from '../../../types/node';
import type { DeskMapCoverageSummary } from '../deskmap-coverage';
import { buildDeskMapWarningDotState, hasDeskMapWarningDot } from '../deskmap-warning-dots';

function deskMap(nodeIds: string[], fields: Partial<DeskMap> = {}): DeskMap {
  return {
    id: 'dm-1',
    name: 'Synthetic Tract',
    code: 'T1',
    tractId: null,
    grossAcres: '',
    pooledAcres: '',
    description: '',
    nodeIds,
    ...fields,
  };
}

describe('deskmap warning dots', () => {
  it('does not parse warning words from the desk-map description', () => {
    const owner = {
      ...createBlankNode('owner-1'),
      initialFraction: '1',
      fraction: '1',
    };

    expect(hasDeskMapWarningDot({
      deskMap: deskMap(['owner-1'], {
        description: 'Valid title, but this note says orphan in ordinary prose.',
      }),
      nodes: [owner],
    })).toBe(false);
  });

  it('flags graph validation issues on the desk-map nodes', () => {
    const parent = {
      ...createBlankNode('parent'),
      initialFraction: '1',
      fraction: '0.6',
    };
    const child = {
      ...createBlankNode('child', 'parent'),
      initialFraction: '0.6',
      fraction: '0.6',
    };
    const state = buildDeskMapWarningDotState({
      deskMap: deskMap(['parent', 'child']),
      nodes: [parent, child],
    });

    expect(state.hasWarning).toBe(true);
    expect(state.graphIssues.map((issue) => issue.code)).toContain(
      'over_allocated_branch'
    );
  });

  it('flags missing-parent validation issues without warning text', () => {
    const orphan = {
      ...createBlankNode('orphan', 'missing-parent'),
      initialFraction: '0.5',
      fraction: '0.5',
    };

    expect(buildDeskMapWarningDotState({
      deskMap: deskMap(['orphan']),
      nodes: [orphan],
    }).graphIssues.map((issue) => issue.code)).toContain('missing_parent');
  });

  it('flags NPRI branch discrepancies from the engine helper', () => {
    const mineral = {
      ...createBlankNode('mineral-root'),
      interestClass: 'mineral' as const,
      initialFraction: '0.05',
      fraction: '0.05',
    };
    const npri = {
      ...createBlankNode('npri-1', 'mineral-root'),
      interestClass: 'npri' as const,
      royaltyKind: 'fixed' as const,
      fixedRoyaltyBasis: 'whole_tract' as const,
      initialFraction: '0.0625',
      fraction: '0.0625',
    };
    const state = buildDeskMapWarningDotState({
      deskMap: deskMap(['mineral-root', 'npri-1']),
      nodes: [mineral, npri],
    });

    expect(state.hasWarning).toBe(true);
    expect(state.npriDiscrepancyCount).toBe(1);
  });

  it('flags lease-overlap coverage warnings without warning text', () => {
    const owner = {
      ...createBlankNode('owner-1'),
      initialFraction: '1',
      fraction: '1',
    };
    const coverageSummary = {
      leaseOverlaps: [
        {
          ownerNodeId: 'owner-1',
          ownerGrantee: 'Owner One',
          overlap: {
            leaseId: 'lease-1',
            leaseName: 'Top Lease',
            lessee: 'Operator',
            requestedFraction: '1',
            allocatedFraction: '0',
            clippedFraction: '1',
          },
        },
      ],
    } satisfies Pick<DeskMapCoverageSummary, 'leaseOverlaps'>;
    const state = buildDeskMapWarningDotState({
      deskMap: deskMap(['owner-1']),
      nodes: [owner],
      coverageSummary,
    });

    expect(state.hasWarning).toBe(true);
    expect(state.leaseOverlapCount).toBe(1);
  });
});
