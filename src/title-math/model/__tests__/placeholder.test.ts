import { describe, expect, it } from 'vitest';

import {
  createBlankNode,
  isPlaceholderNode,
  normalizeOwnershipNode,
  placeholderPassthroughOf,
  type OwnershipNode,
} from '../../../types/node';
import { collectUnprovenIndeterminateNodeIds } from '../placeholder';
import { buildLeaseholdTransferOrderHoldReasons } from '../../calculators/leasehold';
import { countOpenHighRiskCurativeIssuesForUnit } from '../../../components/deskmap/curative-deskmap-flags';
import { createBlankTitleIssue, type TitleIssue } from '../../../types/title-issue';

function node(overrides: Partial<OwnershipNode> & { id: string }): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(overrides.id), ...overrides });
}

/**
 * grandma (root) -> [placeholder] -> grandson -> great-grandson, plus an
 * unrelated sibling branch off root that must NEVER be held.
 */
function chainWithPlaceholder(
  passthrough: 'indeterminate' | 'assume' | undefined
): OwnershipNode[] {
  return [
    node({ id: 'root', grantee: 'Grandma', initialFraction: '1', fraction: '0' }),
    node({
      id: 'mlink',
      parentId: 'root',
      grantee: '??? — missing link',
      provenance: 'placeholder',
      conveyanceMode: 'all',
      initialFraction: '0.500000000',
      fraction: '0',
      ...(passthrough ? { placeholderPassthrough: passthrough } : {}),
    }),
    node({
      id: 'grandson',
      parentId: 'mlink',
      grantee: 'Grandson',
      conveyanceMode: 'all',
      initialFraction: '0.500000000',
      fraction: '0',
    }),
    node({
      id: 'greatgrandson',
      parentId: 'grandson',
      grantee: 'Great Grandson',
      conveyanceMode: 'all',
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    }),
    // Unrelated proven branch off root — never below the placeholder.
    node({
      id: 'sibling',
      parentId: 'root',
      grantee: 'Sibling',
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    }),
  ];
}

describe('Missing Link placeholder — type foundation round-trip', () => {
  it('normalizes a placeholder and serializes it round-trip-clean', () => {
    const placeholder = node({
      id: 'mlink',
      parentId: 'root',
      provenance: 'placeholder',
      placeholderMissing: 'both',
      conveyanceMode: 'all',
    });
    expect(isPlaceholderNode(placeholder)).toBe(true);
    // Default passthrough is the ABSENT 'indeterminate'.
    expect(placeholder.placeholderPassthrough).toBeUndefined();
    expect(placeholderPassthroughOf(placeholder)).toBe('indeterminate');
    expect(placeholder.placeholderMissing).toBe('both');

    // Round-trip through JSON keeps the placeholder keys verbatim.
    const reparsed = normalizeOwnershipNode(
      JSON.parse(JSON.stringify(placeholder)) as OwnershipNode
    );
    expect(reparsed.provenance).toBe('placeholder');
    expect(reparsed.placeholderMissing).toBe('both');
    expect(reparsed.placeholderPassthrough).toBeUndefined();

    // An explicit 'assume' is preserved.
    const assume = node({ id: 'a', provenance: 'placeholder', placeholderPassthrough: 'assume' });
    expect(placeholderPassthroughOf(assume)).toBe('assume');
    expect(assume.placeholderPassthrough).toBe('assume');
  });

  it('a recorded node carries none of the placeholder keys', () => {
    const recorded = node({ id: 'r', grantee: 'Recorded' });
    expect(isPlaceholderNode(recorded)).toBe(false);
    expect(recorded.provenance).toBeUndefined();
    expect(recorded.placeholderPassthrough).toBeUndefined();
    expect(recorded.placeholderMissing).toBeUndefined();
    expect(placeholderPassthroughOf(recorded)).toBeNull();
  });
});

