/**
 * Formula formatters for FormulaTooltip in the Desk Map view.
 *
 * Mirrors `src/components/leasehold/leasehold-formulas.ts` for the title-side
 * numbers — granted/of-whole/remaining fractions, NPRI burden discrepancies,
 * and mineral-coverage summaries.
 */
import Decimal from 'decimal.js';
import { formatAsFraction } from '../../engine/fraction-display';
import type { FormulaContent } from '../leasehold/FormulaTooltip';
import type { OwnershipNode } from '../../types/node';
import type { DeskMapCoverageSummary, LeaseCoverageOverlap } from './deskmap-coverage';
import type { NpriBranchDiscrepancy } from '../../engine/math-engine';

// ── Helpers ─────────────────────────────────────────────

function frac(value: string | Decimal): string {
  return formatAsFraction(new Decimal(value));
}
function dec(value: string | Decimal, places = 7): string {
  return new Decimal(value).toFixed(places);
}
function pct(value: string | Decimal, places = 4): string {
  return `${new Decimal(value).times(100).toFixed(places)}%`;
}
function fracDec(value: string | Decimal): string {
  return `${frac(value)} (${dec(value)})`;
}

// ── 1. Granted Fraction (relative to parent) ────────────
//   = node.initialFraction / parentInitialFraction
// Tells you the share of the parent's interest that was conveyed in this deed.

export function grantedFractionFormula(
  node: OwnershipNode,
  parentInitialFraction: string | null
): FormulaContent {
  const initial = new Decimal(node.initialFraction);
  const parentInit = parentInitialFraction
    ? new Decimal(parentInitialFraction)
    : null;
  if (!parentInit || parentInit.isZero()) {
    return {
      title: 'Granted',
      description:
        'Fraction conveyed in this instrument, relative to its grantor. (No parent node — defaults to the same as Of Whole.)',
      inputs: [
        { label: 'Of whole', value: frac(initial) },
      ],
      steps: [
        {
          label: 'No parent fraction available',
          expression: frac(initial),
          value: `= ${fracDec(initial)}`,
        },
      ],
      result: { label: 'Granted', value: frac(initial) },
    };
  }
  const granted = initial.div(parentInit);
  return {
    title: 'Granted',
    description: "Share of the grantor's interest conveyed by this instrument.",
    inputs: [
      { label: 'This node — of whole', value: frac(initial) },
      { label: 'Parent — of whole', value: frac(parentInit) },
    ],
    steps: [
      {
        label: 'Node fraction ÷ Parent fraction',
        expression: `${frac(initial)} ÷ ${frac(parentInit)}`,
        value: `= ${fracDec(granted)}`,
      },
    ],
    result: { label: 'Granted', value: frac(granted) },
  };
}

// ── 2. Of Whole Fraction ────────────────────────────────
//   = node.initialFraction directly

export function ofWholeFractionFormula(
  node: OwnershipNode
): FormulaContent {
  const initial = new Decimal(node.initialFraction);
  return {
    title: 'Of Whole',
    description: "Mineral fraction of the whole tract conveyed to this grantee at the time of this instrument.",
    inputs: [
      { label: 'Grantee', value: node.grantee || '—' },
      { label: 'Instrument', value: node.instrument || '—' },
      { label: 'Date', value: node.date || node.fileDate || '—' },
    ],
    steps: [
      {
        label: 'From the deed terms',
        expression: frac(initial),
        value: `= ${fracDec(initial)}`,
      },
    ],
    result: { label: 'Of Whole', value: frac(initial) },
  };
}

// ── 3. Remaining Fraction ───────────────────────────────
//   = node.fraction (after conveyances out)

export function remainingFractionFormula(
  node: OwnershipNode
): FormulaContent {
  const initial = new Decimal(node.initialFraction);
  const remaining = new Decimal(node.fraction);
  const conveyed = initial.minus(remaining);
  return {
    title: 'Remaining',
    description: "Current mineral fraction still held by this grantee after any conveyances out.",
    inputs: [
      { label: 'Of whole (initial)', value: frac(initial) },
      { label: 'Conveyed out', value: frac(conveyed) },
    ],
    steps: [
      {
        label: 'Initial − Conveyed out',
        expression: `${frac(initial)} − ${frac(conveyed)}`,
        value: `= ${fracDec(remaining)}`,
      },
    ],
    result: { label: 'Remaining', value: frac(remaining) },
    note: remaining.isZero()
      ? 'Fully conveyed — no current interest.'
      : undefined,
  };
}

