/**
 * Audit Sheet assembler — a printable, per-tract derivation of the leasehold math.
 *
 * Reuses the same `FormulaContent` builders that power the on-screen formula
 * tooltips (so the printed arithmetic is byte-for-byte what the app shows), and
 * lays them out as a static, examiner-facing sheet: for each tract, the staged
 * derivation of its unit royalty / NPRI / ORRI / pre-WI / assigned-WI /
 * retained-WI; then the unit roll-up totals.
 *
 * Pure: summary in → ordered FormulaContent out. The renderer is a separate,
 * print-styled component; this module holds no React and no DOM.
 */
import type { FormulaContent } from './FormulaTooltip';
import {
  tractUnitRoyaltyFormula,
  tractUnitNpriFormula,
  tractUnitOrriFormula,
  preWorkingInterestFormula,
  assignedWorkingInterestFormula,
  retainedWorkingInterestFormula,
  unitSummaryTotalRoyaltyFormula,
  unitSummaryTotalNpriFormula,
  unitSummaryTotalOrriFormula,
  unitSummaryPreWorkingInterestFormula,
  unitSummaryAssignedWiFormula,
  unitSummaryRetainedWiFormula,
} from './leasehold-formulas';
import type {
  LeaseholdTractSummary,
  LeaseholdUnitSummary,
} from '../../title-math';

export interface TractAuditSheet {
  /** Display name of the tract (its desk-map name). */
  tractName: string;
  /** Desk-map code, e.g. "4a". */
  tractCode: string;
  /** Stable identifier for React keys / deep links (desk-map id). */
  deskMapId: string;
  /** The staged derivations, in reading order. */
  formulas: FormulaContent[];
}

export interface UnitAuditSheet {
  tracts: TractAuditSheet[];
  /** Unit-level roll-up derivations. */
  unitTotals: FormulaContent[];
}

/** The per-tract derivation chain, in the order an examiner reads it. */
export function buildTractAuditFormulas(
  tract: LeaseholdTractSummary
): FormulaContent[] {
  return [
    tractUnitRoyaltyFormula(tract),
    tractUnitNpriFormula(tract),
    tractUnitOrriFormula(tract),
    preWorkingInterestFormula(tract),
    assignedWorkingInterestFormula(tract),
    retainedWorkingInterestFormula(tract),
  ];
}

/** Assemble the full unit audit sheet from a leasehold unit summary. */
export function buildUnitAuditSheet(
  summary: LeaseholdUnitSummary
): UnitAuditSheet {
  return {
    tracts: summary.tracts.map((tract) => ({
      tractName: tract.name,
      tractCode: tract.code,
      deskMapId: tract.deskMapId,
      formulas: buildTractAuditFormulas(tract),
    })),
    unitTotals: [
      unitSummaryTotalRoyaltyFormula(summary),
      unitSummaryTotalNpriFormula(summary),
      unitSummaryTotalOrriFormula(summary),
      unitSummaryPreWorkingInterestFormula(summary),
      unitSummaryAssignedWiFormula(summary),
      unitSummaryRetainedWiFormula(summary),
    ],
  };
}
