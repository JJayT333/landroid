/**
 * Full-geometry GeoJSON ingest for the tract side-store (DA2-M).
 *
 * `geojson-summary.ts` extracts only labels + a bbox for the map-asset preview.
 * This module parses the real polygon geometry of an ArcGIS tract export so the
 * features can be matched to LANDroid tracts, rendered as SVG, and exported back
 * keyed `LAND_TRACT_ID`. Source of truth is the original WGS84 (lon/lat) rings —
 * the SVG projection is a pure, render-time function of the feature set (computed
 * here, never stored), so a different viewBox/zoom never needs a re-ingest and a
 * per-tract GeoJSON export round-trips to the exact source coordinates.
 *
 * Holes + multipart tracts are modelled explicitly (`TractPolygon { outer; holes }`)
 * because the provided unit has at least one tract with an interior ring.
 */

import {
  mapTractFeatureId,
  normalizeMapTractFeature,
  type MapTractFeature,
} from '../types/map-tract-feature';
import type { GeoBBox, GeoRing, TractPolygon } from '../types/map-tract-feature';

export type { GeoBBox, GeoRing, TractPolygon } from '../types/map-tract-feature';

export interface ParsedTractFeature {
  /** The GeoJSON `Tract` property (or first label-ish property / id fallback). */
  tractKey: string;
  /** Acres parsed from a string like "110.0 ac"; null when blank/unparseable. */
  acres: number | null;
  /** The raw acres string as delivered (kept verbatim for display/round-trip). */
  acresText: string;
  /** ArcGIS ObjectID (convenience/cache identity — never the sole join key). */
  objectId?: string | number;
  /** ArcGIS GlobalID, when the export carries one (the preferred join key). */
  globalId?: string;
  /** Disjoint polygons (each: outer ring + holes), WGS84. */
  polygons: TractPolygon[];
  /** Bounding box across all of this feature's positions. */
  bbox: GeoBBox;
}

export interface TractFeatureCollection {
  features: ParsedTractFeature[];
  /** Bounding box across every feature, or null when empty. */
  bbox: GeoBBox | null;
  /** Non-fatal issues (skipped non-polygon features, etc.). */
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
  );
}

function toRing(value: unknown): GeoRing | null {
  if (!Array.isArray(value)) return null;
  const ring: GeoRing = [];
  for (const position of value) {
    if (!isPosition(position)) return null;
    ring.push([position[0], position[1]]);
  }
  return ring.length >= 3 ? ring : null;
}

/** A GeoJSON `Polygon` coordinates value → one `TractPolygon`. */
function polygonFromRings(value: unknown): TractPolygon | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rings = value.map(toRing);
  const outer = rings[0];
  if (!outer) return null;
  const holes = rings.slice(1).filter((ring): ring is GeoRing => ring !== null);
  return { outer, holes };
}

function polygonsFromGeometry(geometry: Record<string, unknown>): TractPolygon[] {
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    const polygon = polygonFromRings(coordinates);
    return polygon ? [polygon] : [];
  }
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    return coordinates
      .map(polygonFromRings)
      .filter((polygon): polygon is TractPolygon => polygon !== null);
  }
  return [];
}

function bboxOfPolygons(polygons: TractPolygon[]): GeoBBox | null {
  let lonMin = Infinity;
  let latMin = Infinity;
  let lonMax = -Infinity;
  let latMax = -Infinity;
  for (const polygon of polygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      for (const [lon, lat] of ring) {
        if (lon < lonMin) lonMin = lon;
        if (lat < latMin) latMin = lat;
        if (lon > lonMax) lonMax = lon;
        if (lat > latMax) latMax = lat;
      }
    }
  }
  return Number.isFinite(lonMin) ? [lonMin, latMin, lonMax, latMax] : null;
}

function mergeBBox(into: GeoBBox | null, next: GeoBBox): GeoBBox {
  if (!into) return [...next];
  return [
    Math.min(into[0], next[0]),
    Math.min(into[1], next[1]),
    Math.max(into[2], next[2]),
    Math.max(into[3], next[3]),
  ];
}

const TRACT_PROPERTY_KEYS = ['Tract', 'tract', 'TRACT', 'name', 'label', 'title'];

