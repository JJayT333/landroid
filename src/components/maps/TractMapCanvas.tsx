import { useMemo, useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  computeTractProjection,
  featureToSvgPath,
  projectLonLat,
  type GeoBBox,
} from '../../maps/geojson-ingest';
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
    const shapes = tractFeatures.map((feature) => ({
      id: feature.id,
      tractKey: feature.tractKey,
      matched: Boolean(feature.matchedDeskMapId),
      d: featureToSvgPath(feature.polygons, proj),
      label: projectLonLat(ringCentroid(feature.polygons[0]?.outer ?? [[0, 0]]), proj),
    }));
    return { proj, shapes };
  }, [tractFeatures]);

  if (!render) return null;

  const deskMapById = new Map(deskMaps.map((dm) => [dm.id, dm]));
  const selected = tractFeatures.find((feature) => feature.id === selectedId) ?? null;

  function fillFor(id: string, matched: boolean): string {
    if (id === selectedId) return 'rgba(124, 92, 47, 0.45)'; // leather
    if (id === hoveredId) return matched ? 'rgba(63, 125, 78, 0.4)' : 'rgba(180, 130, 45, 0.35)';
    return matched ? 'rgba(63, 125, 78, 0.22)' : 'rgba(180, 130, 45, 0.16)';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-3 text-[11px] text-ink-light">
        <span className="text-ink-light">click a polygon to select it</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(63,125,78,0.45)' }} />
          matched
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(180,130,45,0.4)' }} />
          unmatched
        </span>
      </div>

      <div className="rounded-md border border-ledger-line bg-parchment overflow-hidden">
        <svg
          viewBox={`0 0 ${render.proj.width} ${render.proj.height}`}
          className="w-full"
          style={{ maxHeight: '60vh', display: 'block' }}
          role="group"
          aria-label="Tract polygons"
        >
          {render.shapes.map((shape) => (
            <path
              key={shape.id}
              d={shape.d}
              fillRule="evenodd"
              fill={fillFor(shape.id, shape.matched)}
              stroke={shape.id === selectedId ? '#7c5c2f' : '#6b5535'}
              strokeWidth={shape.id === selectedId ? 2 : 1}
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
            <text
              key={`${shape.id}-label`}
              x={shape.label[0]}
              y={shape.label[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={600}
              fill="#2d2114"
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
