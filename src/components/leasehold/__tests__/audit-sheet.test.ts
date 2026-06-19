import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { buildTractAuditFormulas, buildUnitAuditSheet } from '../audit-sheet';
import {
  preWorkingInterestFormula,
  retainedWorkingInterestFormula,
  tractUnitRoyaltyFormula,
} from '../leasehold-formulas';
import { buildLeaseholdUnitSummary } from '../../../title-math';
import {
  createBlankNode,
  normalizeOwnershipNode,
  type DeskMap,
  type OwnershipNode,
} from '../../../types/node';
import {
  createBlankLease,
  createBlankOwner,
  type Lease,
} from '../../../types/owner';

const WS = 'ws-audit';

function root(): OwnershipNode {
  return normalizeOwnershipNode({
    ...createBlankNode('root'),
    grantor: 'State of Texas',
    grantee: 'Acme',
    instrument: 'Patent',
    fraction: '1.000000000',
    initialFraction: '1.000000000',
    interestClass: 'mineral',
    linkedOwnerId: 'owner-1',
  });
}

function deskMap(): DeskMap {
  return {
    id: 'dm-1',
    name: 'Tract One',
    code: 'T-1',
    tractId: 'LAND-1',
    grossAcres: '100',
    pooledAcres: '100',
    description: '',
    nodeIds: ['root'],
  } as DeskMap;
}

function lease(): Lease {
  return createBlankLease(WS, 'owner-1', {
    id: 'lease-1',
    leaseName: 'Lease',
    lessee: 'Operator',
    royaltyRate: '1/8',
    leasedInterest: '1/2',
    effectiveDate: '2026-01-01',
    jurisdiction: 'tx_fee',
  });
}

function unitSummary() {
  return buildLeaseholdUnitSummary({
    deskMaps: [deskMap()],
    nodes: [root()],
    owners: [createBlankOwner(WS, { id: 'owner-1', name: 'Acme', entityType: 'Company' })],
    leases: [lease()],
    leaseholdAssignments: [],
    leaseholdOrris: [],
  });
}

describe('buildUnitAuditSheet', () => {
  it('builds a per-tract derivation chain + the unit roll-up totals', () => {
    const sheet = buildUnitAuditSheet(unitSummary());

    expect(sheet.tracts).toHaveLength(1);
    const tractSheet = sheet.tracts[0];
    expect(tractSheet.tractName).toBe('Tract One');
    expect(tractSheet.tractCode).toBe('T-1');
    expect(tractSheet.deskMapId).toBe('dm-1');

    // Six staged derivations per tract; each is a well-formed FormulaContent.
    expect(tractSheet.formulas).toHaveLength(6);
    for (const formula of tractSheet.formulas) {
      expect(formula.title).toBeTruthy();
      expect(Array.isArray(formula.steps)).toBe(true);
      expect(formula.result.value).toBeTruthy();
    }

    // Six unit-level roll-ups.
    expect(sheet.unitTotals).toHaveLength(6);
  });

  it('embeds the exact same builders the on-screen tooltips use (printed math == app math)', () => {
    const summary = unitSummary();
    const tract = summary.tracts[0];
    const formulas = buildTractAuditFormulas(tract);

    // The assembler wires the real builders, in reading order — no re-derivation.
    expect(formulas[0]).toEqual(tractUnitRoyaltyFormula(tract));
    expect(formulas[3]).toEqual(preWorkingInterestFormula(tract));
    expect(formulas[5]).toEqual(retainedWorkingInterestFormula(tract));
  });
});

describe('preWorkingInterestFormula reconciles to the engine (DA-H1 fixed-NPRI excess)', () => {
  it('charges only the fixed-NPRI excess to WI and the printed steps reconcile to the result', () => {
    // Synthesize a fixed-NPRI tract by overriding a real engine tract: the full
    // fixed-NPRI burden is 10%, but only the 5% in excess of the lessor royalty
    // is charged to the working interest (npriAdjusted = nriBeforeOrri − excess).
    //   preWorkingInterestRate = npriAdjusted − totalOrri = 0.825 − 0.025 = 0.80
    //   preWorkingInterestDecimal = unitParticipation × rate = 0.5 × 0.80 = 0.40
    // The OLD builder subtracted the FULL fixed NPRI (and a hand-rolled
    // leased−royalty base), printing a rate of ~0.75 → 0.375, contradicting the
    // 0.40 result line on every fixed-NPRI tract.
    const tract = {
      ...unitSummary().tracts[0],
      nriBeforeOrriRate: '0.875',
      fixedNpriBurdenRate: '0.1',
      npriAdjustedNriBeforeOrriRate: '0.825',
      totalOrriBurdenRate: '0.025',
      unitParticipation: '0.5',
      preWorkingInterestDecimal: '0.4',
      overBurdened: false,
    };

    const formula = preWorkingInterestFormula(tract);

    // Only the excess over royalty (5%) is charged to WI — NOT the full 10%.
    const excessInput = formula.inputs?.find((i) => /excess/i.test(i.label));
    const fullInput = formula.inputs?.find((i) => /full/i.test(i.label));
    expect(excessInput?.value).toBe('5.0000%');
    expect(fullInput?.value).toBe('10.0000%');

    // The printed derivation reconciles to the engine result (the bug was that
    // it did not): rate = npriAdjusted − totalOrri, clamped, × unitParticipation.
    const rate = new Decimal(tract.npriAdjustedNriBeforeOrriRate).minus(
      tract.totalOrriBurdenRate
    );
    const recomputed = Decimal.max(rate, new Decimal(0)).times(tract.unitParticipation);
    expect(recomputed.toFixed(7)).toBe(
      new Decimal(tract.preWorkingInterestDecimal).toFixed(7)
    );

    // The final printed step shows the engine's pre-WI decimal.
    expect(formula.steps.at(-1)?.value).toContain(new Decimal('0.4').toFixed(7));
  });

  it('reconciles on a real (no fixed-NPRI) engine tract too', () => {
    const tract = unitSummary().tracts[0];
    const formula = preWorkingInterestFormula(tract);

    const rate = new Decimal(tract.npriAdjustedNriBeforeOrriRate).minus(
      tract.totalOrriBurdenRate
    );
    const recomputed = Decimal.max(rate, new Decimal(0)).times(tract.unitParticipation);
    expect(recomputed.toFixed(7)).toBe(
      new Decimal(tract.preWorkingInterestDecimal).toFixed(7)
    );
    // The printed result line shows that same engine decimal.
    expect(formula.result.value).toContain(
      new Decimal(tract.preWorkingInterestDecimal).toFixed(7)
    );
  });
});
