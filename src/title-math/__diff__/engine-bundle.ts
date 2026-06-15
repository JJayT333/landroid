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
import { dualDisplay, formatAsFraction } from '../../engine/fraction-display';
import * as titleMath from '../index';

export interface EngineBundle {
  buildLeaseholdUnitSummary: typeof titleMath.buildLeaseholdUnitSummary;
  buildLeaseholdDecimalRows: typeof titleMath.buildLeaseholdDecimalRows;
  buildLeaseholdTransferOrderReview: typeof titleMath.buildLeaseholdTransferOrderReview;
  calculateDeskMapCoverageSummary: typeof titleMath.calculateDeskMapCoverageSummary;
  validateOwnershipGraph: typeof titleMath.validateOwnershipGraph;
  findNpriBranchDiscrepancies: typeof titleMath.findNpriBranchDiscrepancies;
  rootOwnershipTotal: typeof titleMath.rootOwnershipTotal;
  computeLiveOwnershipFractions: typeof titleMath.computeLiveOwnershipFractions;
  formatAsFraction: typeof formatAsFraction;
  dualDisplay: typeof dualDisplay;
}

/**
 * The unified engine bundled for the harness. Post-cutover (Stage G) the old
 * compatibility shims are deleted, so there is one implementation — src/title-math.
 * `oldEngineBundle` and `newEngineBundle` are kept as two names for the harness's
 * structure but are the SAME bundle (see the header note + scripts/title-math-baseline.ts).
 */
const titleMathBundle: EngineBundle = {
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

export const oldEngineBundle: EngineBundle = titleMathBundle;
export const newEngineBundle: EngineBundle = titleMathBundle;
