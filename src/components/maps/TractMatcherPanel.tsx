import { useMemo, useRef, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useOwnerStore } from '../../store/owner-store';
import { useConfirmation } from '../shared/ConfirmationProvider';
import { suggestTractMatches } from '../../maps/feature-tract-matcher';
import { parseTractFeatures } from '../../maps/geojson-ingest';
import { detectTractReimport } from '../../maps/tract-reimport';
import { featureAcres } from '../../maps/tract-area';
import { formatAcres } from '../../engine/display-format';
import {
  downloadTractCsv,
  downloadTractGeoJson,
  type TractExportInput,
} from '../../maps/tract-export';

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
  const removeTractFeature = useMapStore((state) => state.removeTractFeature);
  const removeAsset = useMapStore((state) => state.removeAsset);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const projectName = useWorkspaceStore((state) => state.projectName);
  const leaseholdAssignments = useWorkspaceStore((state) => state.leaseholdAssignments);
  const leaseholdOrris = useWorkspaceStore((state) => state.leaseholdOrris);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);

  const { confirm: requestConfirmation } = useConfirmation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Warn-and-choose on a likely re-import: if the file repeats most of an
  // earlier import's tracts, offer to replace that copy rather than silently
  // stacking a second one. Returns ' (replaced an earlier import)' for the
  // status line, or '' if nothing was replaced.
  async function resolveReimport(text: string): Promise<string> {
    const reimport = detectTractReimport(
      parseTractFeatures(text).features.map((feature) => feature.tractKey),
      tractFeatures
    );
    if (!reimport) return '';
    const replace = await requestConfirmation({
      title: 'Re-import detected',
      message:
        `${reimport.matched} of these tracts are already loaded from an earlier import. `
        + 'Replace that earlier copy, or keep both layers?',
      confirmLabel: 'Replace earlier',
      cancelLabel: 'Keep both',
    });
    if (!replace) return '';
    await removeAsset(reimport.assetId);
    return ' (replaced an earlier import)';
  }

  const suggestions = useMemo(
    () => new Map(suggestTractMatches(tractFeatures, deskMaps).map((s) => [s.featureId, s])),
    [tractFeatures, deskMaps]
  );

  const matchedCount = tractFeatures.filter((f) => f.matchedDeskMapId).length;

  const exportInput: TractExportInput = {
    tractFeatures,
    deskMaps,
    nodes,
    owners,
    leases,
    leaseholdAssignments,
    leaseholdOrris,
  };

  async function onFile(file: File) {
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const replaced = await resolveReimport(text);
      const result = await ingestGeoJsonTractFeatures({ fileName: file.name, text });
      const warn = result.warnings.length ? ` (${result.warnings.length} skipped)` : '';
      setStatus(
        `Imported ${result.featureCount} tract${result.featureCount === 1 ? '' : 's'}${warn}${replaced}.`
      );
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // Demo convenience: ingest the bundled sample tract export and auto-confirm
  // every suggested match in one click, so the plat is populated on the spot.
  async function onLoadSample() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch('/samples/dr-elmore-tracts.geojson');
      if (!response.ok) throw new Error('sample tract file not found');
      const text = await response.text();
      await resolveReimport(text);
      const result = await ingestGeoJsonTractFeatures({
        fileName: 'dr-elmore-tracts.geojson',
        text,
      });
      const fresh = useMapStore.getState().tractFeatures;
      let accepted = 0;
      for (const suggestion of suggestTractMatches(fresh, deskMaps)) {
        if (suggestion.deskMapId) {
          await setFeatureTractMatch(suggestion.featureId, suggestion.deskMapId);
          accepted += 1;
        }
      }
      setStatus(
        `Loaded ${result.featureCount} sample tract${result.featureCount === 1 ? '' : 's'}`
          + ` (${accepted} matched).`
      );
    } catch (err) {
      setStatus(`Load failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
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
          {matchedCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => downloadTractCsv(exportInput, projectName)}
                title="Export matched tracts to CSV keyed LAND_TRACT_ID"
                className="rounded-md border border-ledger-line bg-parchment px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-parchment-dark"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => downloadTractGeoJson(exportInput, projectName)}
                title="Export matched tracts to GeoJSON with LANDroid attributes"
                className="rounded-md border border-ledger-line bg-parchment px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-parchment-dark"
              >
                Export GeoJSON
              </button>
            </>
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
        <div className="rounded-md border border-dashed border-ledger-line bg-parchment px-3 py-5 text-center text-xs text-ink-light space-y-2">
          <div>No tract geometry yet. Import a GeoJSON export to begin.</div>
          {!readOnly && (
            <button
              type="button"
              disabled={busy || !workspaceId}
              onClick={() => void onLoadSample()}
              className="rounded-md border border-leather/30 bg-parchment px-3 py-1.5 text-xs font-semibold text-leather transition-colors hover:bg-leather/10 disabled:opacity-50"
            >
              {busy ? 'Loading…' : 'Load sample tracts'}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-ledger-line">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-ledger-line bg-parchment-dark/40 text-left text-[10px] uppercase tracking-wide text-ink-light">
                <th className="px-3 py-1.5 font-semibold">Tract</th>
                <th className="px-3 py-1.5 font-semibold">Acres</th>
                <th className="px-3 py-1.5 font-semibold">Linked tract</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger-line">
              {tractFeatures.map((feature) => {
                const suggestion = suggestions.get(feature.id);
                const currentId = feature.matchedDeskMapId;
                const suggestedId = !currentId ? suggestion?.deskMapId ?? null : null;
                const selectValue = currentId ?? suggestedId ?? '';
                return (
                  <tr key={feature.id} className="bg-parchment hover:bg-parchment-dark/30">
                    <td className="px-3 py-1.5 font-mono font-semibold text-ink whitespace-nowrap">
                      <span
                        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${currentId ? 'bg-[#3f7d4e]' : 'bg-[#b4822d]'}`}
                      />
                      {feature.tractKey}
                    </td>
                    <td className="px-3 py-1.5 text-ink-light whitespace-nowrap">
                      {(() => {
                        // Fall back to geodesic area when the export left Acres
                        // blank, marking the derived figure with "~".
                        if (feature.acres != null) return `${feature.acres} ac`;
                        const derived = featureAcres(feature);
                        return derived != null ? `~${formatAcres(derived)} ac` : '—';
                      })()}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          disabled={readOnly}
                          value={selectValue}
                          onChange={(event) =>
                            void setFeatureTractMatch(feature.id, event.target.value || null)
                          }
                          className={`rounded border border-ledger-line bg-ledger px-1.5 py-0.5 text-xs disabled:opacity-50 ${currentId ? 'text-ink' : 'text-ink-light'}`}
                        >
                          <option value="">— unmatched —</option>
                          {deskMaps.map((dm) => (
                            <option key={dm.id} value={dm.id}>
                              {dm.code || dm.name || dm.id}
                            </option>
                          ))}
                        </select>
                        {!readOnly && suggestedId && (
                          <>
                            {suggestion?.confidence === 'acreage' && (
                              <span
                                title="Suggested by matching acreage — the Tract key did not match a DeskMap code. Confirm before relying on it."
                                className="rounded-full border border-[#b4822d]/40 bg-[#b4822d]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#8a6320]"
                              >
                                ≈ acreage
                              </span>
                            )}
                            <button
                              type="button"
                              title="Accept the suggested match"
                              onClick={() => void setFeatureTractMatch(feature.id, suggestedId)}
                              className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                            >
                              Accept
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {!readOnly && (
                        <button
                          type="button"
                          title="Remove this tract"
                          aria-label={`Remove tract ${feature.tractKey}`}
                          onClick={() => void removeTractFeature(feature.id)}
                          className="rounded px-1.5 py-0.5 text-sm leading-none text-ink-light transition-colors hover:bg-seal/10 hover:text-seal"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
