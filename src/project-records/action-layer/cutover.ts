/**
 * Phase 4 — cutover mechanism (BUILT, NEVER FLIPPED).
 *
 * Cutting a workflow's source of truth over to the action layer is
 * irreversible-class, so this run builds the mechanism and the parity proof but
 * STOPS at the gate (guardrail 2): it never flips a live workflow. The reviewer
 * decides cutover.
 *
 * The mechanism is reversible and flag-gated:
 * - `shadow` → `candidate` is allowed ONLY when parity is clean.
 * - `candidate` → `shadow` is always allowed (reversible).
 * - `candidate` → `cutover` requires a reviewer approval token AND is hard-
 *   guarded by `LIVE_CUTOVER_DISABLED`, which is `true` for this entire run, so
 *   no code path here can flip a workflow live.
 */
import type { ActionSurface } from './commands';
import type { ParityReport } from './parity';

export type CutoverState = 'shadow' | 'candidate' | 'cutover';

/**
 * Hard gate for this run. While true, `CutoverRegistry.cutOver` always throws —
 * the action layer cannot become the canonical mutation path for any live
 * workflow in this run. Only a reviewer may change this.
 */
export const LIVE_CUTOVER_DISABLED: boolean = true;

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
      `Live cutover of "${workflow}" is disabled in this run (LIVE_CUTOVER_DISABLED). ` +
        'Build the mechanism and report candidates; the reviewer performs the flip.'
    );
    this.name = 'CutoverDisabledError';
  }
}

/**
 * Reversible, flag-gated registry of per-workflow cutover state. Defaults every
 * workflow to `shadow`. The current store stays canonical in every state except
 * `cutover`, which this run can never reach.
 */
export class CutoverRegistry {
  private readonly states = new Map<ActionSurface, CutoverState>();

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
   * Move candidate → cutover. Guarded by LIVE_CUTOVER_DISABLED (always throws in
   * this run) and additionally requires a reviewer approval token. No call site
   * in this run supplies a real flip.
   */
  cutOver(
    workflow: ActionSurface,
    options: { reviewerApprovalToken: string }
  ): void {
    if (LIVE_CUTOVER_DISABLED) {
      throw new CutoverDisabledError(workflow);
    }
    if (!options.reviewerApprovalToken) {
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
