/**
 * Formula formatters for FormulaTooltip in the Leasehold view.
 *
 * Each function builds a structured derivation matching the actual
 * computation in `leasehold-summary.ts`, so a viewer hovering any decimal
 * can verify the math by hand. Keep these in sync with the math file.
 */
import Decimal from 'decimal.js';
import { formatAsFraction } from '../../engine/fraction-display';
import type { FormulaContent } from './FormulaTooltip';
import type {
  LeaseholdAssignmentSummary,
  LeaseholdDecimalRow,
  LeaseholdNpriSummary,
  LeaseholdOrriSummary,
  LeaseholdOwnerLeaseSummary,
  LeaseholdOwnerSummary,
  LeaseholdTractSummary,
  LeaseholdUnitSummary,
} from '../../title-math';

// ── Number formatting ───────────────────────────────────

/** Render a decimal string with 7 places — matches the precision viewers
 *  see in the leasehold tab. */
function dec(value: string | Decimal, places = 7): string {
  return new Decimal(value).toFixed(places);
}

/** Render as a percentage with 4 places. */
function pct(value: string | Decimal, places = 4): string {
  return `${new Decimal(value).times(100).toFixed(places)}%`;
}

/** Render an acreage with 3 places. */
function acres(value: string | Decimal): string {
  return `${new Decimal(value).toFixed(3)} ac`;
}

/** Show a raw decimal alongside its percentage, e.g. "0.1250000 (12.5000%)". */
function decAndPct(value: string | Decimal): string {
  return `${dec(value)} (${pct(value)})`;
}

// ── 1. Owner Tract Royalty (per lease slice) ────────────
// Computed at leasehold-summary.ts:461 as: leasedFraction × leaseRoyaltyRate

export function ownerTractRoyaltyFormula(
  owner: LeaseholdOwnerSummary,
  slice?: LeaseholdOwnerLeaseSummary
): FormulaContent {
  // For owners with a single lease, derive from that slice. For multi-lease
  // owners, show the sum of slice contributions.
  const slices = slice ? [slice] : owner.leaseSlices;
  if (slices.length === 0) {
    return {
      title: 'Owner Tract Royalty',
      description: "Owner's gross royalty share of the tract before any burdens.",
      steps: [],
      result: { label: 'Owner Tract Royalty', value: decAndPct(owner.ownerTractRoyalty) },
      note: 'No active leases on this owner — owner tract royalty is zero.',
    };
  }
  const inputs: { label: string; value: string }[] = [
    { label: 'Owner mineral fraction', value: `${formatAsFraction(owner.fraction)} (${dec(owner.fraction)})` },
  ];
  const steps = slices.map((s) => ({
    label: `Lease: ${s.leaseName || s.lessee || s.leaseId}`,
    expression: `${formatAsFraction(s.leasedFraction)} × ${s.leaseRoyaltyRate || '0'}`,
    value: `= ${decAndPct(s.ownerTractRoyalty)}`,
  }));
  return {
    title: 'Owner Tract Royalty',
    description: "Owner's gross royalty share of the tract, before any burdens.",
    inputs,
    steps,
    result: {
      label: slices.length > 1 ? 'Sum across leases' : 'Owner Tract Royalty',
      value: decAndPct(owner.ownerTractRoyalty),
    },
  };
}

// ── 2. Owner Net Unit Royalty Decimal ───────────────────
// Per slice (leasehold-summary.ts:946):
//   netOwnerUnitRoyaltyDecimal = slice.unitRoyaltyDecimal − slice.floatingNpriUnitDecimal
// Per owner: sum across slices (leasehold-summary.ts:982).

export function ownerNetUnitRoyaltyFormula(
  owner: LeaseholdOwnerSummary
): FormulaContent {
  const steps = owner.leaseSlices.length > 0
    ? owner.leaseSlices.map((s) => ({
        label: `Lease: ${s.leaseName || s.lessee || s.leaseId}`,
        expression: `${dec(s.unitRoyaltyDecimal)} − ${dec(s.floatingNpriUnitDecimal)}`,
        value: `= ${decAndPct(s.netOwnerUnitRoyaltyDecimal)}`,
      }))
    : [
        {
          label: 'Unit Royalty Decimal',
          expression: dec(owner.unitRoyaltyDecimal),
          value: `= ${decAndPct(owner.unitRoyaltyDecimal)}`,
        },
      ];
  return {
    title: 'Net Owner Unit Royalty',
    description:
      "Owner's unit-payout royalty decimal after subtracting floating NPRI burdens. Fixed NPRIs are subtracted later at the tract level.",
    inputs: [
      { label: 'Unit royalty decimal', value: decAndPct(owner.unitRoyaltyDecimal) },
      { label: 'Floating NPRI burden', value: decAndPct(owner.floatingNpriUnitDecimal) },
    ],
    steps,
    result: {
      label: owner.leaseSlices.length > 1 ? 'Sum across leases' : 'Net Owner Unit Royalty',
      value: decAndPct(owner.netOwnerUnitRoyaltyDecimal),
    },
    note: 'Clamped to 0 when floating NPRI exceeds lease royalty.',
  };
}

