import { describe, expect, it } from 'vitest';
import {
  countOpenHighRiskCurativeIssuesForDeskMap,
  countOpenHighRiskCurativeIssuesForUnit,
} from '../curative-deskmap-flags';
import { createBlankTitleIssue, type TitleIssue } from '../../../types/title-issue';

const DESK = { id: 'dm-1', nodeIds: ['n1', 'n2'] };

function issue(overrides: Partial<TitleIssue>): TitleIssue {
  return createBlankTitleIssue('ws-1', {
    priority: 'Critical',
    status: 'Open',
    ...overrides,
  });
}

describe('countOpenHighRiskCurativeIssuesForDeskMap', () => {
  it('counts an open Critical issue linked by affectedDeskMapId', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [issue({ affectedDeskMapId: 'dm-1' })])
    ).toBe(1);
  });

  it('counts an open High issue linked by a node on the desk map', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ priority: 'High', affectedNodeId: 'n2' }),
      ])
    ).toBe(1);
  });

  it('counts an issue linked by BOTH the desk map and one of its nodes only once', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ affectedDeskMapId: 'dm-1', affectedNodeId: 'n1' }),
      ])
    ).toBe(1);
  });

  it('ignores closed issues (Resolved / Deferred)', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ affectedDeskMapId: 'dm-1', status: 'Resolved' }),
        issue({ affectedDeskMapId: 'dm-1', status: 'Deferred' }),
      ])
    ).toBe(0);
  });

  it('ignores Medium / Low priority', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ affectedDeskMapId: 'dm-1', priority: 'Medium' }),
        issue({ affectedDeskMapId: 'dm-1', priority: 'Low' }),
      ])
    ).toBe(0);
  });

  it('ignores issues on a different desk map, an unrelated node, or fully unlinked', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ affectedDeskMapId: 'dm-2' }),
        issue({ affectedNodeId: 'n-other' }),
        issue({}), // affectedDeskMapId + affectedNodeId both null
      ])
    ).toBe(0);
  });

  it('sums distinct open high-risk issues across both link kinds', () => {
    expect(
      countOpenHighRiskCurativeIssuesForDeskMap(DESK, [
        issue({ affectedDeskMapId: 'dm-1' }),
        issue({ priority: 'High', affectedNodeId: 'n1' }),
      ])
    ).toBe(2);
  });
});

describe('countOpenHighRiskCurativeIssuesForUnit', () => {
  const UNIT = [
    { id: 'dm-1', nodeIds: ['n1', 'n2'] },
    { id: 'dm-2', nodeIds: ['n3'] },
  ];

  it('returns 0 for a unit with no desk maps', () => {
    expect(countOpenHighRiskCurativeIssuesForUnit([], [issue({ affectedDeskMapId: 'dm-1' })])).toBe(0);
  });

  it('counts an issue linked to any of the unit’s desk maps (by id or node)', () => {
    expect(
      countOpenHighRiskCurativeIssuesForUnit(UNIT, [
        issue({ affectedDeskMapId: 'dm-2' }),
        issue({ priority: 'High', affectedNodeId: 'n1' }),
      ])
    ).toBe(2);
  });

  it('matches by affectedNodeId even when affectedDeskMapId is null (node-aware, like the dot)', () => {
    expect(
      countOpenHighRiskCurativeIssuesForUnit(UNIT, [
        issue({ affectedDeskMapId: null, affectedNodeId: 'n3' }),
      ])
    ).toBe(1);
  });

  it('counts an issue touching several of the unit’s tracts only once', () => {
    // affectedDeskMapId dm-1 AND affectedNodeId n3 (on dm-2) — both in the unit.
    expect(
      countOpenHighRiskCurativeIssuesForUnit(UNIT, [
        issue({ affectedDeskMapId: 'dm-1', affectedNodeId: 'n3' }),
      ])
    ).toBe(1);
  });

  it('ignores issues outside the unit, and closed / Medium / Low issues', () => {
    expect(
      countOpenHighRiskCurativeIssuesForUnit(UNIT, [
        issue({ affectedDeskMapId: 'dm-other' }),
        issue({ affectedNodeId: 'n-elsewhere' }),
        issue({ affectedDeskMapId: 'dm-1', status: 'Resolved' }),
        issue({ affectedDeskMapId: 'dm-1', priority: 'Medium' }),
        issue({}),
      ])
    ).toBe(0);
  });
});
