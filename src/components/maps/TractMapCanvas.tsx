import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  computeTractProjection,
  featureToSvgPath,
  projectLonLat,
  type GeoBBox,
} from '../../maps/geojson-ingest';
import { TRACT_PALETTE } from '../../maps/tract-palette';
import type { GeoRing, MapTractFeature } from '../../types/map-tract-feature';

/**
 * DA2-M PR M4 — render the ingested tract polygons as SVG (the real map, not the
 * rect annotation boxes). WGS84 → planar projection is computed here from the
 * loaded feature set; click a polygon to select its tract. Matched tracts read
 * green, unmatched amber, the selected one is highlighted.
 */

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
    const proj = computeTractProjection(bbox, { size: 900, padding: 28 });
    const shapes = tractFeatures.map((feature, index) => ({
      id: feature.id,
      tractKey: feature.tractKey,
      matched: Boolean(feature.matchedDeskMapId),
      color: TRACT_PALETTE[index % TRACT_PALETTE.length],
      d: featureToSvgPath(feature.polygons, proj),
      label: projectLonLat(ringCentroid(feature.polygons[0]?.outer ?? [[0, 0]]), proj),
    }));
    return { proj, shapes };
  }, [tractFeatures]);

  if (!render) return null;

  const deskMapById = new Map(deskMaps.map((dm) => [dm.id, dm]));
  const selected = tractFeatures.find((feature) => feature.id === selectedId) ?? null;

  // Colored unit plat: each tract carries its muted palette color; selection and
  // hover deepen it, unlinked tracts sit a touch lighter than linked.
  function fillOpacityFor(id: string, matched: boolean): number {
    if (id === selectedId) return 0.82;
    if (id === hoveredId) return 0.64;
    return matched ? 0.52 : 0.34;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3 text-[11px] text-ink-light">
        <span>click a tract to select it</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#8aa9a3]" style={{ opacity: 0.52 }} />
          linked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[#8aa9a3]" style={{ opacity: 0.3 }} />
          unlinked
        </span>
      </div>

      <div className="rounded-md border border-ledger-line bg-gradient-to-b from-parchment to-parchment-dark/40 overflow-hidden shadow-sm">
        <svg
          viewBox={`0 0 ${render.proj.width} ${render.proj.height}`}
          className="w-full"
          style={{ maxHeight: '60vh', display: 'block' }}
          role="group"
          aria-label="Tract polygons"
        >
          <defs>
            <filter id="tractDepth" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodColor="#2d2114" floodOpacity="0.3" />
            </filter>
          </defs>
          {render.shapes.map((shape) => (
            <path
              key={shape.id}
              d={shape.d}
              fillRule="evenodd"
              fill={shape.color}
              fillOpacity={fillOpacityFor(shape.id, shape.matched)}
              stroke={shape.id === selectedId ? '#2d2114' : '#4a3c28'}
              strokeWidth={shape.id === selectedId ? 2 : 1.1}
              vectorEffect="non-scaling-stroke"
              filter="url(#tractDepth)"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedId(shape.id)}
              onMouseEnter={() => setHoveredId(shape.id)}
              onMouseLeave={() => setHoveredId((current) => (current === shape.id ? null : current))}
            >
              <title>Tract {shape.tractKey}</title>
            </path>
          ))}
          {render.shapes.map((shape) => (
            <text
              key={`${shape.id}-label`}
              x={shape.label[0]}
              y={shape.label[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={700}
              fill="#2d2114"
              stroke="#f4eee2"
              strokeWidth={3}
              paintOrder="stroke"
              pointerEvents="none"
              style={{ userSelect: 'none' }}
            >
              {shape.tractKey}
            </text>
          ))}
        </svg>
      </div>

      {selected && (
        <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2 text-xs text-ink">
          <span className="font-semibold">Tract {selected.tractKey}</span>
          {' • '}
          {selected.acres != null ? `${selected.acres} ac` : 'acres —'}
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
