import {
  PENDING_DRILLING_FILE_SPECS,
  type PendingDrillingDecodeResult,
} from '../../research/rrc-pending-drilling';

interface PendingDrillingDecoderPanelProps {
  decoded: PendingDrillingDecodeResult | null;
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

function formatCoordinatePair(latitude: string, longitude: string) {
  if (!latitude && !longitude) return 'No coordinates yet';
  return `${latitude || '?'} , ${longitude || '?'}`;
}

export default function PendingDrillingDecoderPanel({
  decoded,
  isLoading,
  errorMessage,
  selectedImportId,
}: PendingDrillingDecoderPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-ledger-line bg-ledger p-4">
        <div className="text-sm font-semibold text-ink">Pending Permit Decoder</div>
        <div className="text-sm text-ink-light mt-2">
          Reading the imported pending-permit files and building the joined preview.
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-seal/30 bg-seal/5 p-4">
        <div className="text-sm font-semibold text-seal">Pending Permit Decoder</div>
        <div className="text-sm text-seal mt-2">{errorMessage}</div>
      </div>
    );
  }

  const selectedSummary =
    decoded?.parsedFiles.find((parsedFile) => parsedFile.importId === selectedImportId) ??
    null;
  const recognizedFiles =
    decoded?.parsedFiles.filter((parsedFile) => parsedFile.fileKind !== null) ?? [];
  const decodedWarnings = decoded?.warnings ?? [];
  const decodedPermits = decoded?.permits ?? [];
  const displayedWarnings = decoded?.warnings.slice(0, 6) ?? [];
  const coreLabels = [
    PENDING_DRILLING_FILE_SPECS.drillingPermit.label,
    PENDING_DRILLING_FILE_SPECS.wellbore.label,
    PENDING_DRILLING_FILE_SPECS.latlong.label,
  ];

  return (
    <div className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-ink">Pending Permit Decoder</div>
          {decoded && (
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              Core decoder active
            </span>
          )}
        </div>
        <div className="text-sm text-ink">
          This dataset family is documented by the RRC as ASCII text with
          {' `'}
          {'}'}
          {' `'} delimiters. LANDroid now joins the core permit, wellbore, and
          lat/long files into one readable preview.
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
            Wellbore Rows
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.wellboreCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Coordinate Rows
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {decoded?.totals.coordinateCount ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-light">
            Recognized Files
          </div>
          <div className="text-2xl font-display font-bold text-ink mt-2">
            {recognizedFiles.length}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 text-sm text-ink">
        {selectedSummary ? (
          selectedSummary.fileKind ? (
            <>
              <div className="font-semibold text-ink">
                Current file: {selectedSummary.label}
              </div>
              <div className="text-ink-light mt-1">
                LANDroid recognized this import and decoded {selectedSummary.recordCount}{' '}
                record{selectedSummary.recordCount === 1 ? '' : 's'} from it.
              </div>
              {selectedSummary.warnings.length > 0 && (
                <div className="text-seal mt-2">
                  File-specific warnings: {selectedSummary.warnings.length}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-semibold text-ink">Current file is staged only</div>
              <div className="text-ink-light mt-1">
                The current decoder focuses on {coreLabels.join(', ')}. This file is still
                valuable to store and preview, but it does not participate in the joined
                permit summary yet.
              </div>
            </>
          )
        ) : (
          <div className="text-ink-light">
            Import the core pending-permit TXT files to build a joined permit preview.
          </div>
        )}
      </div>

      {decoded && decoded.missingCoreFiles.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <div className="font-semibold">Preview can get richer with more files</div>
          <div className="mt-1">
            Still missing:{' '}
            {decoded.missingCoreFiles
              .map((fileKind) => PENDING_DRILLING_FILE_SPECS[fileKind].label)
              .join(', ')}
          </div>
        </div>
      )}

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
            {decodedWarnings.length > displayedWarnings.length && (
              <div className="text-xs text-ink-light">
                Showing {displayedWarnings.length} of {decodedWarnings.length} decoder
                notes.
              </div>
            )}
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
            No joined permit rows are ready yet. Import at least the permit file, and
            ideally the wellbore and lat/long files too.
          </div>
        ) : (
          decodedPermits.slice(0, 25).map((permit) => (
            <div
              key={permit.universalDocNo || `${permit.statusNumber}-${permit.leaseName}`}
              className="rounded-xl border border-ledger-line bg-parchment px-4 py-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-display font-bold text-ink">
                    {permit.leaseName || 'Unnamed lease'}{' '}
                    {permit.wellNo ? `• Well ${permit.wellNo}` : ''}
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
                  <span className="px-2 py-1 rounded-full bg-ledger text-[11px] font-semibold text-ink-light border border-ledger-line">
                    Submitted {formatCompactDate(permit.submitDate)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Universal Doc
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.universalDocNo || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Status Number
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.statusNumber || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Permit Type
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.permitTypeCode || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">
                    Total Depth
                  </div>
                  <div className="text-sm text-ink mt-1">
                    {permit.totalDepth || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">
                  Wellbore + Coordinate Join
                </div>
                {permit.wellbores.length === 0 ? (
                  <div className="text-sm text-ink-light">
                    No wellbore rows matched this permit yet.
                  </div>
                ) : (
                  permit.wellbores.map((wellbore) => (
                    <div
                      key={`${wellbore.universalDocNo}-${wellbore.wellboreId}-${wellbore.apiSequenceNumber}`}
                      className="rounded-lg border border-ledger-line bg-parchment px-3 py-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-sm font-semibold text-ink">
                            API {wellbore.apiSequenceNumber || 'Not assigned'}
                          </div>
                          <div className="text-xs text-ink-light mt-1">
                            Wellbore {wellbore.wellboreId || 'n/a'} • County{' '}
                            {wellbore.countyCode || 'n/a'}
                          </div>
                        </div>
                        <div className="text-xs text-ink-light">
                          {wellbore.nearestTown
                            ? `${wellbore.nearestTown} (${wellbore.nearestTownDistance || '?'})`
                            : 'Nearest town not provided'}
                        </div>
                      </div>

                      {wellbore.coordinates.length === 0 ? (
                        <div className="text-xs text-ink-light">
                          No lat/long rows matched this wellbore yet.
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {wellbore.coordinates.map((coordinate) => (
                            <div
                              key={`${wellbore.apiSequenceNumber}-${coordinate.locationType}-${coordinate.latitude}-${coordinate.longitude}`}
                              className="rounded-md border border-ledger-line bg-ledger px-3 py-2"
                            >
                              <div className="text-[10px] uppercase tracking-wider text-ink-light">
                                {coordinate.locationType}
                              </div>
                              <div className="text-sm text-ink mt-1">
                                {formatCoordinatePair(
                                  coordinate.latitude,
                                  coordinate.longitude
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