// ── 4. NPRI of-Whole / of-Branch / of-Royalty ───────────

export function npriInitialFractionFormula(
  node: OwnershipNode
): FormulaContent {
  const initial = new Decimal(node.initialFraction);
  const isFloating = node.royaltyKind === 'floating';
  const basisLabel = isFloating
    ? 'a fraction of the lease royalty'
    : node.fixedRoyaltyBasis === 'whole_tract'
      ? 'a fixed fraction of the whole tract'
      : 'a fixed fraction of the burdened branch';
  return {
    title: `NPRI — ${
      isFloating
        ? 'Of Lease Royalty'
        : node.fixedRoyaltyBasis === 'whole_tract'
          ? 'Of Whole Tract'
          : 'Of Burdened Branch'
    }`,
    description: `Non-participating royalty interest granted as ${basisLabel}.`,
    inputs: [
      { label: 'Payee', value: node.grantee || '—' },
      { label: 'Kind', value: isFloating ? 'Floating' : 'Fixed' },
      ...(isFloating
        ? []
        : [{ label: 'Basis', value: node.fixedRoyaltyBasis === 'whole_tract' ? 'Whole tract' : 'Burdened branch' }]),
      { label: 'Instrument', value: node.instrument || '—' },
    ],
    steps: [
      {
        label: 'From the royalty deed',
        expression: frac(initial),
        value: `= ${fracDec(initial)}`,
      },
    ],
    result: { label: 'Granted', value: frac(initial) },
  };
}

// ── 5. NPRI Branch Discrepancy (totalBurden / capacity / excess) ──

export function npriDiscrepancyFormula(
  discrepancy: NpriBranchDiscrepancy
): FormulaContent {
  const kindLabel = discrepancy.kind === 'floating_over_royalty'
    ? 'Floating NPRIs exceed available lease royalty'
    : discrepancy.kind === 'fixed_branch_over_branch'
      ? 'Fixed (burdened-branch) NPRIs exceed branch fraction'
      : 'Fixed (whole-tract) NPRIs exceed branch fraction';
  return {
    title: 'NPRI Branch Discrepancy',
    description: kindLabel + '. Total NPRI burden on this branch is larger than the branch can carry.',
    inputs: [
      { label: 'NPRIs affected', value: String(discrepancy.npriNodeIds.length) },
      { label: 'Burdened branch node', value: discrepancy.burdenedBranchNodeId },
    ],
    steps: [
      {
        label: 'Total NPRI burden on branch',
        expression: 'Σ NPRI fractions on this branch',
        value: `= ${fracDec(discrepancy.totalBurden)}`,
      },
      {
        label: 'Branch capacity',
        expression: discrepancy.kind === 'floating_over_royalty'
          ? '= lease royalty rate'
          : '= branch initial fraction',
        value: `= ${fracDec(discrepancy.capacity)}`,
      },
      {
        label: 'Total − Capacity',
        expression: `${frac(discrepancy.totalBurden)} − ${frac(discrepancy.capacity)}`,
        value: `= ${fracDec(discrepancy.excess)}`,
      },
    ],
    result: { label: 'Over by', value: frac(discrepancy.excess) },
    note: 'Warning-only — title entry stays open while this is reconciled.',
  };
}

// ── 6. Mineral Coverage cards (Found / Linked / Leased) ──

