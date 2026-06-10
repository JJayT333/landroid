/**
 * Phase 4 / T3 title cutover — governed read path (DEFAULT OFF).
 *
 * The read path is the actual cutover switch: in `shadow` the title projection
 * comes from the current store/adapter (canonical); in `cutover` it comes from
 * the action layer (replayed from durable records). It defaults to `shadow`, the
 * store keeps shadow-running in both modes, and the flip is a single reversible
 * flag. The flag is governed/default-off: tests may enable it explicitly, while
 * production enablement remains a separate reviewed decision.
 */
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import { replayTitleProjection } from './title-replay';

export type TitleReadPathMode = 'shadow' | 'cutover';

/** The default — the current store stays the source of truth for reads. */
export const DEFAULT_TITLE_READ_PATH_MODE: TitleReadPathMode = 'shadow';

export interface TitleReadPathGovernance {
  /** False by default; true only for tests or a future reviewed enablement PR. */
  cutoverEnabled: boolean;
}

export const DEFAULT_TITLE_READ_PATH_GOVERNANCE: TitleReadPathGovernance = {
  cutoverEnabled: false,
};

export class TitleReadFlipDisabledError extends Error {
  constructor() {
    super(
      'Title read flip is disabled by default governance; enabling it requires a separate reviewed decision.'
    );
    this.name = 'TitleReadFlipDisabledError';
  }
}

export interface SelectTitleProjectionInput {
  mode: TitleReadPathMode;
  /** Current store/adapter title projection (the canonical shadow source). */
  storeTitleRecords: readonly BackendSpineCoreRecord[];
  /** Durable records to replay from when in `cutover`. */
  actionRecords: readonly BackendSpineCoreRecord[];
}

/**
 * The single read-path selector. Pure and reversible: switching `mode` between
 * `shadow` and `cutover` is the entire flip, with no other state to migrate.
 */
export function selectTitleProjection(
  input: SelectTitleProjectionInput
): BackendSpineCoreRecord[] {
  if (input.mode === 'cutover') {
    return replayTitleProjection(input.actionRecords);
  }
  return [...input.storeTitleRecords];
}

/**
 * A reversible holder for the read-path mode. Defaults to `shadow`. The store
 * keeps shadow-running regardless of mode. Provided so a reviewer (or a test)
 * can flip and revert in one place; default governance blocks `cutOver`.
 */
export class TitleReadPathFlag {
  private mode: TitleReadPathMode;

  constructor(
    initial: TitleReadPathMode = DEFAULT_TITLE_READ_PATH_MODE,
    private governance: TitleReadPathGovernance =
      DEFAULT_TITLE_READ_PATH_GOVERNANCE
  ) {
    this.mode = initial;
  }

  getMode(): TitleReadPathMode {
    return this.mode;
  }

  /** Whether cutover governance is armed (cutOver permitted when gates pass). */
  isCutoverEnabled(): boolean {
    return this.governance.cutoverEnabled;
  }

  /**
   * Arm or disarm the cutover governance at runtime. While disarmed,
   * {@link cutOver} throws {@link TitleReadFlipDisabledError};
   * {@link revertToShadow} stays available either way.
   */
  setCutoverEnabled(enabled: boolean): void {
    this.governance = { ...this.governance, cutoverEnabled: enabled };
  }

  isCutover(): boolean {
    return this.mode === 'cutover';
  }

  /** Flip to cutover (reviewer action). Reversible via {@link revertToShadow}. */
  cutOver(options: { reviewerApprovalToken: string }): void {
    if (!this.governance.cutoverEnabled) {
      throw new TitleReadFlipDisabledError();
    }
    if (!options.reviewerApprovalToken.trim()) {
      throw new Error('Title read flip requires a reviewer approval token.');
    }
    this.mode = 'cutover';
  }

  /** Revert to the shadow read path. Always available. */
  revertToShadow(): void {
    this.mode = 'shadow';
  }

  select(input: Omit<SelectTitleProjectionInput, 'mode'>): BackendSpineCoreRecord[] {
    return selectTitleProjection({ ...input, mode: this.mode });
  }
}