// ── 3. Net Pooled Acres (per owner) ─────────────────────
// netPooledAcres = tract.pooledAcres × owner.fraction

export function netPooledAcresFormula(
  owner: LeaseholdOwnerSummary,
  tract: LeaseholdTractSummary
): FormulaContent {
  return {
    title: 'Net Pooled Acres',
    description: "Owner's share of the pooled tract acreage.",
    inputs: [
      { label: 'Tract pooled acres', value: acres(tract.pooledAcres) },
      {
        label: 'Owner mineral fraction',
        value: `${formatAsFraction(owner.fraction)} (${dec(owner.fraction)})`,
      },
    ],
    steps: [
      {
        label: 'Pooled acres × Owner fraction',
        expression: `${acres(tract.pooledAcres)} × ${formatAsFraction(owner.fraction)}`,
        value: `= ${acres(owner.netPooledAcres)}`,
      },
    ],
    result: { label: 'Net Pooled Acres', value: acres(owner.netPooledAcres) },
  };
}

// ── 4. Tract Unit Royalty Decimal ───────────────────────
// = sum of owner.unitRoyaltyDecimal across owners on this tract.

export function tractUnitRoyaltyFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  const contributors = tract.owners.filter(
    (o) => !new Decimal(o.unitRoyaltyDecimal).isZero()
  );
  const steps = contributors.length > 0
    ? contributors.map((o) => ({
        label: o.ownerName,
        expression: dec(o.unitRoyaltyDecimal),
        value: `= ${decAndPct(o.unitRoyaltyDecimal)}`,
      }))
    : [
        {
          label: 'No leased owners',
          expression: '0',
          value: '= 0 (0%)',
        },
      ];
  return {
    title: 'Tract Unit Royalty Decimal',
    description:
      'Sum of every owner\'s unit royalty contribution on this tract. Each owner\'s contribution = (their leased pooled acres ÷ total pooled acres) × lease royalty rate.',
    inputs: [
      { label: 'Tract pooled acres', value: acres(tract.pooledAcres) },
      { label: 'Weighted royalty rate', value: pct(tract.weightedRoyaltyRate) },
      { label: 'Leased ownership', value: pct(tract.leasedOwnership) },
    ],
    steps,
    result: {
      label: 'Tract Unit Royalty Decimal',
      value: decAndPct(tract.unitRoyaltyDecimal),
    },
  };
}

// ── 5. Tract Unit NPRI Decimal ──────────────────────────
// = sum of all NPRI unitDecimals (fixed + floating) on the tract.

export function tractUnitNpriFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  const fixed = new Decimal(tract.fixedNpriBurdenRate);
  const floating = new Decimal(tract.floatingNpriBurdenRate);
  const tpf = new Decimal(tract.unitParticipation);
  return {
    title: 'Tract Unit NPRI Decimal',
    description:
      'Combined NPRI burden on the tract, expressed as a fraction of the unit payout.',
    inputs: [
      { label: 'Fixed NPRI burden (tract)', value: pct(tract.fixedNpriBurdenRate) },
      { label: 'Floating NPRI burden (tract)', value: pct(tract.floatingNpriBurdenRate) },
      { label: 'Unit participation (TPF)', value: pct(tract.unitParticipation) },
    ],
    steps: [
      {
        label: 'Total NPRI burden rate',
        expression: `${pct(fixed)} + ${pct(floating)}`,
        value: `= ${pct(tract.totalNpriBurdenRate)}`,
      },
      {
        label: '× Unit participation',
        expression: `${pct(tract.totalNpriBurdenRate)} × ${pct(tpf)}`,
        value: `= ${decAndPct(tract.unitNpriDecimal)}`,
      },
    ],
    result: {
      label: 'Tract Unit NPRI Decimal',
      value: decAndPct(tract.unitNpriDecimal),
    },
    note: tract.overFloatingNpriBurdened
      ? 'Over-burdened: floating NPRI on at least one lease exceeds the lease royalty.'
      : undefined,
  };
}

// ── 6. Tract Unit ORRI Decimal ──────────────────────────
// = unitParticipation × totalOrriBurdenRate (leasehold-summary.ts:1048)
// where totalOrriBurdenRate = gross + WI-basis + NRI-basis components.

