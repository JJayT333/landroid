import { describe, expect, it } from 'vitest';
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
