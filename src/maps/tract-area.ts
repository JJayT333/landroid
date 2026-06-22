/**
 * Geodesic acreage of an ingested tract polygon.
 *
 * ArcGIS exports often leave the human `Acres` string blank on interior tracts
 * (only the source `Shape_Area`, in a distorted projected CRS, survives). To
 * crosswalk a renumbered export to LANDroid DeskMaps by acreage we need a
 * trustworthy area straight from the WGS84 rings, so we compute the spherical
 * polygon area directly (good to ~1-2%, which is ample for nearest-acre
 * matching). Holes subtract; multipolygons sum.
 */
import type { GeoRing, MapTractFeature, TractPolygon } from '../types/map-tract-feature';

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_378_137; // WGS84 semi-major axis
const SQ_METERS_PER_ACRE = 4046.8564224;

/** Spherical-trapezoid (line-integral) area of a closed ring, in m² (unsigned). */
function ringAreaSqMeters(ring: GeoRing): number {
  const n = ring.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % n];
    sum += (lon2 - lon1) * DEG2RAD * (2 + Math.sin(lat1 * DEG2RAD) + Math.sin(lat2 * DEG2RAD));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Acreage of a set of polygons (outer rings add, holes subtract); null if empty. */
export function tractPolygonAcres(polygons: readonly TractPolygon[]): number | null {
  let sqMeters = 0;
  for (const polygon of polygons) {
    sqMeters += ringAreaSqMeters(polygon.outer);
    for (const hole of polygon.holes) {
      sqMeters -= ringAreaSqMeters(hole);
    }
  }
  return sqMeters > 0 ? sqMeters / SQ_METERS_PER_ACRE : null;
}

/**
 * Best available acreage for a feature: the authoritative parsed `Acres` string
 * when present, else the geodesic polygon area. Used both to crosswalk by
 * acreage and to display an acreage for tracts the export left blank.
 */
export function featureAcres(
  feature: Pick<MapTractFeature, 'acres' | 'polygons'>
): number | null {
  if (feature.acres != null) return feature.acres;
  return tractPolygonAcres(feature.polygons);
}