function readTractKey(properties: Record<string, unknown>, fallback: string): string {
  for (const key of TRACT_PROPERTY_KEYS) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

/** Parse "110.0 ac" / "88.056 ac" / " " → a number or null. */
export function parseAcres(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readObjectId(properties: Record<string, unknown>): string | number | undefined {
  for (const key of ['OBJECTID', 'ObjectID', 'objectId', 'OID', 'FID']) {
    const value = properties[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readGlobalId(properties: Record<string, unknown>): string | undefined {
  for (const key of ['GlobalID', 'GLOBALID', 'globalId', 'global_id']) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Parse a GeoJSON `FeatureCollection` (or single `Feature`) of tract polygons.
 * Non-polygon / empty-geometry features are skipped with a warning rather than
 * failing the whole import.
 */
export function parseTractFeatures(text: string): TractFeatureCollection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      features: [],
      bbox: null,
      warnings: [`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const rawFeatures =
    isRecord(parsed) && Array.isArray(parsed.features)
      ? parsed.features
      : isRecord(parsed) && parsed.type === 'Feature'
        ? [parsed]
        : [];

  const warnings: string[] = [];
  if (rawFeatures.length === 0) {
    warnings.push('No GeoJSON features found (expected a FeatureCollection or Feature).');
  }

  const features: ParsedTractFeature[] = [];
  let bbox: GeoBBox | null = null;

  rawFeatures.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const properties = isRecord(raw.properties) ? raw.properties : {};
    const fallbackKey =
      typeof raw.id === 'string' || typeof raw.id === 'number'
        ? String(raw.id)
        : `Feature ${index + 1}`;
    const tractKey = readTractKey(properties, fallbackKey);

    const geometry = isRecord(raw.geometry) ? raw.geometry : null;
    const polygons = geometry ? polygonsFromGeometry(geometry) : [];
    if (polygons.length === 0) {
      warnings.push(
        `Skipped "${tractKey}": geometry is not a Polygon/MultiPolygon with a valid ring.`
      );
      return;
    }
    const featureBBox = bboxOfPolygons(polygons);
    if (!featureBBox) {
      warnings.push(`Skipped "${tractKey}": no finite coordinates.`);
      return;
    }

    const acresText = typeof properties.Acres === 'string' ? properties.Acres : '';
    features.push({
      tractKey,
      acres: parseAcres(properties.Acres),
      acresText,
      objectId: readObjectId(properties),
      globalId: readGlobalId(properties),
      polygons,
      bbox: featureBBox,
    });
    bbox = mergeBBox(bbox, featureBBox);
  });

  return { features, bbox, warnings };
}

// ── Projection (WGS84 lon/lat → planar SVG, pure & render-time) ──────────────
//
// A local equirectangular projection: longitude is scaled by cos(meanLat) so a
// degree of longitude and a degree of latitude render at the same on-screen
// distance (tracts are ~1 sq mi, so the small-angle approximation is exact to
// well under a pixel). SVG y grows downward, so latitude is flipped. The params
// are kept on the result so `unprojectLonLat` recovers the source coordinates.

export interface TractProjection {
  lonMin: number;
  latMax: number;
  cosLat: number;
  /** Pixels per degree of latitude (and per cos-scaled degree of longitude). */
  scale: number;
  padding: number;
  width: number;
  height: number;
}

const DEG2RAD = Math.PI / 180;

/** Merge the bounding boxes of a set of parsed/stored features. */
export function mergeFeatureBBoxes(
  features: ReadonlyArray<{ bbox: GeoBBox }>
): GeoBBox | null {
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

/** Vertex-average centroid of a ring (good enough for a label anchor). */
export function ringCentroid(ring: GeoRing): [number, number] {
  if (ring.length === 0) return [0, 0];
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return [lon / ring.length, lat / ring.length];
}

export function computeTractProjection(
  bbox: GeoBBox,
  options: { size?: number; padding?: number } = {}
): TractProjection {
  const size = options.size ?? 1000;
  const padding = options.padding ?? 24;
  const [lonMin, latMin, lonMax, latMax] = bbox;
  const meanLat = (latMin + latMax) / 2;
  const cosLat = Math.cos(meanLat * DEG2RAD);
  const lonSpanScaled = Math.max((lonMax - lonMin) * cosLat, 1e-9);
  const latSpan = Math.max(latMax - latMin, 1e-9);
  const usable = Math.max(size - padding * 2, 1);
  const scale = usable / Math.max(lonSpanScaled, latSpan);
  return {
    lonMin,
    latMax,
    cosLat,
    scale,
    padding,
    width: padding * 2 + lonSpanScaled * scale,
    height: padding * 2 + latSpan * scale,
  };
}

export function projectLonLat(
  [lon, lat]: [number, number],
  proj: TractProjection
): [number, number] {
  return [
    proj.padding + (lon - proj.lonMin) * proj.cosLat * proj.scale,
    proj.padding + (proj.latMax - lat) * proj.scale,
  ];
}

export function unprojectLonLat(
  [x, y]: [number, number],
  proj: TractProjection
): [number, number] {
  return [
    proj.lonMin + (x - proj.padding) / (proj.cosLat * proj.scale),
    proj.latMax - (y - proj.padding) / proj.scale,
  ];
}

/**
 * Materialize parsed features into storable `MapTractFeature` rows for one
 * source GeoJSON asset. Ids are stable per (asset, feature) so re-ingesting the
 * same file overwrites rather than duplicates.
 */
export function buildMapTractFeatures(
  workspaceId: string,
  assetId: string,
  collection: TractFeatureCollection,
  now: string
): MapTractFeature[] {
  return collection.features.map((feature) =>
    normalizeMapTractFeature({
      id: mapTractFeatureId(assetId, feature),
      workspaceId,
      assetId,
      tractKey: feature.tractKey,
      acres: feature.acres,
      acresText: feature.acresText,
      objectId: feature.objectId,
      globalId: feature.globalId,
      polygons: feature.polygons,
      bbox: feature.bbox,
      matchedDeskMapId: null,
      createdAt: now,
      updatedAt: now,
    })
  );
}

/** SVG `points` string ("x,y x,y …") for a single ring, rounded to 3dp. */
export function ringToSvgPoints(ring: GeoRing, proj: TractProjection): string {
  return ring
    .map((position) => {
      const [x, y] = projectLonLat(position, proj);
      return `${x.toFixed(3)},${y.toFixed(3)}`;
    })
    .join(' ');
}

/**
 * SVG path `d` for one feature's polygons (outer + holes as subpaths). Render
 * with `fill-rule="evenodd"` so interior rings cut holes.
 */
export function featureToSvgPath(
  polygons: TractPolygon[],
  proj: TractProjection
): string {
  const subpath = (ring: GeoRing): string => {
    const points = ring.map((position) => {
      const [x, y] = projectLonLat(position, proj);
      return `${x.toFixed(3)},${y.toFixed(3)}`;
    });
    return `M${points.join(' L')}Z`;
  };
  return polygons
    .flatMap((polygon) => [polygon.outer, ...polygon.holes])
    .map(subpath)
    .join(' ');
}