describe('collectUnprovenIndeterminateNodeIds', () => {
  it('indeterminate (default): the placeholder and everything below it is in the set', () => {
    const ids = collectUnprovenIndeterminateNodeIds(chainWithPlaceholder('indeterminate'));
    expect(ids.has('mlink')).toBe(true);
    expect(ids.has('grandson')).toBe(true);
    expect(ids.has('greatgrandson')).toBe(true);
    // Above and beside the link are PROVEN — never in the set.
    expect(ids.has('root')).toBe(false);
    expect(ids.has('sibling')).toBe(false);
  });

  it('absent passthrough defaults to indeterminate (same set as explicit)', () => {
    const explicit = collectUnprovenIndeterminateNodeIds(chainWithPlaceholder('indeterminate'));
    const defaulted = collectUnprovenIndeterminateNodeIds(chainWithPlaceholder(undefined));
    expect([...defaulted].sort()).toEqual([...explicit].sort());
  });

  it('assume: descendants compute and are NOT in the indeterminate set', () => {
    const ids = collectUnprovenIndeterminateNodeIds(chainWithPlaceholder('assume'));
    // An assume placeholder is NOT a display barrier — nothing is held pending.
    expect(ids.size).toBe(0);
    expect(ids.has('mlink')).toBe(false);
    expect(ids.has('grandson')).toBe(false);
    expect(ids.has('greatgrandson')).toBe(false);
  });

  it('a chain with no Missing Link is unaffected (empty set)', () => {
    const ids = collectUnprovenIndeterminateNodeIds([
      node({ id: 'root', initialFraction: '1', fraction: '0' }),
      node({ id: 'a', parentId: 'root', initialFraction: '1', fraction: '1' }),
    ]);
    expect(ids.size).toBe(0);
  });
});

describe('Missing Link — payout HOLD via the existing High-issue machinery', () => {
  const unit = [{ id: 'dm-1', nodeIds: ['root', 'mlink', 'grandson', 'greatgrandson', 'sibling'] }];

  function highMissingLinkIssue(status: TitleIssue['status']): TitleIssue {
    return createBlankTitleIssue('ws', {
      id: 'missing-link-mlink',
      issueType: 'Missing link',
      priority: 'High',
      status,
      affectedNodeId: 'mlink',
      affectedDeskMapId: 'dm-1',
    });
  }

  it('indeterminate: the open High issue counts toward the unit and raises a hold reason', () => {
    const count = countOpenHighRiskCurativeIssuesForUnit(unit, [highMissingLinkIssue('Open')]);
    expect(count).toBe(1);
    const reasons = buildLeaseholdTransferOrderHoldReasons(
      {
        unitAssignmentWarningCount: 0,
        npriRatificationHoldCount: 0,
        fixedNpriExceedsRoyaltyTractCount: 0,
      },
      count
    );
    expect(reasons.some((r) => /open Critical\/High curative issue/.test(r))).toBe(true);
  });

  it('assume: numbers compute but the branch is STILL held while the High issue is open', () => {
    // The 'assume' placeholder is excluded from the indeterminate set, yet the
    // High 'Missing link' issue is still OPEN, so payout is still held.
    const indeterminate = collectUnprovenIndeterminateNodeIds(chainWithPlaceholder('assume'));
    expect(indeterminate.size).toBe(0);

    const count = countOpenHighRiskCurativeIssuesForUnit(unit, [highMissingLinkIssue('Open')]);
    expect(count).toBe(1);
    const reasons = buildLeaseholdTransferOrderHoldReasons(
      {
        unitAssignmentWarningCount: 0,
        npriRatificationHoldCount: 0,
        fixedNpriExceedsRoyaltyTractCount: 0,
      },
      count
    );
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('resolving the issue lifts the hold (no count, no reason)', () => {
    const count = countOpenHighRiskCurativeIssuesForUnit(unit, [highMissingLinkIssue('Resolved')]);
    expect(count).toBe(0);
    const reasons = buildLeaseholdTransferOrderHoldReasons(
      {
        unitAssignmentWarningCount: 0,
        npriRatificationHoldCount: 0,
        fixedNpriExceedsRoyaltyTractCount: 0,
      },
      count
    );
    expect(reasons.some((r) => /curative issue/.test(r))).toBe(false);
  });
});
