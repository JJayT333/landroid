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
import {
  isTitleCutoverArmed,
  useTitleActionLog,
  type TitleLedgerDivergence,
} from '../../store/title-action-log';
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

// The flip is a deliberate user action only (DA-C1 removed the auto-flip).
// The governance check only requires a non-empty token (see TitleReadPathFlag).
const MANUAL_FLIP_TOKEN = 'reviewer:title-cutover-confirmed';

/**
 * App-level banner: quiet when healthy. Post-flip daily reality is
 * "cutover, no divergence, no error" — that state renders nothing here (the
 * sidebar's LedgerStatusChip keeps the panel one click away, revert included).
 * Any trouble (divergence, recording error) or any pre-flip state brings the
 * full banner back across the main column. The heavy parity gates only
 * compute while the panel is actually mounted.
 */
export default function TitleLedgerStatusBanner() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const readPathMode = useTitleActionLog((state) => state.readPathMode);
  const healthy = readPathMode === 'cutover' && !lastDivergence && !lastError;
  if (healthy) return null;
  return <TitleLedgerStatusPanel />;
}

/** Floating popover host for the chip (heavy gates compute only while open). */
export function TitleLedgerStatusPanel() {
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

  return (
    <TitleLedgerStatusBannerContent
      lastDivergence={lastDivergence}
      lastError={lastError}
      readiness={readiness}
      readMode={readPathMode}
      flipError={flipError}
      armed={isTitleCutoverArmed()}
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

/**
 * Compact sidebar-footer chip: dot + read-mode label, cheap subscriptions
 * only. Click opens the full readiness panel (with the revert control) as a
 * popover anchored above the footer.
 */
export function LedgerStatusChip() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const readPathMode = useTitleActionLog((state) => state.readPathMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const trouble = Boolean(lastDivergence || lastError);
  const label = trouble
    ? lastDivergence
      ? 'Divergence'
      : 'Ledger error'
    : readPathMode === 'cutover'
      ? 'Cutover'
      : 'Shadow';
  const dotClass = trouble
    ? 'bg-seal'
    : readPathMode === 'cutover'
      ? 'bg-[#3f7d4e]'
      : 'bg-gold';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Title ledger read mode: ${readPathMode}. Click for readiness details.`}
        className="flex shrink-0 items-center gap-1.5 rounded-[7px] border border-ledger-line px-2 py-[3px] text-[10px] font-semibold text-ink-light transition-colors hover:bg-parchment-dark"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </button>
      {open && (
        <div className="absolute bottom-8 left-1/2 z-50 w-[34rem] max-w-[80vw] -translate-x-1/2 overflow-hidden rounded-[10px] border border-ledger-line bg-parchment-light shadow-[0_12px_30px_rgba(45,33,20,0.16)]">
          <TitleLedgerStatusPanel />
        </div>
      )}
    </div>
  );
}

export function TitleLedgerStatusBannerContent({
  lastDivergence,
  lastError,
  readiness,
  readMode = DEFAULT_TITLE_READ_PATH_MODE,
  flipError = null,
  armed = true,
  onFlip,
  onRevert,
}: {
  lastDivergence: TitleLedgerDivergence | null;
  lastError: string | null;
  readiness: TitleCutoverReadiness;
  readMode?: TitleReadPathMode;
  flipError?: string | null;
  /** Cutover governance armed state; while false the flip stays disabled. */
  armed?: boolean;
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

  // The record-layer read path can flip to cutover only when readiness is green
  // AND governance is armed (DA-C1: disarmed pending the Springhill soak), and
  // can always revert. The live Desk Map / math stay store-canonical regardless.
  const canFlip = !isCutover && readiness.ready && armed;
  const buttonLabel = isCutover ? 'Revert to shadow' : 'Flip to cutover';
  const buttonEnabled = isCutover || canFlip;
  const buttonTitle = isCutover
    ? 'Revert the title record read path to the store (shadow).'
    : canFlip
      ? 'Flip the title record read path to the durable ledger (cutover). Reversible.'
      : !armed && readiness.ready
        ? 'Cutover is disarmed pending the Springhill soak; re-arming is a deliberate code change (DA-C1).'
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
          {!isCutover && readiness.ready && !armed ? (
            <p className="text-xs leading-5 text-slate-700">
              Readiness is green, but the flip stays disarmed pending the Springhill
              soak. Re-arming is a deliberate code change.
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
