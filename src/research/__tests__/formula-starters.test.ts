import { describe, expect, it } from 'vitest';
import { buildResearchFormulaStarterRecords } from '../formula-starters';
import {
  createBlankResearchFormula,
  createBlankResearchSource,
} from '../../types/research';

describe('formula starters', () => {
  it('builds Texas current-math starter cards linked to the math reference source', () => {
    const plan = buildResearchFormulaStarterRecords('ws-1', [], []);

    expect(plan.source).toMatchObject({
      title: 'LANDMAN Math Reference',
      sourceType: 'Manual',
      context: 'Texas',
      status: 'Needs Review',
      citation: 'LANDMAN-MATH-REFERENCE.md',
    });
    expect(plan.formulas).toHaveLength(16);
    expect(plan.formulas.map((formula) => formula.title)).toEqual(
      expect.arrayContaining([
        'Lease Coverage Allocation',
        'Texas Unit Tract Participation Factor',
        'Fixed NPRI Payout',
        'Floating NPRI Payout',
        'Transfer-Order Review Variance',
      ])
    );
    expect(
      plan.formulas.every(
        (formula) =>
          formula.status === 'Needs Review' &&
          formula.category !== 'Federal / Private Prep' &&
          formula.sourceIds.includes(plan.supportingSourceId)
      )
    ).toBe(true);
  });

  it('is idempotent when the reference source and starter formulas already exist', () => {
    const source = createBlankResearchSource('ws-1', {
      id: 'custom-reference-source',
      title: 'LANDMAN Math Reference',
      citation: 'LANDMAN-MATH-REFERENCE.md',
    });
    const existingFormula = createBlankResearchFormula('ws-1', {
      id: 'formula-ws-1-net-mineral-acres',
      title: 'Net Mineral Acres (NMA)',
      sourceIds: [source.id],
    });

    const plan = buildResearchFormulaStarterRecords(
      'ws-1',
      [source],
      [existingFormula]
    );

    expect(plan.source).toBeNull();
    expect(plan.supportingSourceId).toBe(source.id);
    expect(plan.formulas.some((formula) => formula.title === existingFormula.title)).toBe(
      false
    );
    expect(plan.skippedFormulaCount).toBe(1);
  });
});
