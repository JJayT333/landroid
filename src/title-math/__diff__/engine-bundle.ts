/**
 * Differential-harness engine bundle (Phase A scaffolding for the unified
 * title-math rewrite).
 *
 * The "engine bundle" is the dependency-injection surface the characterization
 * harness reads through. Today there is exactly one implementation,
 * `oldEngineBundle`, wired to the live (pre-rewrite) math surfaces. As the
 * unified engine under `src/title-math/` is built, a second bundle backed by the
 * new code is fed through the SAME `captureWorkspaceNumbers` routine so old and
 * new outputs can be diffed number-for-number.
 *
 * Bundle members are typed with `typeof` the live functions so the new engine is
 * forced to match the exact public signatures it must preserve.
 *
 * This module is test/diagnostic-only and is never imported by app code.
 */
import { calculateDeskMapCoverageSummary } from '../../components/deskmap/deskmap-coverage';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../../components/leasehold/leasehold-summary';
import { dualDisplay, formatAsFraction } from '../../engine/fraction-display';
import {
  findNpriBranchDiscrepancies,
  rootOwnershipTotal,
  validateOwnershipGraph,
} from '../../engine/math-engine';
import { computeLiveOwnershipFractions } from '../../engine/tree-layout';
import * as titleMath from '../index';

export interface EngineBundle {
  buildLeaseholdUnitSummary: typeof buildLeaseholdUnitSummary;
  buildLeaseholdDecimalRows: typeof buildLeaseholdDecimalRows;
  buildLeaseholdTransferOrderReview: typeof buildLeaseholdTransferOrderReview;
  calculateDeskMapCoverageSummary: typeof calculateDeskMapCoverageSummary;
  validateOwnershipGraph: typeof validateOwnershipGraph;
  findNpriBranchDiscrepancies: typeof findNpriBranchDiscrepancies;
  rootOwnershipTotal: typeof rootOwnershipTotal;
  computeLiveOwnershipFractions: typeof computeLiveOwnershipFractions;
  formatAsFraction: typeof formatAsFraction;
  dualDisplay: typeof dualDisplay;
}

/** The live pre-rewrite math, bundled as the baseline oracle. */
export const oldEngineBundle: EngineBundle = {
  buildLeaseholdUnitSummary,
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  calculateDeskMapCoverageSummary,
  validateOwnershipGraph,
  findNpriBranchDiscrepancies,
  rootOwnershipTotal,
  computeLiveOwnershipFractions,
  formatAsFraction,
  dualDisplay,
};

/**
 * The unified engine under construction. Leasehold, coverage, and ownership come
 * from src/title-math; `computeLiveOwnershipFractions` is still the live
 * tree-layout implementation until Phase E ports it; the display formatters are
 * the shared fraction-display module (not part of the rewrite).
 */
export const newEngineBundle: EngineBundle = {
  buildLeaseholdUnitSummary: titleMath.buildLeaseholdUnitSummary,
  buildLeaseholdDecimalRows: titleMath.buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview: titleMath.buildLeaseholdTransferOrderReview,
  calculateDeskMapCoverageSummary: titleMath.calculateDeskMapCoverageSummary,
  validateOwnershipGraph: titleMath.validateOwnershipGraph,
  findNpriBranchDiscrepancies: titleMath.findNpriBranchDiscrepancies,
  rootOwnershipTotal: titleMath.rootOwnershipTotal,
  computeLiveOwnershipFractions,
  formatAsFraction,
  dualDisplay,
};
