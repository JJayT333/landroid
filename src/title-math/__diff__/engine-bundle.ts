/**
 * Differential-harness engine bundle (Phase A scaffolding for the unified
 * title-math rewrite).
 *
 * The "engine bundle" is the dependency-injection surface the characterization
 * harness reads through. During the port it had two genuinely distinct
 * implementations: `oldEngineBundle` (the real pre-rewrite modules) and
 * `newEngineBundle` (src/title-math), and old-vs-new outputs were diffed
 * number-for-number to verify the port.
 *
 * NOTE (post-cutover): rewrite Phase F turned the four old modules into shims
 * that re-export src/title-math, so `oldEngineBundle` now resolves to the SAME
 * code as `newEngineBundle` -- they are no longer independent. The two-bundle
 * shape is kept for history/structure, but a diff between them today is a
 * self-consistency check, not an old-vs-new differential. See
 * scripts/title-math-baseline.ts for the full "what this does/doesn't prove".
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
  computeLiveOwnershipFractions: titleMath.computeLiveOwnershipFractions,
  formatAsFraction,
  dualDisplay,
};
