import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useOwnerStore } from '../../store/owner-store';
import { useUIStore } from '../../store/ui-store';
import {
  computeTractProjection,
  featureToSvgPath,
} from '../../maps/geojson-ingest';
import { buildTractExportRows, type TractExportRow } from '../../maps/tract-export';
import type { MapTractFeature } from '../../types/map-tract-feature';

/**
 * DA2-M PR M5 — the "3D almost" tract chooser. A grid of cards, each a mini map
 * of one tract that flips (CSS perspective + rotateY, SVG-only — no Three.js) to
 * reveal that tract's LANDroid numbers. Click a matched card to open its tract
 * in the Desk Map.
 */
function MiniTract({ feature }: { feature: MapTractFeature }) {
  const { d, width, height } = useMemo(() => {
    const proj = computeTractProjection(feature.bbox, { size: 200, padding: 10 });
    return { d: featureToSvgPath(feature.polygons, proj), width: proj.width, height: proj.height };
  }, [feature]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" aria-hidden="true">
      <path
        d={d}
        fillRule="evenodd"
        fill="rgba(63,125,78,0.25)"
        stroke="#6b5535"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function TractChooser() {
  const tractFeatures = useMapStore((state) => state.tractFeatures);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const leaseholdAssignments = useWorkspaceStore((state) => state.leaseholdAssignments);
  const leaseholdOrris = useWorkspaceStore((state) => state.leaseholdOrris);
  const setActiveDeskMap = useWorkspaceStore((state) => state.setActiveDeskMap);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const setView = useUIStore((state) => state.setView);

  const [flippedId, setFlippedId] = useState<string | null>(null);

  const rowByFeatureId = useMemo(() => {
    const rows = buildTractExportRows({
      tractFeatures,
      deskMaps,
      nodes,
      owners,
      leases,
      leaseholdAssignments,
      leaseholdOrris,
    });
    return new Map<string, TractExportRow>(rows.map((row) => [row.featureId, row]));
  }, [tractFeatures, deskMaps, nodes, owners, leases, leaseholdAssignments, leaseholdOrris]);

  const deskMapById = useMemo(() => new Map(deskMaps.map((dm) => [dm.id, dm])), [deskMaps]);

  if (tractFeatures.length === 0) return null;

  function openTract(deskMapId: string) {
    setActiveDeskMap(deskMapId);
    setView('chart');
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tractFeatures.map((feature) => {
        const flipped = flippedId === feature.id;
        const row = rowByFeatureId.get(feature.id);
        const deskMap = feature.matchedDeskMapId ? deskMapById.get(feature.matchedDeskMapId) : null;
        return (
          <div
            key={feature.id}
            style={{ perspective: '900px' }}
            className="h-44"
            onMouseEnter={() => setFlippedId(feature.id)}
            onMouseLeave={() => setFlippedId((id) => (id === feature.id ? null : id))}
            onClick={() => deskMap && openTract(deskMap.id)}
            role={deskMap ? 'button' : undefined}
            title={deskMap ? `Open ${deskMap.code} in Desk Map` : undefined}
          >
            <div
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.5s',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                position: 'relative',
                height: '100%',
                width: '100%',
                cursor: deskMap ? 'pointer' : 'default',
              }}
            >
              {/* Front: mini map */}
              <div
                style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                className="flex flex-col rounded-md border border-ledger-line bg-parchment p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink truncate">
                    {feature.tractKey}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${feature.matchedDeskMapId ? 'bg-[#3f7d4e]' : 'bg-[#b4822d]'}`}
                  />
                </div>
                <div className="flex-1">
                  <MiniTract feature={feature} />
                </div>
                <div className="text-[11px] text-ink-light">
                  {feature.acres != null ? `${feature.acres} ac` : 'acres —'}
                </div>
              </div>
              {/* Back: the numbers */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  position: 'absolute',
                  inset: 0,
                }}
                className="flex flex-col gap-1 rounded-md border border-ledger-line bg-ledger p-2 text-[11px] text-ink"
              >
                <div className="text-sm font-semibold">Tract {feature.tractKey}</div>
                {deskMap ? (
                  <>
                    <div className="text-ink-light">→ {deskMap.code || deskMap.name}</div>
                    <Stat label="Retained WI" value={row?.retainedWorkingInterestDecimal} />
                    <Stat label="ORRI burden" value={row?.totalOrriBurdenRate} />
                    <Stat label="Coverage" value={row?.coverageFound} />
                    <div className="mt-auto text-[10px] font-semibold text-leather">
                      Click to open in Desk Map →
                    </div>
                  </>
                ) : (
                  <div className="text-ink-light">
                    Unmatched — link this tract in the list above to see its math.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-light">{label}</span>
      <span className="font-mono">{formatRate(value)}</span>
    </div>
  );
}

/** Trim a stored decimal string to a compact display (no ad-hoc rounding). */
function formatRate(value?: string): string {
  if (!value) return '—';
  // keep at most 6 significant fractional digits for the compact card
  const match = value.match(/^(-?\d+)(?:\.(\d+))?$/);
  if (!match) return value;
  const frac = (match[2] ?? '').slice(0, 6).replace(/0+$/, '');
  return frac ? `${match[1]}.${frac}` : match[1];
}
