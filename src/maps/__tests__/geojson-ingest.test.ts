import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildMapTractFeatures,
  computeTractProjection,
  featureToSvgPath,
  parseAcres,
  parseTractFeatures,
  projectLonLat,
  unprojectLonLat,
} from '../geojson-ingest';

// The operator's real ArcGIS export (10 tracts, Montgomery County TX). Survey
// geometry only — tract numbers + acres, no party PII.
const sampleGeoJson = readFileSync(
  fileURLToPath(new URL('./fixtures/sample-tracts.geojson', import.meta.url)),
  'utf8'
);

describe('parseTractFeatures (real ArcGIS export)', () => {
  const collection = parseTractFeatures(sampleGeoJson);

  it('parses all 10 tract polygons with no warnings', () => {
    expect(collection.features).toHaveLength(10);
    expect(collection.warnings).toEqual([]);
    expect(collection.bbox).not.toBeNull();
  });

  it('reads the Tract property as the tract key', () => {
    const keys = collection.features.map((feature) => feature.tractKey).sort();
    expect(keys).toEqual(
      ['1', '18-201', '18-203', '18-4', '2', '22', '3', '4', '4a', '5'].sort()
    );
  });

  it('models an interior ring as a hole (tract 18-4)', () => {
    const withHole = collection.features.find((feature) => feature.tractKey === '18-4');
    expect(withHole).toBeDefined();
    expect(withHole?.polygons).toHaveLength(1);
    expect(withHole?.polygons[0].holes).toHaveLength(1);
    // a single-ring tract has no holes
    const noHole = collection.features.find((feature) => feature.tractKey === '2');
    expect(noHole?.polygons[0].holes).toHaveLength(0);
  });

  it('parses the acres string, leaving blanks null', () => {
    const t203 = collection.features.find((feature) => feature.tractKey === '18-203');
    expect(t203?.acres).toBe(110);
    expect(t203?.acresText).toBe('110.0 ac');
    const blank = collection.features.find((feature) => feature.tractKey === '4');
    expect(blank?.acres).toBeNull();
  });

  it('captures ObjectID but no GlobalID (this export carries none)', () => {
    const feature = collection.features.find((f) => f.tractKey === '18-203');
    expect(feature?.objectId).toBe(1);
    expect(feature?.globalId).toBeUndefined();
  });

  it('skips a non-polygon feature with a warning, does not throw', () => {
    const mixed = parseTractFeatures(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { Tract: 'pt' }, geometry: { type: 'Point', coordinates: [0, 0] } },
        ],
      })
    );
    expect(mixed.features).toHaveLength(0);
    expect(mixed.warnings[0]).toMatch(/not a Polygon/);
  });

  it('returns a warning (not a throw) on invalid JSON', () => {
    const broken = parseTractFeatures('{not json');
    expect(broken.features).toEqual([]);
    expect(broken.warnings[0]).toMatch(/Not valid JSON/);
  });
});

describe('parseAcres', () => {
  it('extracts the leading number from an acres string', () => {
    expect(parseAcres('110.0 ac')).toBe(110);
    expect(parseAcres('88.056 ac')).toBe(88.056);
    expect(parseAcres(42.5)).toBe(42.5);
    expect(parseAcres(' ')).toBeNull();
    expect(parseAcres('')).toBeNull();
    expect(parseAcres(undefined)).toBeNull();
  });
});

describe('WGS84 → SVG projection', () => {
  const collection = parseTractFeatures(sampleGeoJson);
  const proj = computeTractProjection(collection.bbox!, { size: 1000, padding: 24 });

  it('round-trips every vertex back to its source lon/lat', () => {
    let checked = 0;
    for (const feature of collection.features) {
      for (const polygon of feature.polygons) {
        for (const ring of [polygon.outer, ...polygon.holes]) {
          for (const position of ring) {
            const [lon, lat] = unprojectLonLat(projectLonLat(position, proj), proj);
            expect(lon).toBeCloseTo(position[0], 9);
            expect(lat).toBeCloseTo(position[1], 9);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('keeps the projection within the padded viewBox and flips latitude (y-down)', () => {
    const [lonMin, latMin, lonMax, latMax] = collection.bbox!;
    const topLeft = projectLonLat([lonMin, latMax], proj);
    const bottomRight = projectLonLat([lonMax, latMin], proj);
    expect(topLeft[0]).toBeCloseTo(proj.padding, 6);
    expect(topLeft[1]).toBeCloseTo(proj.padding, 6); // northmost lat → smallest y
    expect(bottomRight[1]).toBeGreaterThan(topLeft[1]); // south is lower on screen
    expect(bottomRight[0]).toBeLessThanOrEqual(proj.width + 1e-6);
    expect(bottomRight[1]).toBeLessThanOrEqual(proj.height + 1e-6);
  });

  it('emits an evenodd SVG path with one subpath per ring (holes included)', () => {
    const withHole = collection.features.find((feature) => feature.tractKey === '18-4')!;
    const path = featureToSvgPath(withHole.polygons, proj);
    // outer + 1 hole = 2 subpaths (each starts with M, ends with Z)
    expect((path.match(/M/g) ?? []).length).toBe(2);
    expect((path.match(/Z/g) ?? []).length).toBe(2);
  });
});

describe('buildMapTractFeatures', () => {
  const collection = parseTractFeatures(sampleGeoJson);
  const features = buildMapTractFeatures('ws-1', 'asset-1', collection, '2026-06-16T00:00:00.000Z');

  it('materializes one storable feature per parsed polygon, unmatched', () => {
    expect(features).toHaveLength(10);
    expect(features.every((feature) => feature.matchedDeskMapId === null)).toBe(true);
    expect(features.every((feature) => feature.workspaceId === 'ws-1')).toBe(true);
    expect(features.every((feature) => feature.assetId === 'asset-1')).toBe(true);
  });

  it('uses stable ids so re-ingest overwrites rather than duplicates', () => {
    const again = buildMapTractFeatures('ws-1', 'asset-1', collection, '2026-06-16T01:00:00.000Z');
    expect(features.map((feature) => feature.id)).toEqual(again.map((feature) => feature.id));
    // ids are unique within the asset
    expect(new Set(features.map((feature) => feature.id)).size).toBe(10);
  });
});
