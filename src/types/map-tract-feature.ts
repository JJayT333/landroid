/**
 * A tract polygon ingested from an ArcGIS GeoJSON export (DA2-M).
 *
 * Separate from `MapRegion` (which models rectangle/page annotation boxes drawn
 * on a raster map asset) — a `MapTractFeature` carries real WGS84 geometry and a
 * nullable link to a LANDroid `DeskMap`. The original lon/lat rings are the
 * source of truth (round-trip GeoJSON export); the SVG projection is derived at
 * render time (see `maps/geojson-ingest.ts`).
 */

/** A WGS84 ring: an ordered list of `[lon, lat]` positions. */
export type GeoRing = Array<[number, number]>;

/** One simple polygon: an outer ring plus zero or more interior holes. */
export interface TractPolygon {
  outer: GeoRing;
  holes: GeoRing[];
}

/** `[lonMin, latMin, lonMax, latMax]`. */
export type GeoBBox = [number, number, number, number];

export interface MapTractFeature {
  id: string;
  workspaceId: string;
  /** The source GeoJSON `MapAsset` this feature was ingested from. */
  assetId: string;
  /** The GeoJSON `Tract` property (the human tract key, e.g. "18-203", "4a"). */
  tractKey: string;
  /** Acres parsed from the source string; null when blank/unparseable. */
  acres: number | null;
  /** The raw acres string as delivered (kept verbatim). */
  acresText: string;
  /** ArcGIS ObjectID (convenience identity — never the sole join key). */
  objectId?: string | number;
  /** ArcGIS GlobalID, when present (the preferred cross-system join key). */
  globalId?: string;
  /** Disjoint polygons (each: outer ring + holes), WGS84 source coordinates. */
  polygons: TractPolygon[];
  bbox: GeoBBox;
  /** The matched LANDroid `DeskMap` id, or null until matched (PR M2). */
  matchedDeskMapId: string | null;
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Build a stable feature id from the source asset + the feature's own identity,
 * so re-ingesting the same GeoJSON is idempotent (overwrites rather than
 * duplicates). Prefers GlobalID, then ObjectID, then the tract key.
 */
export function mapTractFeatureId(
  assetId: string,
  identity: Pick<MapTractFeature, 'tractKey' | 'objectId' | 'globalId'>
): string {
  const key =
    identity.globalId
    ?? (identity.objectId !== undefined ? `oid:${identity.objectId}` : null)
    ?? `tract:${identity.tractKey}`;
  return `tract-feature::${assetId}::${key}`;
}

export function normalizeMapTractFeature(
  feature: Pick<MapTractFeature, 'id' | 'workspaceId' | 'assetId'> & Partial<MapTractFeature>
): MapTractFeature {
  const now = nowIso();
  return {
    id: feature.id,
    workspaceId: feature.workspaceId,
    assetId: feature.assetId,
    tractKey: typeof feature.tractKey === 'string' ? feature.tractKey : '',
    acres: typeof feature.acres === 'number' && Number.isFinite(feature.acres) ? feature.acres : null,
    acresText: typeof feature.acresText === 'string' ? feature.acresText : '',
    objectId: feature.objectId,
    globalId: typeof feature.globalId === 'string' && feature.globalId ? feature.globalId : undefined,
    polygons: Array.isArray(feature.polygons) ? feature.polygons : [],
    bbox: feature.bbox ?? [0, 0, 0, 0],
    matchedDeskMapId:
      typeof feature.matchedDeskMapId === 'string' && feature.matchedDeskMapId
        ? feature.matchedDeskMapId
        : null,
    createdAt: feature.createdAt ?? now,
    updatedAt: feature.updatedAt ?? now,
  };
}
