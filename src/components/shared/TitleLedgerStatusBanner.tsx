import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
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
  type TitleLedgerQuarantineNotice,
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
 * Operator banner preference (the "see the full screen" toggle): manually
 * hidden via the banner's Hide button or the sidebar chip's toggle, persisted
 * per browser. Safety override below: a divergence or recording error always
 * shows the banner regardless of this preference.
 */
const LEDGER_BANNER_HIDDEN_KEY = 'landroid.shell.ledgerBannerHidden';

const useLedgerBannerPref = create<{ hidden: boolean }>()(() => ({
  hidden:
    typeof window !== 'undefined'
    && window.localStorage.getItem(LEDGER_BANNER_HIDDEN_KEY) === '1',
}));

export function setLedgerBannerHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(LEDGER_BANNER_HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    // Preference persistence is best-effort.
  }
  useLedgerBannerPref.setState({ hidden });
}

/**
 * App-level banner: quiet when healthy. Post-flip daily reality is
 * "cutover, no divergence, no error" — that state renders nothing here (the
 * sidebar's LedgerStatusChip keeps the panel one click away, revert included).
 * The operator can also hide it manually to reclaim the screen; any trouble
 * (divergence, recording error) overrides the preference and brings the full
 * banner back. The heavy parity gates only compute while the panel is
 * actually mounted.
 */
export default function TitleLedgerStatusBanner() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const lastQuarantine = useTitleActionLog((state) => state.lastQuarantine);
  const readPathMode = useTitleActionLog((state) => state.readPathMode);
  const manuallyHidden = useLedgerBannerPref((state) => state.hidden);
  const trouble = Boolean(lastDivergence || lastError || lastQuarantine);
  const healthy = readPathMode === 'cutover' && !trouble;
  if (healthy || (manuallyHidden && !trouble)) return null;
  return <TitleLedgerStatusPanel onHide={() => setLedgerBannerHidden(true)} />;
}

/** Floating popover host for the chip (heavy gates compute only while open). */
export function TitleLedgerStatusPanel({ onHide }: { onHide?: () => void } = {}) {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);
  const lastQuarantine = useTitleActionLog((state) => state.lastQuarantine);
  // Cutover readiness counts only parities recorded THIS session; a hydrated
  // ledger's historical count must not auto-satisfy the threshold (DA-U2).
  const sessionParityCount = useTitleActionLog((state) => state.sessionParityCount);
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
    if (sessionParityCount < MIN_PASSED_TITLE_PARITIES) {
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
  }, [actionRecords, auditEvents, sessionParityCount]);

  const readiness = useMemo(
    () =>
      deriveTitleCutoverReadiness({
        recordedMutationCount: sessionParityCount,
        mathParityClean: parityGates.mathParityClean,
        landroidRoundTripClean: parityGates.landroidRoundTripClean,
        runtimeDivergenceMessage: lastDivergence
          ? `${lastDivergence.mutation}: ${lastDivergence.message}`
          : null,
        runtimeErrorMessage: lastError,
      }),
    [lastDivergence, lastError, sessionParityCount, parityGates]
  );

  const [flipError, setFlipError] = useState<string | null>(null);

  return (
    <>
      <QuarantineNotice notice={lastQuarantine} />
      <TitleLedgerStatusBannerContent
        lastDivergence={lastDivergence}
        lastError={lastError}
        readiness={readiness}
        readMode={readPathMode}
        flipError={flipError}
        onHide={onHide}
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
    </>
  );
}

/**
 * DA-H4: a self-contained notice that an invalid ledger chain was preserved
 * (quarantined), not erased. Kept separate from the readiness panel's tone logic
 * so it never perturbs the divergence/error styling.
 */
function QuarantineNotice({ notice }: { notice: TitleLedgerQuarantineNotice | null }) {
  if (!notice) return null;
  const sourceLabel = notice.source === 'file' ? 'imported file' : 'stored';
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <p className="text-[12px] font-semibold">
        Title ledger quarantined (preserved, not erased)
      </p>
      <p className="mt-1 text-[11px] leading-snug">
        A {sourceLabel} title audit chain failed verification on load and was set
        aside intact ({notice.actionRecordCount} action record
        {notice.actionRecordCount === 1 ? '' : 's'},{' '}
        {notice.auditEventCount} audit event
        {notice.auditEventCount === 1 ? '' : 's'}). The workspace re-baselined a
        fresh chain; the rejected one is retained for review rather than
        discarded. {notice.reason}.
      </p>
    </div>
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
  const lastQuarantine = useTitleActionLog((state) => state.lastQuarantine);
  const readPathMode = useTitleActionLog((state) => state.readPathMode);
  const bannerHidden = useLedgerBannerPref((state) => state.hidden);
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

  const trouble = Boolean(lastDivergence || lastError || lastQuarantine);
  const label = trouble
    ? lastDivergence
      ? 'Divergence'
      : lastError
        ? 'Ledger error'
        : 'Quarantined'
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
          <div className="flex items-center justify-between border-t border-ledger-line px-4 py-2">
            <span className="text-[10px] text-ink-light">
              Banner on screen{readPathMode !== 'cutover' ? '' : ' (auto-hidden while healthy in cutover)'}
            </span>
            <button
              type="button"
              onClick={() => setLedgerBannerHidden(!bannerHidden)}
              className="rounded-[7px] border border-ledger-line px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-parchment-dark"
            >
              {bannerHidden ? 'Show banner' : 'Hide banner'}
            </button>
          </div>
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
  onHide,
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
  /** Manual banner hide (operator screen-space toggle); divergence overrides. */
  onHide?: () => void;
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="rounded px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900"
              title="Hide this banner (the sidebar's ledger chip brings it back; a divergence always shows it)"
            >
              Hide banner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