export function tractUnitOrriFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  return {
    title: 'Tract Unit ORRI Decimal',
    description:
      'Combined ORRI burden on the tract (all three bases), expressed as a fraction of the unit payout.',
    inputs: [
      { label: 'Gross 8/8 ORRI burden', value: pct(tract.grossOrriBurdenRate) },
      {
        label: 'Working-interest ORRI burden',
        value: pct(tract.workingInterestOrriBurdenRate),
      },
      {
        label: 'NRI-basis ORRI burden',
        value: pct(tract.netRevenueInterestOrriBurdenRate),
      },
      { label: 'Unit participation (TPF)', value: pct(tract.unitParticipation) },
    ],
    steps: [
      {
        label: 'Total ORRI burden rate',
        expression: `${pct(tract.grossOrriBurdenRate)} + ${pct(tract.workingInterestOrriBurdenRate)} + ${pct(tract.netRevenueInterestOrriBurdenRate)}`,
        value: `= ${pct(tract.totalOrriBurdenRate)}`,
      },
      {
        label: '× Unit participation',
        expression: `${pct(tract.totalOrriBurdenRate)} × ${pct(tract.unitParticipation)}`,
        value: `= ${decAndPct(tract.unitOrriDecimal)}`,
      },
    ],
    result: {
      label: 'Tract Unit ORRI Decimal',
      value: decAndPct(tract.unitOrriDecimal),
    },
  };
}

// ── 7. Pre-Working-Interest Decimal (tract) ─────────────
// preWorkingInterestRate = leasedOwnership − weightedRoyalty − fixedNpriBurden − totalOrriBurden
// preWorkingInterestDecimal = unitParticipation × preWorkingInterestRate (clamped ≥ 0)

export function preWorkingInterestFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  const leased = new Decimal(tract.leasedOwnership);
  const royalty = new Decimal(tract.weightedRoyaltyRate);
  const fixedNpri = new Decimal(tract.fixedNpriBurdenRate);
  const orri = new Decimal(tract.totalOrriBurdenRate);
  const pre = leased.minus(royalty).minus(fixedNpri).minus(orri);
  return {
    title: 'Pre-Assignment Working Interest',
    description:
      'The working-interest decimal available for assignment, before any WI assignments are subtracted.',
    inputs: [
      { label: 'Leased ownership', value: pct(tract.leasedOwnership) },
      { label: 'Weighted royalty rate', value: pct(tract.weightedRoyaltyRate) },
      { label: 'Fixed NPRI burden', value: pct(tract.fixedNpriBurdenRate) },
      { label: 'Total ORRI burden', value: pct(tract.totalOrriBurdenRate) },
      { label: 'Unit participation (TPF)', value: pct(tract.unitParticipation) },
    ],
    steps: [
      {
        label: 'Pre-WI rate = Leased − Royalty − Fixed NPRI − ORRI',
        expression: `${pct(leased)} − ${pct(royalty)} − ${pct(fixedNpri)} − ${pct(orri)}`,
        value: `= ${pct(pre)}`,
      },
      {
        label: '× Unit participation',
        expression: `${pct(pre)} × ${pct(tract.unitParticipation)}`,
        value: `= ${decAndPct(tract.preWorkingInterestDecimal)}`,
      },
    ],
    result: {
      label: 'Pre-WI Decimal',
      value: decAndPct(tract.preWorkingInterestDecimal),
    },
    note: tract.overBurdened
      ? 'Over-burdened: fixed NPRIs + ORRIs exceed the available NRI. Pre-WI clamped to 0.'
      : 'Clamped to 0 when negative (over-burdened tract).',
  };
}

// ── 8. Retained Working Interest (tract) ────────────────
// retainedWI = preWI − assignedWI (assignedWI = preWI × assignmentShare)

export function retainedWorkingInterestFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  return {
    title: 'Retained Working Interest',
    description: "Operator's remaining WI after assignments.",
    inputs: [
      { label: 'Pre-WI decimal', value: decAndPct(tract.preWorkingInterestDecimal) },
      { label: 'Assignment share', value: pct(tract.assignmentShare) },
    ],
    steps: [
      {
        label: 'Assigned WI = Pre-WI × Assignment share',
        expression: `${dec(tract.preWorkingInterestDecimal)} × ${pct(tract.assignmentShare)}`,
        value: `= ${decAndPct(tract.assignedWorkingInterestDecimal)}`,
      },
      {
        label: 'Retained = Pre-WI − Assigned',
        expression: `${dec(tract.preWorkingInterestDecimal)} − ${dec(tract.assignedWorkingInterestDecimal)}`,
        value: `= ${decAndPct(tract.retainedWorkingInterestDecimal)}`,
      },
    ],
    result: {
      label: 'Retained Working Interest',
      value: decAndPct(tract.retainedWorkingInterestDecimal),
    },
    note: tract.overAssigned
      ? 'Over-assigned: WI assignments exceed 100%. Retained WI clamped to 0.'
      : undefined,
  };
}

// ── 9. Assigned Working Interest (tract) ────────────────
// = preWI × assignmentShare

