import { useEffect, useMemo, useRef, useState } from 'react';
import type { TitleCutoverReadiness } from '../../project-records/action-layer/title-cutover-gate';
import {
  computeTitleParityGates,
  deriveTitleCutoverReadiness,
  MIN_PASSED_TITLE_PARITIES,
  type TitleParityGates,
} from '../../project-records/action-layer/title-cutover-readiness';
import {
  DEFAULT_TITLE_READ_PATH_MODE,
  type TitleReadPathMode,
} from '../../project-records/action-layer/title-read-path';
import { useTitleActionLog, type TitleLedgerDivergence } from '../../store/title-action-log';
import { useOwnerStore } from '../../store/owner-store';
import { readCurrentWorkspaceData } from '../../store/workspace-store';

// The readiness helper now lives in the shared readiness module; re-export it so
// existing import paths/tests keep working.
export {
  deriveTitleCutoverReadiness,
  type TitleReadinessSnapshotInput,
} from '../../project-records/action-layer/title-cutover-readiness';

const NOT_CLEAN_GATES: TitleParityGates = {
  mathParityClean: false,
  landroidRoundTripClean: false,
};

// Auto-advance uses a system token; the manual reviewer control uses its own.
// The governance check only requires a non-empty token (see TitleReadPathFlag).
const AUTO_FLIP_TOKEN = 'auto:title-gates-green';
const MANUAL_FLIP_TOKEN = 'reviewer:title-cutover-confirmed';

export default function TitleLedgerStatusBanner() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const recordedMutationCount = useTitleActionLog((state) => state.recordedMutationCount);
  const actionRecords = useTitleActionLog((state) => state.actionRecords);
  const auditEvents = useTitleActionLog((state) => state.auditEvents);
  const readPathMode = useTitleActionLog((state) => state.readPathMode);
  const flipToCutover = useTitleActionLog((state) => state.flipToCutover);
  const revertReadPathToShadow = useTitleActionLog((state) => state.revertReadPathToShadow);

  // The two heavy gate inputs (MathInputView parity + .landroid round trip) are
  // recomputed off the live workspace + durable ledger once the ledger passes the
  // parity threshold. Below the threshold the gate is red regardless, so the work
  // is skipped and both read NOT clean.
  const [parityGates, setParityGates] = useState<TitleParityGates>(NOT_CLEAN_GATES);
  useEffect(() => {
    if (recordedMutationCount < MIN_PASSED_TITLE_PARITIES) {
      setParityGates(NOT_CLEAN_GATES);
      return;
    }
    let cancelled = false;
    const owner = useOwnerStore.getState();
    void computeTitleParityGates({
      liveWorkspace: readCurrentWorkspaceData(),
      ownerData: { owners: owner.owners, leases: owner.leases },
      actionRecords,
      auditEvents,
    }).then((gates) => {
      if (!cancelled) setParityGates(gates);
    });
    return () => {
      cancelled = true;
    };
  }, [actionRecords, auditEvents, recordedMutationCount]);

  const readiness = useMemo(
    () =>
      deriveTitleCutoverReadiness({
        recordedMutationCount,
        mathParityClean: parityGates.mathParityClean,
        landroidRoundTripClean: parityGates.landroidRoundTripClean,
        runtimeDivergenceMessage: lastDivergence
          ? `${lastDivergence.mutation}: ${lastDivergence.message}`
          : null,
        runtimeErrorMessage: lastError,
      }),
    [lastDivergence, lastError, recordedMutationCount, parityGates]
  );

  const [flipError, setFlipError] = useState<string | null>(null);

  // Default-to-cutover-when-green: on the rising edge of readiness, flip the
  // record-layer read path to cutover. Reversible; a manual revert is not
  // re-flipped until readiness drops and recovers (rising edge only), so the
  // reviewer stays in control.
  const wasReadyRef = useRef(false);
  useEffect(() => {
    if (readiness.ready && !wasReadyRef.current && readPathMode === 'shadow') {
      try {
        flipToCutover({ reviewerApprovalToken: AUTO_FLIP_TOKEN, ready: true });
        setFlipError(null);
      } catch (err) {
        setFlipError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
    }
    wasReadyRef.current = readiness.ready;
  }, [readiness.ready, readPathMode, flipToCutover]);

  return (
    <TitleLedgerStatusBannerContent
      lastDivergence={lastDivergence}
      lastError={lastError}
      readiness={readiness}
      readMode={readPathMode}
      flipError={flipError}
      onFlip={() => {
        try {
          flipToCutover({ reviewerApprovalToken: MANUAL_FLIP_TOKEN, ready: readiness.ready });
          setFlipError(null);
        } catch (err) {
          setFlipError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        }
      }}
      onRevert={() => {
        revertReadPathToShadow();
        setFlipError(null);
      }}
    />
  );
}

export function TitleLedgerStatusBannerContent({
  lastDivergence,
  lastError,
  readiness,
  readMode = DEFAULT_TITLE_READ_PATH_MODE,
  flipError = null,
  onFlip,
  onRevert,
}: {
  lastDivergence: TitleLedgerDivergence | null;
  lastError: string | null;
  readiness: TitleCutoverReadiness;
  readMode?: TitleReadPathMode;
  flipError?: string | null;
  onFlip?: () => void;
  onRevert?: () => void;
}) {
  const isCutover = readMode === 'cutover';
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
    : isCutover
      ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
      : readiness.ready
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
        : 'border-amber-300 bg-amber-50 text-amber-950';
  const labelTone = lastDivergence || lastError
    ? 'border-red-300 text-red-800'
    : isCutover || readiness.ready
      ? 'border-emerald-300 text-emerald-800'
      : 'border-amber-300 text-amber-800';
  const stateLabel = lastDivergence
    ? 'Divergence'
    : lastError
      ? 'Recording error'
      : isCutover
        ? 'Cutover (record layer)'
        : readiness.ready
          ? 'Ready'
          : 'Not enough parities';
  const role = lastDivergence || lastError ? 'alert' : 'status';

  // The record-layer read path can flip to cutover only when readiness is green,
  // and can always revert. The live Desk Map / math stay store-canonical
  // regardless (the live read-source move is a separate, later cutover).
  const canFlip = !isCutover && readiness.ready;
  const buttonLabel = isCutover ? 'Revert to shadow' : 'Flip to cutover';
  const buttonEnabled = isCutover || canFlip;
  const buttonTitle = isCutover
    ? 'Revert the title record read path to the store (shadow).'
    : canFlip
      ? 'Flip the title record read path to the durable ledger (cutover). Reversible.'
      : 'Disabled until the readiness gates are green.';

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
            <span className="text-xs text-slate-700">Read mode: {readMode}</span>
          </div>
          {message ? <p className="mt-1 leading-6">{message}</p> : null}
          {detail ? <p className="text-xs leading-5 text-slate-700">{detail}</p> : null}
          <p className="mt-1 leading-6">{readiness.reason}</p>
          {isCutover ? (
            <p className="text-xs leading-5 text-slate-700">
              Title records read from the durable ledger. The live Desk Map and math
              remain store-canonical.
            </p>
          ) : null}
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
          {flipError ? (
            <p className="mt-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800">
              {flipError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!buttonEnabled}
          aria-disabled={!buttonEnabled}
          className={
            buttonEnabled
              ? 'rounded border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500'
              : 'cursor-not-allowed rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm'
          }
          onClick={isCutover ? onRevert : onFlip}
          title={buttonTitle}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