export function coverageFoundInChainFormula(
  summary: DeskMapCoverageSummary
): FormulaContent {
  const steps = summary.currentOwnershipContributors.length > 0
    ? summary.currentOwnershipContributors.map((c) => ({
        label: c.grantee || c.nodeId,
        expression: frac(c.fraction),
        value: `= ${fracDec(c.fraction)}`,
      }))
    : [{ label: 'No present owners', expression: '0', value: '= 0' }];
  return {
    title: 'Mineral Coverage — Found in Chain',
    description: "Sum of every present owner's mineral fraction visible on this tract. Should equal 100% (1/1) when title is fully reconciled.",
    inputs: [
      { label: 'Present owners', value: String(summary.currentOwnerCount) },
    ],
    steps,
    result: {
      label: 'Found in Chain',
      value: `${frac(summary.currentOwnership)} (${pct(summary.currentOwnership)})`,
    },
    note: new Decimal(summary.currentOwnership).greaterThan(1)
      ? `Over 100% — review the contributors. Excess: ${frac(summary.missingOwnership)}.`
      : new Decimal(summary.currentOwnership).lessThan(1)
        ? `Under 100% — missing ${frac(summary.missingOwnership)} to fully account for the tract.`
        : 'Balanced — fully accounts for the tract.',
  };
}

export function coverageLinkedOwnersFormula(
  summary: DeskMapCoverageSummary
): FormulaContent {
  return {
    title: 'Mineral Coverage — Linked Owners',
    description: 'Sum of mineral fractions whose Desk Map nodes are linked to an owner record. Unlinked nodes still count for chain coverage but have no contact/address data.',
    inputs: [
      { label: 'Present owners', value: String(summary.currentOwnerCount) },
      { label: 'Linked owners', value: String(summary.linkedOwnerCount) },
    ],
    steps: [
      {
        label: 'Sum of linked-owner fractions',
        expression: `${summary.linkedOwnerCount} of ${summary.currentOwnerCount} owners linked`,
        value: `= ${fracDec(summary.linkedOwnership)}`,
      },
    ],
    result: {
      label: 'Linked Owners',
      value: `${frac(summary.linkedOwnership)} (${pct(summary.linkedOwnership)})`,
    },
    note: new Decimal(summary.unlinkedOwnership).greaterThan(0)
      ? `Unlinked: ${frac(summary.unlinkedOwnership)} — link those owners to enable curative & contact tracking.`
      : 'All current owners linked.',
  };
}

export function coverageLeasedFormula(
  summary: DeskMapCoverageSummary
): FormulaContent {
  return {
    title: 'Mineral Coverage — Leased',
    description: "Sum of mineral fractions under active lease coverage on this tract.",
    inputs: [
      { label: 'Present owners', value: String(summary.currentOwnerCount) },
      { label: 'Leased owners', value: String(summary.leasedOwnerCount) },
    ],
    steps: [
      {
        label: 'Sum of allocated lease coverage',
        expression: `${summary.leasedOwnerCount} of ${summary.currentOwnerCount} owners under lease`,
        value: `= ${fracDec(summary.leasedOwnership)}`,
      },
    ],
    result: {
      label: 'Leased',
      value: `${frac(summary.leasedOwnership)} (${pct(summary.leasedOwnership)})`,
    },
    note: new Decimal(summary.unleasedOwnership).greaterThan(0)
      ? `Open to lease: ${frac(summary.unleasedOwnership)}.`
      : 'Fully leased.',
  };
}

// ── 7. Per-overlap Clipped Fraction ─────────────────────

export function leaseOverlapClippedFormula(
  ownerGrantee: string,
  overlap: LeaseCoverageOverlap
): FormulaContent {
  return {
    title: 'Lease Overlap — Clipped Fraction',
    description: "An active lease tried to claim more of the owner's interest than was available; the later-effective lease was clipped to the remaining share. Warning-only.",
    inputs: [
      { label: 'Owner', value: ownerGrantee },
      { label: 'Lease', value: overlap.leaseName || overlap.lessee || overlap.leaseId },
      { label: 'Requested', value: frac(overlap.requestedFraction) },
      { label: 'Allocated', value: frac(overlap.allocatedFraction) },
    ],
    steps: [
      {
        label: 'Requested − Allocated',
        expression: `${frac(overlap.requestedFraction)} − ${frac(overlap.allocatedFraction)}`,
        value: `= ${fracDec(overlap.clippedFraction)}`,
      },
    ],
    result: { label: 'Clipped', value: frac(overlap.clippedFraction) },
    note: 'Likely a top-lease or chain-of-title issue — review the leasehold deck.',
  };
}