export function assignedWorkingInterestFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  return {
    title: 'Assigned Working Interest',
    description: 'WI carved off to assignees (cumulative across all assignments on this tract).',
    inputs: [
      { label: 'Pre-WI decimal', value: decAndPct(tract.preWorkingInterestDecimal) },
      { label: 'Assignment share', value: pct(tract.assignmentShare) },
    ],
    steps: [
      {
        label: 'Pre-WI × Assignment share',
        expression: `${dec(tract.preWorkingInterestDecimal)} × ${pct(tract.assignmentShare)}`,
        value: `= ${decAndPct(tract.assignedWorkingInterestDecimal)}`,
      },
    ],
    result: {
      label: 'Assigned WI',
      value: decAndPct(tract.assignedWorkingInterestDecimal),
    },
    note: tract.overAssigned
      ? 'Over-assigned: assignments exceed 100%. Assigned WI capped by available Pre-WI.'
      : undefined,
  };
}

// ── 10. Per-slice Owner Tract Royalty ───────────────────
// leasehold-summary.ts:461 — leasedFraction × leaseRoyaltyRate

export function leaseSliceOwnerRoyaltyFormula(
  slice: LeaseholdOwnerLeaseSummary
): FormulaContent {
  return {
    title: 'Owner Royalty (this lease)',
    description: "Owner's gross royalty from this specific lease slice.",
    inputs: [
      {
        label: 'Leased fraction',
        value: `${formatAsFraction(slice.leasedFraction)} (${dec(slice.leasedFraction)})`,
      },
      { label: 'Lease royalty rate', value: slice.leaseRoyaltyRate || '—' },
    ],
    steps: [
      {
        label: 'Leased fraction × Royalty rate',
        expression: `${formatAsFraction(slice.leasedFraction)} × ${slice.leaseRoyaltyRate || '0'}`,
        value: `= ${decAndPct(slice.ownerTractRoyalty)}`,
      },
    ],
    result: {
      label: 'Owner Royalty',
      value: decAndPct(slice.ownerTractRoyalty),
    },
  };
}

// ── 11. Per-slice Net After Floating NPRI ───────────────
// leasehold-summary.ts:943 — ownerTractRoyalty − floatingNpriBurdenRate (clamped ≥ 0)

export function leaseSliceNetOwnerTractRoyaltyFormula(
  slice: LeaseholdOwnerLeaseSummary
): FormulaContent {
  return {
    title: 'Net After Floating NPRI',
    description: "Lease-slice royalty after floating NPRIs are carved out. Fixed NPRIs are subtracted later at tract level.",
    inputs: [
      { label: 'Owner royalty (this lease)', value: decAndPct(slice.ownerTractRoyalty) },
      { label: 'Floating NPRI burden', value: decAndPct(slice.floatingNpriBurdenRate) },
    ],
    steps: [
      {
        label: 'Owner royalty − Floating NPRI',
        expression: `${dec(slice.ownerTractRoyalty)} − ${dec(slice.floatingNpriBurdenRate)}`,
        value: `= ${decAndPct(slice.netOwnerTractRoyalty)}`,
      },
    ],
    result: {
      label: 'Net Owner Tract Royalty',
      value: decAndPct(slice.netOwnerTractRoyalty),
    },
    note: 'Clamped to 0 when floating NPRI exceeds the lease royalty.',
  };
}

// ── 12. Per-slice Leased Fraction ───────────────────────

export function leaseSliceLeasedFractionFormula(
  slice: LeaseholdOwnerLeaseSummary,
  owner: LeaseholdOwnerSummary
): FormulaContent {
  return {
    title: 'Leased Fraction (this slice)',
    description: 'Portion of the owner\'s undivided mineral interest covered by this lease.',
    inputs: [
      { label: 'Owner mineral fraction', value: `${formatAsFraction(owner.fraction)} (${dec(owner.fraction)})` },
      { label: 'Slice leased fraction', value: `${formatAsFraction(slice.leasedFraction)} (${dec(slice.leasedFraction)})` },
    ],
    steps: [
      {
        label: 'Allocated by lease coverage',
        expression: `lease covers ${dec(slice.leasedFraction)} of the whole tract`,
        value: `= ${decAndPct(slice.leasedFraction)}`,
      },
    ],
    result: {
      label: 'Leased Fraction',
      value: decAndPct(slice.leasedFraction),
    },
    note: 'Multiple overlapping leases are split chronologically; earlier leases claim their share first.',
  };
}

// ── 13. Per-NPRI Tract Burden Rate ──────────────────────
// Varies by royaltyKind:
//   floating: leasedFraction × leaseRoyaltyRate × burdenFraction (per slice, summed)
//   fixed + whole_tract: leasedFraction / burdenedBranchOwnership × burdenFraction
//   fixed + burdened_branch: leasedFraction × burdenFraction

