import { describe, expect, it } from 'vitest';
import { parseGeoJsonSummary } from '../geojson-summary';

describe('geojson-summary', () => {
  it('summarizes feature labels, geometry types, and bounds', () => {
    const summary = parseGeoJsonSummary(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'tract-1',
            properties: { name: 'Lease Tract A' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-104, 32],
                  [-103, 32],
                  [-103, 33],
                  [-104, 33],
                  [-104, 32],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [-102, 34] },
          },
        ],
      })
    );

    expect(summary.featureCount).toBe(2);
    expect(summary.features).toEqual([
      { id: 'tract-1', label: 'Lease Tract A', geometryType: 'Polygon' },
      { id: 'feature-2', label: 'Feature 2', geometryType: 'Point' },
    ]);
    expect(summary.bbox).toEqual([-104, 32, -102, 34]);
  });

  it('characterizes current permissive non-FeatureCollection handling', () => {
    expect(
      parseGeoJsonSummary(
        JSON.stringify({
          type: 'Feature',
          id: 'single-tract',
          properties: { title: 'Single Tract' },
          geometry: { type: 'Point', coordinates: [-100, 31] },
        })
      )
    ).toEqual({
      featureCount: 1,
      features: [
        { id: 'single-tract', label: 'Single Tract', geometryType: 'Point' },
      ],
      bbox: [-100, 31, -100, 31],
    });

    expect(parseGeoJsonSummary(JSON.stringify({ type: 'GeometryCollection' }))).toEqual({
      featureCount: 0,
      features: [],
      bbox: null,
    });
  });
});
