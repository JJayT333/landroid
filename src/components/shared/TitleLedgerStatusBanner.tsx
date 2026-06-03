import { useTitleActionLog, type TitleLedgerDivergence } from '../../store/title-action-log';

export default function TitleLedgerStatusBanner() {
  const lastDivergence = useTitleActionLog((state) => state.lastDivergence);
  const lastError = useTitleActionLog((state) => state.lastError);

  return (
    <TitleLedgerStatusBannerContent lastDivergence={lastDivergence} lastError={lastError} />
  );
}

export function TitleLedgerStatusBannerContent({
  lastDivergence,
  lastError,
}: {
  lastDivergence: TitleLedgerDivergence | null;
  lastError: string | null;
}) {

  if (!lastDivergence && !lastError) return null;

  const detail = lastDivergence
    ? `Mutation ${lastDivergence.mutation} diverged at ${lastDivergence.at}.`
    : `Recording error: ${lastError}`;
  const message = lastDivergence
    ? 'Title action ledger divergence detected. Live title store remains canonical; cutover candidacy is blocked until resolved.'
    : 'Title action ledger recording failed. Live title store remains canonical; review the ledger before relying on cutover readiness.';

  return (
    <div className="border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950" role="alert">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-800">
          Title ledger
        </span>
        <p className="leading-6">{message}</p>
        <p className="text-xs leading-5 text-red-800">{detail}</p>
      </div>
    </div>
  );
}
