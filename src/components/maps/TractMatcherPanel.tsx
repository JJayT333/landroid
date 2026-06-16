import { useMemo, useRef, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { suggestTractMatches } from '../../maps/feature-tract-matcher';

/**
 * DA2-M PR M2 — import an ArcGIS tract GeoJSON and tie each polygon to a
 * LANDroid DeskMap. Exact `Tract`↔`code` matches are suggested; the operator
 * confirms, which writes the ArcGIS `ExternalRef` onto the DeskMap.
 */
export default function TractMatcherPanel({ readOnly = false }: { readOnly?: boolean }) {
  const workspaceId = useMapStore((state) => state.workspaceId);
  const tractFeatures = useMapStore((state) => state.tractFeatures);
  const ingestGeoJsonTractFeatures = useMapStore((state) => state.ingestGeoJsonTractFeatures);
  const setFeatureTractMatch = useMapStore((state) => state.setFeatureTractMatch);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);

  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(
    () => new Map(suggestTractMatches(tractFeatures, deskMaps).map((s) => [s.featureId, s])),
    [tractFeatures, deskMaps]
  );
  const deskMapById = useMemo(
    () => new Map(deskMaps.map((dm) => [dm.id, dm])),
    [deskMaps]
  );

  const matchedCount = tractFeatures.filter((f) => f.matchedDeskMapId).length;

  async function onFile(file: File) {
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const result = await ingestGeoJsonTractFeatures({ fileName: file.name, text });
      const warn = result.warnings.length ? ` (${result.warnings.length} skipped)` : '';
      setStatus(`Imported ${result.featureCount} tract${result.featureCount === 1 ? '' : 's'}${warn}.`);
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-md border border-ledger-line bg-ledger p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Tract map (GeoJSON)</div>
          <div className="text-xs text-ink-light">
            Import an ArcGIS tract export and link each polygon to its tract.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tractFeatures.length > 0 && (
            <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5 text-[11px] font-semibold text-ink-light">
              {matchedCount}/{tractFeatures.length} matched
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              disabled={busy || !workspaceId}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-ledger-line bg-parchment px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-parchment-dark disabled:opacity-50"
            >
              {busy ? 'Importing…' : 'Import GeoJSON'}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </div>
      </div>

      {status && <div className="text-xs text-ink-light">{status}</div>}

      {tractFeatures.length === 0 ? (
        <div className="rounded-md border border-dashed border-ledger-line bg-parchment px-3 py-4 text-center text-xs text-ink-light">
          No tract geometry yet. Import a GeoJSON export to begin.
        </div>
      ) : (
        <div className="space-y-2">
          {tractFeatures.map((feature) => {
            const suggestion = suggestions.get(feature.id);
            const currentId = feature.matchedDeskMapId;
            const suggestedId = !currentId ? suggestion?.deskMapId ?? null : null;
            const selectValue = currentId ?? suggestedId ?? '';
            return (
              <div
                key={feature.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ledger-line bg-parchment px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    Tract {feature.tractKey}
                  </div>
                  <div className="text-[11px] text-ink-light">
                    {feature.acres != null ? `${feature.acres} ac` : 'acres —'}
                    {currentId
                      ? ` • linked to ${deskMapById.get(currentId)?.code ?? '—'}`
                      : suggestedId
                        ? ` • suggested: ${deskMapById.get(suggestedId)?.code ?? '—'}`
                        : ' • no match'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    disabled={readOnly}
                    value={selectValue}
                    onChange={(event) =>
                      void setFeatureTractMatch(feature.id, event.target.value || null)
                    }
                    className="rounded-md border border-ledger-line bg-ledger px-2 py-1 text-xs text-ink disabled:opacity-50"
                  >
                    <option value="">— unmatched —</option>
                    {deskMaps.map((dm) => (
                      <option key={dm.id} value={dm.id}>
                        {dm.code || dm.name || dm.id}
                      </option>
                    ))}
                  </select>
                  {!readOnly && suggestedId && (
                    <button
                      type="button"
                      onClick={() => void setFeatureTractMatch(feature.id, suggestedId)}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                    >
                      Accept
                    </button>
                  )}
                  {!readOnly && currentId && (
                    <button
                      type="button"
                      onClick={() => void setFeatureTractMatch(feature.id, null)}
                      className="rounded-md border border-ledger-line bg-ledger px-2 py-1 text-[11px] font-semibold text-ink-light transition-colors hover:bg-parchment-dark"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
