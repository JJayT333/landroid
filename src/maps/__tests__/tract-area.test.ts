import { describe, expect, it } from 'vitest';
import { featureAcres, tractPolygonAcres } from '../tract-area';
import type { GeoRing } from '../../types/map-tract-feature';

/** A square of `side` degrees with its SW corner at (lon, lat). */
function square(lon: number, lat: number, side: number): GeoRing {
  return [
    [lon, lat],
    [lon + side, lat],
    [lon + side, lat + side],
    [lon, lat + side],
  ];
}

describe('tract area', () => {
  it('computes a plausible geodesic acreage for a real-scale polygon', () => {
    // ~0.01° square near the equator ≈ 1113 m on a side ≈ 306 acres.
    const acres = tractPolygonAcres([{ outer: square(0, 0, 0.01), holes: [] }]);
    expect(acres).not.toBeNull();
    expect(acres as number).toBeGreaterThan(295);
    expect(acres as number).toBeLessThan(315);
  });

  it('subtracts holes from the outer ring', () => {
    const outer = square(0, 0, 0.01);
    const withHole = tractPolygonAcres([{ outer, holes: [square(0.002, 0.002, 0.004)] }]);
    const solid = tractPolygonAcres([{ outer, holes: [] }]);
    expect(withHole as number).toBeLessThan(solid as number);
    expect(withHole as number).toBeGreaterThan(0);
  });

  it('sums disjoint polygons', () => {
    const one = tractPolygonAcres([{ outer: square(0, 0, 0.01), holes: [] }]) as number;
    const two = tractPolygonAcres([
      { outer: square(0, 0, 0.01), holes: [] },
      { outer: square(1, 1, 0.01), holes: [] },
    ]) as number;
    expect(two).toBeCloseTo(one * 2, 0);
  });

  it('prefers the authoritative parsed Acres over geometry, else falls back', () => {
    const polygons = [{ outer: square(0, 0, 0.01), holes: [] }];
    expect(featureAcres({ acres: 42.581, polygons })).toBe(42.581);
    const derived = featureAcres({ acres: null, polygons });
    expect(derived).not.toBeNull();
    expect(derived as number).toBeGreaterThan(0);
  });

  it('returns null for empty geometry with no acres', () => {
    expect(featureAcres({ acres: null, polygons: [] })).toBeNull();
  });
});
