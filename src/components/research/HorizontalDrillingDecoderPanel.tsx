import type { HorizontalDrillingDecodeResult } from '../../research/rrc-horizontal-drilling';

interface HorizontalDrillingDecoderPanelProps {
  decoded: HorizontalDrillingDecodeResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  selectedImportId: string | null;
}

function formatCompactDate(value: string) {
  if (!/^\d{8}$/.test(value)) return value || 'Not provided';
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${month}/${day}/${year}`;
}

export default function HorizontalDrillingDecoderPanel({
  decoded,
  isLoading,
  errorMessage,
  selectedImportId,
}: HorizontalDrillingDecoderPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-ledger-line bg-ledger p-4">
        <div className="text-sm font-semibold text-ink">Horizontal Permit Decoder</div>
        <div className="text-sm text-ink-light mt-2">
          Reading the imported horizontal permit file and building the fixed-width preview.
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-seal/30 bg-seal/5 p-4">
        <div className="text-sm font-semibold text-seal">Horizontal Permit Decoder</div>
        <div className="text-sm text-seal mt-2">{errorMessage}</div>
      </div>
    );
  }

  const selectedSummary =
    decoded?.parsedFiles.find((parsedFile) => parsedFile.importId === selectedImportId) ??
    null;
  const displayedWarnings = decoded?.warnings.slice(0, 6) ?? [];
  const permits = decoded?.permits ?? [];

  return (
    <div className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-ink">Horizontal Permit Decoder</div>
          {decoded && (
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              Fixed-width decoder active
            </span>
          )}
        </div>
        <div className="text-sm text-ink">
          LANDroid now reads the single-row horizontal drilling permit ASCII layout into
          a permit-by-permit preview that is much easier to review than raw fixed-width text.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">Permit Rows</div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.permitCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">Gas</div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.gasCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">Oil</div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.oilCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">Off Schedule</div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.offScheduleCount ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 text-sm text-ink">
        {selectedSummary ? (
          <>
            <div className="font-semibold text-ink">Current file: {selectedSummary.label}</div>
            <div className="text-ink-light mt-1">
              {selectedSummary.recognized
                ? `LANDroid decoded ${selectedSummary.recordCount} horizontal permit row${selectedSummary.recordCount === 1 ? '' : 's'} from this file.`
                : 'This file is staged only right now.'}
            </div>
          </>
        ) : (
          <div className="text-ink-light">
            Import a horizontal drilling permits ASCII file to build the fixed-width preview.
          </div>
        )}
      </div>

      {displayedWarnings.length > 0 && (
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">Decoder Notes</div>
          <div className="space-y-2 mt-2">
            {displayedWarnings.map((warning) => (
              <div
                key={warning}
                className="rounded-md border border-ledger-line bg-ledger px-3 py-2 text-xs text-ink"
              >
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Horizontal Permit Preview
          </div>
          {permits.length > 25 && (
            <div className="text-xs text-ink-light">Showing first 25 of {permits.length} permits</div>
          )}
        </div>

        {permits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ledger-line bg-parchment px-4 py-6 text-sm text-ink-light">
            No horizontal permit rows are ready yet.
          </div>
        ) : (
          permits.slice(0, 25).map((permit) => (
            <div
              key={permit.permitKey}
              className="rounded-xl border border-ledger-line bg-parchment px-4 py-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-display font-bold text-ink">
                    {permit.leaseName || 'Unnamed lease'}{' '}
                    {permit.wellNumber ? `• Well ${permit.wellNumber}` : ''}
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.operatorName || 'Unknown operator'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-full bg-ledger text-[11px] font-semibold text-ink-light border border-ledger-line">
                    District {permit.districtNo || 'n/a'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-ledger text-[11px] font-semibold text-ink-light border border-ledger-line">
                    {permit.oilOrGas === 'G' ? 'Gas' : permit.oilOrGas === 'O' ? 'Oil' : 'Unknown'}
                  </span>
                  {permit.offSchedule && (
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                      Off schedule
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Permit</div>
                  <div className="text-sm text-ink mt-1">
                    {permit.permitNumber || 'Not provided'}-{permit.permitSequence || '00'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">API</div>
                  <div className="text-sm text-ink mt-1">{permit.apiNumber || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Issued</div>
                  <div className="text-sm text-ink mt-1">{formatCompactDate(permit.issuedDate)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Total Depth</div>
                  <div className="text-sm text-ink mt-1">{permit.totalDepth || 'Not provided'}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">County</div>
                  <div className="text-sm text-ink mt-1">{permit.countyName || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Field</div>
                  <div className="text-sm text-ink mt-1">{permit.fieldName || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Validated Field</div>
                  <div className="text-sm text-ink mt-1">{permit.validatedFieldName || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Validated Date</div>
                  <div className="text-sm text-ink mt-1">{formatCompactDate(permit.validatedWellDate)}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Section</div>
                  <div className="text-sm text-ink mt-1">{permit.section || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Block</div>
                  <div className="text-sm text-ink mt-1">{permit.block || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Survey</div>
                  <div className="text-sm text-ink mt-1">{permit.survey || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Abstract</div>
                  <div className="text-sm text-ink mt-1">{permit.abstract || 'Not provided'}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