export function npriTractBurdenRateFormula(
  npri: LeaseholdNpriSummary
): FormulaContent {
  const desc = npri.royaltyKind === 'floating'
    ? 'Floating NPRI: scales with the lease royalty on the burdened branch.'
    : npri.fixedRoyaltyBasis === 'whole_tract'
      ? 'Fixed NPRI (whole-tract basis): a fixed fraction of the whole tract, prorated across the burdened branch\'s leased coverage.'
      : 'Fixed NPRI (burdened-branch basis): a fixed fraction of the burdened branch\'s leased coverage.';
  return {
    title: 'NPRI Tract Burden Rate',
    description: desc,
    inputs: [
      { label: 'Burden fraction', value: npri.burdenFraction || '—' },
      { label: 'Burdened branch', value: npri.burdenedBranchOwner || '—' },
      { label: 'Kind', value: npri.royaltyKind === 'floating' ? 'Floating' : 'Fixed' },
    ],
    steps: [
      {
        label: 'Tract burden rate (summed across affected lease slices)',
        expression: 'see code (lease-slice multiplications)',
        value: `= ${decAndPct(npri.tractBurdenRate)}`,
      },
    ],
    result: {
      label: 'Tract Burden Rate',
      value: decAndPct(npri.tractBurdenRate),
    },
    note: !npri.includedInMath
      ? 'Excluded from math — burdened branch has no active lease coverage yet.'
      : undefined,
  };
}

// ── 14. Per-NPRI Unit Decimal ───────────────────────────
// unitDecimal = unitParticipation × tractBurdenRate (leasehold-summary.ts:897)

export function npriUnitDecimalFormula(
  npri: LeaseholdNpriSummary,
  tract?: LeaseholdTractSummary | null
): FormulaContent {
  const inputs: { label: string; value: string }[] = [
    { label: 'NPRI tract burden rate', value: decAndPct(npri.tractBurdenRate) },
  ];
  if (tract) {
    inputs.push({ label: 'Unit participation (TPF)', value: pct(tract.unitParticipation) });
  }
  return {
    title: 'NPRI Unit Decimal',
    description: 'NPRI burden expressed as a fraction of the unit payout.',
    inputs,
    steps: [
      {
        label: 'Tract burden × Unit participation',
        expression: tract
          ? `${dec(npri.tractBurdenRate)} × ${pct(tract.unitParticipation)}`
          : `${dec(npri.tractBurdenRate)} × (TPF)`,
        value: `= ${decAndPct(npri.unitDecimal)}`,
      },
    ],
    result: {
      label: 'NPRI Unit Decimal',
      value: decAndPct(npri.unitDecimal),
    },
  };
}

// ── 15. Per-ORRI Unit Decimal ───────────────────────────
// unitDecimal = unitParticipation × orriBurdenRate (per-ORRI burden by basis)

export function orriUnitDecimalFormula(
  orri: LeaseholdOrriSummary,
  tract?: LeaseholdTractSummary | null
): FormulaContent {
  const basisLabel = orri.burdenBasis === 'gross_8_8'
    ? 'Gross 8/8 — leasedOwnership × burdenFraction'
    : orri.burdenBasis === 'working_interest'
      ? 'Working Interest — leasedOwnership × burdenFraction (stacks on WI)'
      : 'NRI basis — applied sequentially against the remaining NRI';
  const inputs: { label: string; value: string }[] = [
    { label: 'Payee', value: orri.payee || '—' },
    { label: 'Burden fraction', value: orri.burdenFraction || '—' },
    { label: 'Burden basis', value: basisLabel },
    { label: 'Scope', value: orri.scope === 'unit' ? `Unit ${orri.unitCode ?? ''}` : `Tract ${orri.tractName}` },
  ];
  if (tract) {
    inputs.push({ label: 'Unit participation (TPF)', value: pct(tract.unitParticipation) });
  }
  return {
    title: 'ORRI Unit Decimal',
    description: 'Override royalty burden expressed as a fraction of the unit payout. Math varies by basis (gross 8/8, WI, or NRI).',
    inputs,
    steps: [
      {
        label: 'Per-tract burden × Unit participation (summed across scoped tracts)',
        expression: orri.scope === 'unit'
          ? 'Σ tracts (unitParticipation × orriBurdenRate)'
          : 'unitParticipation × orriBurdenRate',
        value: `= ${decAndPct(orri.unitDecimal)}`,
      },
    ],
    result: {
      label: 'ORRI Unit Decimal',
      value: decAndPct(orri.unitDecimal),
    },
    note: !orri.includedInMath
      ? 'Excluded from math — scope has no leased participation yet.'
      : undefined,
  };
}

// ── 16. Per-assignment Unit Decimal ─────────────────────
// unit scope: sum over scoped tracts of preWI × workingInterestFraction
// tract scope: tract.preWI × workingInterestFraction

