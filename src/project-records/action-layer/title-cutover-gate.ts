/**
 * Phase 4 title cutover — continuous parity gate (BUILT, NEVER FLIPPED).
 *
 * The title tree is the highest-risk surface, so advancing it from `shadow` to
 * `candidate` requires MORE than one clean parity run: at least
 * {@link MIN_PASSED_TITLE_PARITIES} REAL mutations must have passed inline parity,
 * the MathInputView parity gate must be clean, the `.landroid`
 * export-import-replay round trip must be clean, and runtime divergence must be
 * absent. The mechanism is reversible (`candidate → shadow` is always allowed)
 * and production `candidate → cutover` remains default-off through governance.
 *
 * This composes the Phase 4 {@link CutoverRegistry} rather than modifying it, so
 * the other surfaces' behavior is unchanged.
 */
import {
  CutoverRegistry,
  type CutoverState,
} from './cutover';
import type { ParityReport } from './parity';

/** Real title mutations that must pass inline parity before candidacy. */
export const MIN_PASSED_TITLE_PARITIES = 10;

export interface TitleCutoverReadiness {
  ready: boolean;
  passedParities: number;
  threshold: number;
  mathParityClean: boolean;
  landroidRoundTripClean: boolean;
  runtimeDivergence: boolean;
  reason: string;
}

export interface TitleCutoverRuntimeState {
  divergenceMessage: string | null;
  errorMessage: string | null;
}

export type TitleCutoverRuntimeStateReader = () => TitleCutoverRuntimeState;

const EMPTY_RUNTIME_STATE: TitleCutoverRuntimeState = {
  divergenceMessage: null,
  errorMessage: null,
};

let liveRuntimeStateReader: TitleCutoverRuntimeStateReader = () => EMPTY_RUNTIME_STATE;

export function setTitleCutoverRuntimeStateReader(
  reader: TitleCutoverRuntimeStateReader
): void {
  liveRuntimeStateReader = reader;
}

/**
 * Tracks the running count of title mutations that have passed inline parity and
 * gates candidacy on both that count and a clean math-parity result.
 */
export class TitleTreeCutoverGate {
  private passedParities = 0;
  private lastMathParityClean = false;
  private lastLandroidRoundTripClean = false;
  private runtimeDivergenceMessage: string | null = null;

  constructor(
    private readonly registry: CutoverRegistry = new CutoverRegistry(),
    private readonly threshold: number = MIN_PASSED_TITLE_PARITIES,
    private readonly runtimeStateReader: TitleCutoverRuntimeStateReader = () =>
      liveRuntimeStateReader()
  ) {}

  /**
   * Record one mutation that passed inline parity. Pass the inline parity
   * reports; a dirty report would never reach here (recording throws first), but
   * this double-checks rather than trusting the caller.
   */
  recordPassedParity(reports: readonly ParityReport[]): void {
    if (reports.some((report) => !report.clean)) {
      throw new Error(
        'Cannot count a mutation toward title candidacy: its inline parity diverged.'
      );
    }
    this.passedParities += 1;
  }

  /** Record the latest math-parity outcome (gate input, not a counter). */
  setMathParityClean(clean: boolean): void {
    this.lastMathParityClean = clean;
  }

  /** Record the latest `.landroid` export-import-replay round-trip outcome. */
  setLandroidRoundTripClean(clean: boolean): void {
    this.lastLandroidRoundTripClean = clean;
  }

  /** Record whether the live title ledger has surfaced a runtime divergence. */
  setRuntimeDivergence(active: boolean, message?: string | null): void {
    this.runtimeDivergenceMessage = active
      ? message?.trim() || 'Runtime title-ledger divergence is active.'
      : null;
  }

  getPassedParities(): number {
    return this.passedParities;
  }

  getState(): CutoverState {
    return this.registry.getState('title_tree');
  }

  private runtimeDivergenceReason(): string | null {
    if (this.runtimeDivergenceMessage) {
      return `Runtime title-ledger divergence is active: ${this.runtimeDivergenceMessage}`;
    }
    const runtimeState = this.runtimeStateReader();
    const divergenceMessage = runtimeState.divergenceMessage?.trim();
    if (divergenceMessage) {
      return `Runtime title-ledger divergence is active: ${divergenceMessage}`;
    }
    const errorMessage = runtimeState.errorMessage?.trim();
    if (errorMessage) {
      return `Runtime title-ledger recording error is active: ${errorMessage}`;
    }
    return null;
  }

  readiness(): TitleCutoverReadiness {
    const enough = this.passedParities >= this.threshold;
    const runtimeDivergenceReason = this.runtimeDivergenceReason();
    const runtimeDivergence = runtimeDivergenceReason !== null;
    const ready =
      enough
      && this.lastMathParityClean
      && this.lastLandroidRoundTripClean
      && !runtimeDivergence;
    return {
      ready,
      passedParities: this.passedParities,
      threshold: this.threshold,
      mathParityClean: this.lastMathParityClean,
      landroidRoundTripClean: this.lastLandroidRoundTripClean,
      runtimeDivergence,
      reason: ready
        ? `title_tree eligible: ${this.passedParities}/${this.threshold} parities passed, math parity clean, and .landroid round-trip clean.`
        : runtimeDivergence
          ? runtimeDivergenceReason
        : !enough
          ? `Not enough proven mutations: ${this.passedParities}/${this.threshold} passed inline parity.`
          : !this.lastMathParityClean
            ? 'Math parity is not clean; resolve the divergence before candidacy.'
          : !this.lastLandroidRoundTripClean
            ? '.landroid export-import-replay round trip is not clean; resolve before candidacy.'
          : 'Title read-flip readiness is blocked by an unknown gate state.',
    };
  }

  /**
   * Advance shadow → candidate. Requires the running parity count to have met
   * the threshold, a clean math-parity result, and a clean current parity
   * report. Throws otherwise. Never flips live.
   */
  proposeCandidate(currentReport: ParityReport): TitleCutoverReadiness {
    const readiness = this.readiness();
    if (!readiness.ready) {
      throw new Error(
        `Cannot propose title_tree as a cutover candidate: ${readiness.reason}`
      );
    }
    if (!currentReport.clean) {
      throw new Error(
        'Cannot propose title_tree as a cutover candidate: current parity diverges (a bug).'
      );
    }
    this.registry.proposeCandidate('title_tree', currentReport);
    return readiness;
  }

  /** candidate → shadow. Always allowed (reversible). */
  revertToShadow(): void {
    this.registry.revertToShadow('title_tree');
  }

  /** candidate → cutover. Default registry governance keeps production off. */
  cutOver(options: { reviewerApprovalToken: string }): TitleCutoverReadiness {
    const readiness = this.readiness();
    if (!readiness.ready) {
      throw new Error(
        `Cannot cut over title_tree: ${readiness.reason}`
      );
    }
    this.registry.cutOver('title_tree', options);
    return readiness;
  }
}
