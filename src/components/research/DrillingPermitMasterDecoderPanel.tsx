import type {
  DrillingPermitMasterDecodeResult,
  DrillingPermitMasterParsedFileSummary,
} from '../../research/rrc-drilling-permit-master';

interface DrillingPermitMasterDecoderPanelProps {
  decoded: DrillingPermitMasterDecodeResult | null;
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

function currentFileSummaryLabel(summary: DrillingPermitMasterParsedFileSummary) {
  if (summary.recognized) {
    return `${summary.recordCount} recognized record${summary.recordCount === 1 ? '' : 's'}`;
  }
  if (summary.ignoredRecordTypes.length > 0) {
    return `Companion segments only: ${summary.ignoredRecordTypes.join(', ')}`;
  }
  return 'Staged only';
}

export default function DrillingPermitMasterDecoderPanel({
  decoded,
  isLoading,
  errorMessage,
  selectedImportId,
}: DrillingPermitMasterDecoderPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-ledger-line bg-ledger p-4">
        <div className="text-sm font-semibold text-ink">Permit Master Decoder</div>
        <div className="text-sm text-ink-light mt-2">
          Reading the imported fixed-width permit files and building the joined preview.
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-seal/30 bg-seal/5 p-4">
        <div className="text-sm font-semibold text-seal">Permit Master Decoder</div>
        <div className="text-sm text-seal mt-2">{errorMessage}</div>
      </div>
    );
  }

  const selectedSummary =
    decoded?.parsedFiles.find((parsedFile) => parsedFile.importId === selectedImportId) ??
    null;
  const displayedWarnings = decoded?.warnings.slice(0, 6) ?? [];
  const decodedPermits = decoded?.permits ?? [];

  return (
    <div className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-ink">Permit Master Decoder</div>
          {decoded && (
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              Fixed-width decoder active
            </span>
          )}
        </div>
        <div className="text-sm text-ink">
          LANDroid now reads the core drilling-permit master fixed-width records and
          joins in surface and bottom-hole coordinates when the lat/long records are
          present.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Permit Rows
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.permitCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Surface Coords
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.surfaceLocationCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Bottom-Hole Coords
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.bottomHoleCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Recognized Files
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.recognizedFileCount ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 text-sm text-ink">
        {selectedSummary ? (
          <>
            <div className="font-semibold text-ink">
              Current file: {selectedSummary.label}
            </div>
            <div className="text-ink-light mt-1">
              {currentFileSummaryLabel(selectedSummary)}
            </div>
            {selectedSummary.warnings.length > 0 && (
              <div className="text-seal mt-2">
                File-specific warnings: {selectedSummary.warnings.length}
              </div>
            )}
          </>
        ) : (
          <div className="text-ink-light">
            Import an ASCII drilling-permit master file to unlock the fixed-width
            permit preview.
          </div>
        )}
      </div>

      {displayedWarnings.length > 0 && (
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Decoder Notes
          </div>
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
            Joined Permit Preview
          </div>
          {decodedPermits.length > 25 && (
            <div className="text-xs text-ink-light">
              Showing first 25 of {decodedPermits.length} permits
            </div>
          )}
        </div>

        {decodedPermits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ledger-line bg-parchment px-4 py-6 text-sm text-ink-light">
            No permit master rows are ready yet. Import a fixed-width permit file to
            build the structured preview.
          </div>
        ) : (
          decodedPermits.slice(0, 25).map((permit) => (
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
                    County {permit.countyCode || 'n/a'}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-ledger text-[11px] font-semibold text-ink-light border border-ledger-line">
                    Status {permit.statusCode || 'n/a'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Permit No.
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.permitNumber || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Status No.
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.statusNumber || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    App Received
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {formatCompactDate(permit.applicationReceivedDate)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Issue Date
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {formatCompactDate(permit.issueDate)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Total Depth
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.totalDepth || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Type
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.applicationTypeCode || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Nearest City
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.nearestCity || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Surface Acres
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.surfaceAcres || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Section
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.surfaceSection || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Block
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.surfaceBlock || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Survey
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.surfaceSurvey || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Abstract
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.surfaceAbstract || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">
                  Coordinates
                </div>
                {permit.coordinates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-ledger-line bg-ledger px-3 py-3 text-sm text-ink-light">
                    No coordinates were decoded for this permit yet.
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {permit.coordinates.map((coordinate) => (
                      <div
                        key={`${coordinate.locationType}-${coordinate.latitude}-${coordinate.longitude}`}
                        className="rounded-md border border-ledger-line bg-ledger px-3 py-3 text-sm text-ink"
                      >
                        <div className="font-semibold text-ink">
                          {coordinate.locationType}
                        </div>
                        <div className="text-ink-light mt-1">
                          {coordinate.latitude || '?'} , {coordinate.longitude || '?'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
