/**
 * Phase 4 / T3 — governed cutover mechanism (DEFAULT OFF).
 *
 * Cutting a workflow's source of truth over to the action layer is
 * irreversible-class, so this run builds the mechanism and the parity proof but
 * STOPS at the gate (guardrail 2): it never flips a live workflow. The reviewer
 * decides cutover.
 *
 * The mechanism is reversible and flag-gated:
 * - `shadow` → `candidate` is allowed ONLY when parity is clean.
 * - `candidate` → `shadow` is always allowed (reversible).
 * - `candidate` → `cutover` requires a reviewer approval token AND an explicit
 *   governance object with live cutover enabled. The default governance leaves
 *   production cutover off; enabling it remains a separate reviewed decision.
 */
import type { ActionSurface } from './commands';
import type { ParityReport } from './parity';

export type CutoverState = 'shadow' | 'candidate' | 'cutover';

/** Default posture: production cutover remains disabled. */
export const DEFAULT_LIVE_CUTOVER_ENABLED = false;

/**
 * Compatibility status flag for older docs/tests. The registry now consults
 * per-instance governance, but the default runtime posture is still disabled.
 */
export const LIVE_CUTOVER_DISABLED = !DEFAULT_LIVE_CUTOVER_ENABLED;

export interface CutoverGovernance {
  /** False by default; true only in tests or a future reviewed enablement PR. */
  liveCutoverEnabled: boolean;
}

export const DEFAULT_CUTOVER_GOVERNANCE: CutoverGovernance = {
  liveCutoverEnabled: DEFAULT_LIVE_CUTOVER_ENABLED,
};

export interface CutoverEvaluation {
  workflow: ActionSurface;
  eligible: boolean;
  parityClean: boolean;
  reason: string;
}

/** A workflow is eligible to be PROPOSED as a candidate only with clean parity. */
export function evaluateCutoverCandidate(input: {
  workflow: ActionSurface;
  parityReport: ParityReport;
}): CutoverEvaluation {
  const parityClean = input.parityReport.clean;
  return {
    workflow: input.workflow,
    eligible: parityClean,
    parityClean,
    reason: parityClean
      ? 'Parity is clean — eligible to propose as a cutover candidate (reviewer decides the flip).'
      : 'Parity diverges — not eligible. Resolve the divergence before cutover.',
  };
}

export interface CutoverCandidate {
  workflow: ActionSurface;
  parityClean: true;
  expectedRecordCount: number;
  liveCutoverPerformed: false;
  recommendation: string;
}

/**
 * Report the workflows whose parity is clean as cutover CANDIDATES. This never
 * flips anything; `liveCutoverPerformed` is always false.
 */
export function reportCutoverCandidates(
  reports: readonly ParityReport[]
): CutoverCandidate[] {
  return reports
    .filter((report) => report.clean)
    .map((report) => ({
      workflow: report.workflow,
      parityClean: true,
      expectedRecordCount: report.expectedCount,
      liveCutoverPerformed: false,
      recommendation:
        'Parity clean — reviewer may approve cutover. No live workflow was flipped in this run.',
    }));
}

export class CutoverDisabledError extends Error {
  constructor(workflow: ActionSurface) {
    super(
      `Live cutover of "${workflow}" is disabled by default governance. ` +
        'A separate reviewed decision must enable the flip.'
    );
    this.name = 'CutoverDisabledError';
  }
}

/**
 * Reversible, flag-gated registry of per-workflow cutover state. Defaults every
 * workflow to `shadow`. The current store stays canonical in every state except
 * `cutover`, and default governance prevents reaching `cutover` in production.
 */
export class CutoverRegistry {
  private readonly states = new Map<ActionSurface, CutoverState>();

  constructor(
    private readonly governance: CutoverGovernance = DEFAULT_CUTOVER_GOVERNANCE
  ) {}

  getState(workflow: ActionSurface): CutoverState {
    return this.states.get(workflow) ?? 'shadow';
  }

  /** Move shadow → candidate. Requires clean parity; otherwise throws. */
  proposeCandidate(workflow: ActionSurface, parityReport: ParityReport): void {
    if (!parityReport.clean) {
      throw new Error(
        `Cannot propose "${workflow}" as a cutover candidate: parity diverges (a bug).`
      );
    }
    this.states.set(workflow, 'candidate');
  }

  /** Move candidate → shadow. Always allowed (the mechanism is reversible). */
  revertToShadow(workflow: ActionSurface): void {
    this.states.set(workflow, 'shadow');
  }

  /**
   * Move candidate → cutover. Default governance throws; tests may pass explicit
   * enabled governance, and production enablement must happen in a later
   * reviewed PR.
   */
  cutOver(
    workflow: ActionSurface,
    options: { reviewerApprovalToken: string }
  ): void {
    if (!this.governance.liveCutoverEnabled) {
      throw new CutoverDisabledError(workflow);
    }
    if (!options.reviewerApprovalToken.trim()) {
      throw new Error(`Cutover of "${workflow}" requires a reviewer approval token.`);
    }
    if (this.getState(workflow) !== 'candidate') {
      throw new Error(`Workflow "${workflow}" must be a clean candidate before cutover.`);
    }
    this.states.set(workflow, 'cutover');
  }

  candidates(): ActionSurface[] {
    return [...this.states.entries()]
      .filter(([, state]) => state === 'candidate')
      .map(([workflow]) => workflow);
  }

  liveWorkflows(): ActionSurface[] {
    return [...this.states.entries()]
      .filter(([, state]) => state === 'cutover')
      .map(([workflow]) => workflow);
  }
}
