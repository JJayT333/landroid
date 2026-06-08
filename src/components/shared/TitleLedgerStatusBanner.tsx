import { useMemo, useState } from 'react';
import { CutoverDisabledError } from '../../project-records/action-layer/cutover';
import type { ParityReport } from '../../project-records/action-layer/parity';
import {
  MIN_PASSED_TITLE_PARITIES,
  TitleTreeCutoverGate,
  type TitleCutoverReadiness,
} from '../../project-records/action-layer/title-cutover-gate';
import {
  DEFAULT_TITLE_READ_PATH_MODE,
  TitleReadFlipDisabledError,
  type TitleReadPathMode,
} from '../../project-records/action-layer/title-read-path';
import { useTitleActionLog, type TitleLedgerDivergence } from '../../store/title-action-log';

const CLEAN_TITLE_PARITY_REPORT: ParityReport = {
  workflow: 'title_tree',
  clean: true,
  expectedCount: 1,
  derivedCount: 1,
  divergences: [],
};

export interface TitleReadinessSnapshotInput {
  recordedMutationCount: number;
  mathParityClean?: boolean;
  landroidRoundTripClean?: boolean;
  runtimeDivergenceMessage?: string | null;
  runtimeErrorMessage?: string | null;
}

function normalizedPassedParities(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

export function deriveTitleCutoverReadiness({
  recordedMutationCount,
  mathParityClean = false,
  landroidRoundTripClean = false,
  runtimeDivergenceMessage = null,
  runtimeErrorMessage = null,
}: TitleReadinessSnapshotInput): TitleCutoverReadiness {
  const gate = new TitleTreeCutoverGate(undefined, MIN_PASSED_TITLE_PARITIES, () => ({
    divergenceMessage: runtimeDivergenceMessage,
    errorMessage: runtimeErrorMessage,
  }));
  const passedParities = normalizedPassedParities(recordedMutationCount);
  for (let index = 0; index < passedParities; index += 1) {
    gate.recordPassedParity([CLEAN_TITLE_PARITY_REPORT]);
  }
  gate.setMathParityClean(mathParityClean);
  gate.setLandroidRoundTripClean(landroidRoundTripClean);
  return gate.readiness();
}

export function attemptReviewerTitleCutover(readiness: TitleCutoverReadiness): Error {
  try {
    if (readiness.ready) {
      throw new CutoverDisabledError('title_tree');
    }
    throw new TitleReadFlipDisabledError();
  } catch (err) {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }
}

function formatReviewerFlipError(err: Error): string {
  return `${err.name}: ${err.message}`;
}

export default function TitleLedgerStatusBanner() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const recordedMutationCount = useTitleActionLog((state) => state.recordedMutationCount);
  const readiness = useMemo(
    () =>
      deriveTitleCutoverReadiness({
        recordedMutationCount,
        runtimeDivergenceMessage: lastDivergence
          ? `${lastDivergence.mutation}: ${lastDivergence.message}`
          : null,
        runtimeErrorMessage: lastError,
      }),
    [lastDivergence, lastError, recordedMutationCount]
  );
  const [reviewerFlipError, setReviewerFlipError] = useState<string | null>(null);

  return (
    <TitleLedgerStatusBannerContent
      lastDivergence={lastDivergence}
      lastError={lastError}
      readiness={readiness}
      readMode={DEFAULT_TITLE_READ_PATH_MODE}
      reviewerFlipError={reviewerFlipError}
      onReviewerFlip={() => {
        const err = attemptReviewerTitleCutover(readiness);
        setReviewerFlipError(formatReviewerFlipError(err));
      }}
    />
  );
}

export function TitleLedgerStatusBannerContent({
  lastDivergence,
  lastError,
  readiness,
  readMode = DEFAULT_TITLE_READ_PATH_MODE,
  reviewerFlipError = null,
  onReviewerFlip,
}: {
  lastDivergence: TitleLedgerDivergence | null;
  lastError: string | null;
  readiness: TitleCutoverReadiness;
  readMode?: TitleReadPathMode;
  reviewerFlipError?: string | null;
  onReviewerFlip?: () => void;
}) {
  const detail = lastDivergence
    ? `Mutation ${lastDivergence.mutation} diverged at ${lastDivergence.at}.`
    : lastError
      ? `Recording error: ${lastError}`
      : null;
  const message = lastDivergence
    ? 'Title action ledger divergence detected. Live title store remains canonical; cutover candidacy is blocked until resolved.'
    : lastError
      ? 'Title action ledger recording failed. Live title store remains canonical; review the ledger before relying on cutover readiness.'
      : null;
  const readinessTone = lastDivergence || lastError
    ? 'border-red-300 bg-red-50 text-red-950'
    : readiness.ready
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
      : 'border-amber-300 bg-amber-50 text-amber-950';
  const labelTone = lastDivergence || lastError
    ? 'border-red-300 text-red-800'
    : readiness.ready
      ? 'border-emerald-300 text-emerald-800'
      : 'border-amber-300 text-amber-800';
  const stateLabel = lastDivergence
    ? 'Divergence'
    : lastError
      ? 'Recording error'
      : readiness.ready
        ? 'Ready, disabled'
        : 'Not enough parities';
  const disabledErrorName = readiness.ready
    ? CutoverDisabledError.name
    : TitleReadFlipDisabledError.name;
  const role = lastDivergence || lastError ? 'alert' : 'status';

  return (
    <div className={`border-b px-4 py-3 text-sm ${readinessTone}`} role={role}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border bg-white px-2 py-0.5 text-xs font-semibold uppercase ${labelTone}`}>
              Title read flip
            </span>
            <span className="text-xs font-semibold uppercase text-slate-700">
              {stateLabel}
            </span>
            <span className="text-xs text-slate-700">Default mode: {readMode}</span>
          </div>
          {message ? <p className="mt-1 leading-6">{message}</p> : null}
          {detail ? <p className="text-xs leading-5 text-slate-700">{detail}</p> : null}
          <p className="mt-1 leading-6">{readiness.reason}</p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-semibold text-slate-700">Passed parities</dt>
              <dd>
                {readiness.passedParities}/{readiness.threshold}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">MathInputView parity</dt>
              <dd>{readiness.mathParityClean ? 'Clean' : 'Not clean'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">.landroid round trip</dt>
              <dd>{readiness.landroidRoundTripClean ? 'Clean' : 'Not clean'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">Runtime divergence</dt>
              <dd>{readiness.runtimeDivergence ? 'Active' : 'Clear'}</dd>
            </div>
          </dl>
          {reviewerFlipError ? (
            <p className="mt-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
              {reviewerFlipError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-disabled="true"
          className="cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm"
          onClick={onReviewerFlip}
          title={`Disabled by default governance; pressing surfaces ${disabledErrorName}.`}
        >
          Flip to cutover
        </button>
      </div>
    </div>
  );
}
