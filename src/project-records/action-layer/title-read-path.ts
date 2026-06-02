/**
 * Phase 4 title cutover — flag-gated read path (DEFAULT OFF, NEVER FLIPPED).
 *
 * The read path is the actual cutover switch: in `shadow` the title projection
 * comes from the current store/adapter (canonical); in `cutover` it comes from
 * the action layer (replayed from durable records). It defaults to `shadow`, the
 * store keeps shadow-running in both modes, and the flip is a single reversible
 * flag. This run builds the switch and proves it round-trips, but never flips it
 * live (guardrail 2) — no call site sets `cutover`.
 */
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import { replayTitleProjection } from './title-replay';

export type TitleReadPathMode = 'shadow' | 'cutover';

/** The default — the current store stays the source of truth for reads. */
export const DEFAULT_TITLE_READ_PATH_MODE: TitleReadPathMode = 'shadow';

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
 * can flip and revert in one place; NO application call site constructs this in
 * `cutover` or calls {@link cutOver} in this run.
 */
export class TitleReadPathFlag {
  private mode: TitleReadPathMode;

  constructor(initial: TitleReadPathMode = DEFAULT_TITLE_READ_PATH_MODE) {
    this.mode = initial;
  }

  getMode(): TitleReadPathMode {
    return this.mode;
  }

  isCutover(): boolean {
    return this.mode === 'cutover';
  }

  /** Flip to cutover (reviewer action). Reversible via {@link revertToShadow}. */
  cutOver(): void {
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