export function assignmentUnitDecimalFormula(
  assignment: LeaseholdAssignmentSummary,
  tract?: LeaseholdTractSummary | null
): FormulaContent {
  const inputs: { label: string; value: string }[] = [
    { label: 'Assignee', value: assignment.assignee || '—' },
    { label: 'WI fraction', value: assignment.workingInterestFraction || '—' },
    { label: 'Scope', value: assignment.scope === 'unit' ? `Unit ${assignment.unitCode ?? ''}` : `Tract ${assignment.tractName}` },
  ];
  if (tract) {
    inputs.push({ label: 'Pre-WI decimal', value: decAndPct(tract.preWorkingInterestDecimal) });
  }
  return {
    title: 'Assignment Unit Decimal',
    description: "Assignee's working-interest share expressed as a fraction of the unit payout.",
    inputs,
    steps: [
      {
        label: assignment.scope === 'unit'
          ? 'Σ tracts (Pre-WI × WI fraction)'
          : 'Pre-WI × WI fraction',
        expression: assignment.workingInterestFraction
          ? `(per-tract Pre-WI) × ${assignment.workingInterestFraction}`
          : '(per-tract Pre-WI) × 0',
        value: `= ${decAndPct(assignment.unitDecimal)}`,
      },
    ],
    result: {
      label: 'Assignment Unit Decimal',
      value: decAndPct(assignment.unitDecimal),
    },
    note: !assignment.includedInMath
      ? 'Excluded from math — scope has no Pre-WI base yet.'
      : undefined,
  };
}

// ── 17. Tract Unit Participation (TPF) ──────────────────
// = tract.pooledAcres / unitSummary.totalPooledAcres

export function unitParticipationFormula(
  tract: LeaseholdTractSummary,
  unitSummary?: LeaseholdUnitSummary
): FormulaContent {
  const inputs: { label: string; value: string }[] = [
    { label: 'Tract pooled acres', value: acres(tract.pooledAcres) },
  ];
  if (unitSummary) {
    inputs.push({ label: 'Unit total pooled acres', value: acres(unitSummary.totalPooledAcres) });
  }
  return {
    title: 'Tract Participation Factor (TPF)',
    description: "This tract's share of the unit's pooled acreage — the multiplier that scales tract-level burdens into unit-payout decimals.",
    inputs,
    steps: [
      {
        label: 'Tract pooled ÷ Unit pooled',
        expression: unitSummary
          ? `${acres(tract.pooledAcres)} ÷ ${acres(unitSummary.totalPooledAcres)}`
          : '(see unit summary)',
        value: `= ${pct(tract.unitParticipation)}`,
      },
    ],
    result: {
      label: 'TPF',
      value: pct(tract.unitParticipation),
    },
  };
}

// ── 18. Tract Leased Ownership ──────────────────────────

export function leasedOwnershipFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  const leasedOwners = tract.owners.filter(
    (o) => new Decimal(o.leasedFraction).greaterThan(0)
  );
  const steps = leasedOwners.length > 0
    ? leasedOwners.map((o) => ({
        label: o.ownerName,
        expression: dec(o.leasedFraction),
        value: `= ${decAndPct(o.leasedFraction)}`,
      }))
    : [{ label: 'No leased owners', expression: '0', value: '= 0%' }];
  return {
    title: 'Tract Leased Ownership',
    description: 'Sum of every owner\'s leased fraction on this tract. 100% means every mineral interest is under lease.',
    inputs: [
      { label: 'Owner count', value: String(tract.owners.length) },
    ],
    steps,
    result: {
      label: 'Leased Ownership',
      value: pct(tract.leasedOwnership),
    },
  };
}

// ── 19. Owner Mineral Fraction ──────────────────────────

export function ownerMineralFractionFormula(
  owner: LeaseholdOwnerSummary
): FormulaContent {
  return {
    title: 'Owner Mineral Fraction',
    description: "Owner's undivided mineral interest in this tract (their share of the whole 8/8).",
    inputs: [],
    steps: [
      {
        label: 'From the title chain',
        expression: formatAsFraction(owner.fraction),
        value: `= ${decAndPct(owner.fraction)}`,
      },
    ],
    result: {
      label: 'Mineral Fraction',
      value: `${formatAsFraction(owner.fraction)} (${pct(owner.fraction)})`,
    },
  };
}

// ── 20. Owner Leased Fraction ───────────────────────────

export function ownerLeasedFractionFormula(
  owner: LeaseholdOwnerSummary
): FormulaContent {
  const allLeased = new Decimal(owner.leasedFraction).equals(new Decimal(owner.fraction));
  const steps = owner.leaseSlices.length > 0
    ? owner.leaseSlices.map((s) => ({
        label: s.leaseName || s.lessee || s.leaseId,
        expression: dec(s.leasedFraction),
        value: `= ${decAndPct(s.leasedFraction)}`,
      }))
    : [{ label: 'No active leases', expression: '0', value: '= 0%' }];
  return {
    title: 'Owner Leased Fraction',
    description: "Portion of the owner's mineral interest currently under lease (summed across all their leases on this tract).",
    inputs: [
      { label: 'Owner mineral fraction', value: `${formatAsFraction(owner.fraction)} (${pct(owner.fraction)})` },
      { label: 'Active leases', value: String(owner.activeLeaseCount) },
    ],
    steps,
    result: {
      label: 'Leased Fraction',
      value: `${decAndPct(owner.leasedFraction)}${allLeased ? ' (fully leased)' : ''}`,
    },
  };
}

