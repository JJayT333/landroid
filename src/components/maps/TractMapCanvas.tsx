import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  computeTractProjection,
  featureToSvgPath,
  projectLonLat,
  type GeoBBox,
} from '../../maps/geojson-ingest';
import { featureAcres } from '../../maps/tract-area';
import { formatAcres } from '../../engine/display-format';
import type { GeoRing, MapTractFeature } from '../../types/map-tract-feature';

/**
 * DA2-M — render ingested tract polygons as a land-plat exhibit: flat parchment
 * paper inside a survey frame, thin ink tract boundaries, a restrained warm wash
 * on the matched (unit) tracts so they read against the white neighbors, and
 * small seal-red survey tract numbers. Click a polygon to select its tract.
 */

// Survey-plat ink + accents, drawn from the app theme tokens.
const INK = '#3a2e1c';
const INK_SELECTED = '#241a0e';
const PAPER = '#fffcf6'; // --color-parchment-light
const FRAME = '#cdbf9f';
const UNIT_WASH = '#8a4b2d'; // --color-leather, used at low opacity
const LABEL_RED = '#a4342c'; // --color-seal — the survey tract-number red
const LABEL_HALO = '#fffcf6';

function mergeBBoxes(features: readonly MapTractFeature[]): GeoBBox | null {
  let bbox: GeoBBox | null = null;
  for (const feature of features) {
    bbox = bbox
      ? [
          Math.min(bbox[0], feature.bbox[0]),
          Math.min(bbox[1], feature.bbox[1]),
          Math.max(bbox[2], feature.bbox[2]),
          Math.max(bbox[3], feature.bbox[3]),
        ]
      : [...feature.bbox];
  }
  return bbox;
}

/** Simple vertex-average centroid of the outer ring (good enough for a label). */
function ringCentroid(ring: GeoRing): [number, number] {
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return [lon / ring.length, lat / ring.length];
}

export default function TractMapCanvas() {
  const tractFeatures = useMapStore((state) => state.tractFeatures);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const render = useMemo(() => {
    const bbox = mergeBBoxes(tractFeatures);
    if (!bbox) return null;
    const proj = computeTractProjection(bbox, { size: 900, padding: 36 });
    const shapes = tractFeatures.map((feature) => {
      const acres = featureAcres(feature);
      return {
        id: feature.id,
        tractKey: feature.tractKey,
        matched: Boolean(feature.matchedDeskMapId),
        acresLabel: acres != null ? formatAcres(acres) : null,
        d: featureToSvgPath(feature.polygons, proj),
        label: projectLonLat(ringCentroid(feature.polygons[0]?.outer ?? [[0, 0]]), proj),
      };
    });
    return { proj, shapes };
  }, [tractFeatures]);

  if (!render) return null;

  const deskMapById = new Map(deskMaps.map((dm) => [dm.id, dm]));
  const selected = tractFeatures.find((feature) => feature.id === selectedId) ?? null;
  const { width, height } = render.proj;

  // Restrained warm wash on the matched (unit) tracts so they read against the
  // white neighbor tracts — selection/hover deepen it; neighbors stay paper.
  function fillOpacityFor(id: string, matched: boolean): number {
    if (id === selectedId) return 0.26;
    if (id === hoveredId) return matched ? 0.2 : 0.08;
    return matched ? 0.13 : 0;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3 text-[11px] text-ink-light">
        <span>click a tract to select it</span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[1px] border border-[#3a2e1c]"
            style={{ backgroundColor: UNIT_WASH, opacity: 0.13 }}
          />
          unit tract
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[1px] border border-[#3a2e1c] bg-[#fffcf6]" />
          neighbor
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-ledger-line">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: '62vh', display: 'block', backgroundColor: PAPER }}
          role="group"
          aria-label="Tract plat"
        >
          {/* Survey frame: a double rule just inside the paper edge. */}
          <rect
            x={8}
            y={8}
            width={width - 16}
            height={height - 16}
            fill="none"
            stroke={FRAME}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={12}
            y={12}
            width={width - 24}
            height={height - 24}
            fill="none"
            stroke={FRAME}
            strokeWidth={0.75}
            vectorEffect="non-scaling-stroke"
          />

          {render.shapes.map((shape) => (
            <path
              key={shape.id}
              d={shape.d}
              fillRule="evenodd"
              fill={UNIT_WASH}
              fillOpacity={fillOpacityFor(shape.id, shape.matched)}
              stroke={shape.id === selectedId ? INK_SELECTED : INK}
              strokeWidth={shape.id === selectedId ? 1.9 : 0.85}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedId(shape.id)}
              onMouseEnter={() => setHoveredId(shape.id)}
              onMouseLeave={() => setHoveredId((current) => (current === shape.id ? null : current))}
            >
              <title>Tract {shape.tractKey}</title>
            </path>
          ))}

          {render.shapes.map((shape) => (
            <g
              key={`${shape.id}-label`}
              pointerEvents="none"
              style={{ userSelect: 'none' }}
              transform={`translate(${shape.label[0]} ${shape.label[1]})`}
            >
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fontFamily="'Tahoma', 'Segoe UI', system-ui, sans-serif"
                fill={LABEL_RED}
                stroke={LABEL_HALO}
                strokeWidth={2.6}
                paintOrder="stroke"
              >
                {shape.tractKey}
              </text>
              {shape.acresLabel && (
                <text
                  y={11}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fontFamily="'Tahoma', 'Segoe UI', system-ui, sans-serif"
                  fill="#6b5b3e"
                  stroke={LABEL_HALO}
                  strokeWidth={1.8}
                  paintOrder="stroke"
                >
                  {shape.acresLabel} ac
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {selected && (
        <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2 text-xs text-ink">
          <span className="font-semibold">Tract {selected.tractKey}</span>
          {' • '}
          {(() => {
            const acres = featureAcres(selected);
            return acres != null ? `${formatAcres(acres)} ac` : 'acres —';
          })()}
          {' • '}
          {selected.matchedDeskMapId
            ? `linked to ${deskMapById.get(selected.matchedDeskMapId)?.code ?? '—'}`
            : 'no DeskMap match'}
          {selected.objectId !== undefined ? ` • ArcGIS OID ${selected.objectId}` : ''}
        </div>
      )}
    </div>
  );
}