// ── 21. Tract Gross / Pooled Acres ──────────────────────

export function tractGrossAcresFormula(
  tract: LeaseholdTractSummary
): FormulaContent {
  return {
    title: 'Tract Gross Acres',
    description: 'Total surface acreage covered by this tract.',
    inputs: [],
    steps: [
      { label: 'Recorded in tract setup', expression: acres(tract.grossAcres), value: '' },
    ],
    result: { label: 'Gross Acres', value: acres(tract.grossAcres) },
  };
}

export function tractPooledAcresFormula(
  tract: LeaseholdTractSummary,
  unitSummary?: LeaseholdUnitSummary
): FormulaContent {
  return {
    title: 'Tract Pooled Acres',
    description: 'Tract acreage contributed into the unit pool. Drives the Tract Participation Factor.',
    inputs: [
      { label: 'Tract gross acres', value: acres(tract.grossAcres) },
    ],
    steps: [
      { label: 'Recorded in tract setup', expression: acres(tract.pooledAcres), value: '' },
      ...(unitSummary
        ? [{
            label: 'Share of unit pool',
            expression: `${acres(tract.pooledAcres)} ÷ ${acres(unitSummary.totalPooledAcres)}`,
            value: `= ${pct(tract.unitParticipation)} TPF`,
          }]
        : []),
    ],
    result: { label: 'Pooled Acres', value: acres(tract.pooledAcres) },
  };
}

// ── 22. Unit summary aggregates ─────────────────────────

export function unitSummaryTotalRoyaltyFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.unitRoyaltyDecimal),
    value: `= ${decAndPct(t.unitRoyaltyDecimal)}`,
  }));
  return {
    title: 'Unit Total Royalty Decimal',
    description: 'Sum of every tract\'s unit royalty contribution. This is what mineral owners collectively get from unit-level production.',
    inputs: [{ label: 'Tracts', value: String(unitSummary.tractCount) }],
    steps,
    result: {
      label: 'Total Royalty Decimal',
      value: decAndPct(unitSummary.totalRoyaltyDecimal),
    },
  };
}

export function unitSummaryTotalNpriFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.unitNpriDecimal),
    value: `= ${decAndPct(t.unitNpriDecimal)}`,
  }));
  return {
    title: 'Unit Total NPRI Decimal',
    description: 'Sum of every tract\'s NPRI burden contribution to the unit payout.',
    inputs: [{ label: 'NPRIs tracked', value: String(unitSummary.trackedNpriCount) }],
    steps,
    result: {
      label: 'Total NPRI Decimal',
      value: decAndPct(unitSummary.totalNpriDecimal),
    },
  };
}

export function unitSummaryTotalOrriFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.unitOrriDecimal),
    value: `= ${decAndPct(t.unitOrriDecimal)}`,
  }));
  return {
    title: 'Unit Total ORRI Decimal',
    description: 'Sum of every tract\'s ORRI burden contribution to the unit payout.',
    inputs: [{ label: 'ORRIs tracked', value: String(unitSummary.trackedOrriCount) }],
    steps,
    result: {
      label: 'Total ORRI Decimal',
      value: decAndPct(unitSummary.totalOrriDecimal),
    },
  };
}

export function unitSummaryTotalPooledAcresFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: acres(t.pooledAcres),
    value: '',
  }));
  return {
    title: 'Unit Total Pooled Acres',
    description: 'Sum of every tract\'s pooled acres. The denominator for every tract\'s TPF.',
    inputs: [{ label: 'Tracts', value: String(unitSummary.tractCount) }],
    steps,
    result: {
      label: 'Total Pooled Acres',
      value: acres(unitSummary.totalPooledAcres),
    },
  };
}

export function unitSummaryRetainedWiFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.retainedWorkingInterestDecimal),
    value: `= ${decAndPct(t.retainedWorkingInterestDecimal)}`,
  }));
  return {
    title: 'Unit Retained Working Interest',
    description: 'Sum of every tract\'s retained WI — what the operator keeps after assignments.',
    inputs: [
      { label: 'Pre-WI total', value: decAndPct(unitSummary.preWorkingInterestDecimal) },
      { label: 'Assigned total', value: decAndPct(unitSummary.totalAssignedWorkingInterestDecimal) },
    ],
    steps,
    result: {
      label: 'Retained WI',
      value: decAndPct(unitSummary.retainedWorkingInterestDecimal),
    },
  };
}

// ── 23. Transfer-order aggregates ───────────────────────

export function transferOrderTotalFormula(
  totalDecimal: string,
  rowCount: number
): FormulaContent {
  return {
    title: 'Transfer Order Visible Total',
    description: 'Sum of every visible decimal row (royalty + NPRI + ORRI + retained WI + assigned WI).',
    inputs: [{ label: 'Rows', value: String(rowCount) }],
    steps: [
      {
        label: 'Sum across rows',
        expression: `Σ ${rowCount} row${rowCount === 1 ? '' : 's'}`,
        value: `= ${dec(totalDecimal, 8)}`,
      },
    ],
    result: {
      label: 'Visible Total',
      value: dec(totalDecimal, 8),
    },
    note: 'A balanced unit-focus payout should sum to 1.0 (the whole 8/8).',
  };
}

export function transferOrderExpectedFormula(
  expectedDecimal: string,
  detail: string
): FormulaContent {
  return {
    title: 'Expected Coverage',
    description: detail || 'The decimal the visible rows should add up to.',
    inputs: [],
    steps: [
      {
        label: 'Derived from leased coverage in this focus',
        expression: detail,
        value: `= ${dec(expectedDecimal, 8)}`,
      },
    ],
    result: { label: 'Expected', value: dec(expectedDecimal, 8) },
  };
}

// ── Unit-summary Pre-WI ─────────────────────────────────

export function unitSummaryPreWorkingInterestFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.preWorkingInterestDecimal),
    value: `= ${decAndPct(t.preWorkingInterestDecimal)}`,
  }));
  return {
    title: 'Unit Pre-Assignment WI',
    description: 'Sum of every tract\'s Pre-WI decimal — the working-interest base available before assignments.',
    inputs: [{ label: 'Tracts', value: String(unitSummary.tractCount) }],
    steps,
    result: {
      label: 'Pre-WI Decimal',
      value: decAndPct(unitSummary.preWorkingInterestDecimal),
    },
  };
}

export function unitSummaryAssignedWiFormula(
  unitSummary: LeaseholdUnitSummary
): FormulaContent {
  const steps = unitSummary.tracts.map((t) => ({
    label: `${t.code} — ${t.name}`,
    expression: dec(t.assignedWorkingInterestDecimal),
    value: `= ${decAndPct(t.assignedWorkingInterestDecimal)}`,
  }));
  return {
    title: 'Unit Assigned WI',
    description: 'Sum of every tract\'s assigned WI — total WI carved off to assignees.',
    inputs: [{ label: 'Tracts', value: String(unitSummary.tractCount) }],
    steps,
    result: {
      label: 'Assigned WI',
      value: decAndPct(unitSummary.totalAssignedWorkingInterestDecimal),
    },
  };
}

// ── Per-row Transfer Order decimal ──────────────────────

export function transferOrderRowFormula(
  row: LeaseholdDecimalRow
): FormulaContent {
  const categoryLabel: Record<LeaseholdDecimalRow['category'], string> = {
    royalty: 'Royalty payment to mineral owner',
    npri: 'NPRI burden — non-cost-bearing royalty',
    orri: 'ORRI burden — override royalty',
    retained_wi: 'Retained working interest (operator/lessee)',
    assigned_wi: 'Assigned working interest',
    unleased: 'Unleased mineral interest — cost-bearing',
  };
  return {
    title: `Transfer-order Decimal — ${row.category.toUpperCase()}`,
    description: `${categoryLabel[row.category]}. The detailed math behind this number lives on the source ${row.category === 'orri' ? 'ORRI' : row.category === 'npri' ? 'NPRI' : 'lease/assignment'} card; this row is the final unit-payout decimal that lands on the transfer-order sheet.`,
    inputs: [
      { label: 'Payee', value: row.payee },
      { label: 'Tract', value: row.tractName },
      { label: 'Source', value: row.sourceLabel },
      { label: 'Effective date', value: row.effectiveDate || '—' },
      { label: 'Source doc', value: row.sourceDocNo || '—' },
    ],
    steps: [
      {
        label: 'Derived from source record',
        expression: row.sourceLabel,
        value: `= ${dec(row.decimal, 8)}`,
      },
    ],
    result: { label: 'Decimal', value: dec(row.decimal, 8) },
    note: 'Open the source card (Map / Deck / Overview) for the full derivation.',
  };
}

export function transferOrderVarianceFormula(
  totalDecimal: string,
  expectedDecimal: string,
  varianceDecimal: string
): FormulaContent {
  return {
    title: 'Transfer Order Variance',
    description: 'Difference between the visible total and the expected coverage. Should be ~0 for a balanced payout.',
    inputs: [
      { label: 'Visible total', value: dec(totalDecimal, 8) },
      { label: 'Expected', value: dec(expectedDecimal, 8) },
    ],
    steps: [
      {
        label: '|Visible − Expected|',
        expression: `|${dec(totalDecimal, 8)} − ${dec(expectedDecimal, 8)}|`,
        value: `= ${dec(varianceDecimal, 8)}`,
      },
    ],
    result: { label: 'Variance', value: dec(varianceDecimal, 8) },
    note: new Decimal(varianceDecimal).greaterThan(0)
      ? 'Non-zero variance — review the rows below.'
      : 'Balanced.',
  };
}
