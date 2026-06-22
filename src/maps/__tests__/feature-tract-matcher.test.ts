import { describe, expect, it } from 'vitest';
import {
  buildArcgisExternalRef,
  normalizeTractCode,
  removeExternalRef,
  sameArcgisTarget,
  suggestTractMatches,
  upsertExternalRef,
} from '../feature-tract-matcher';
import { normalizeMapTractFeature, type MapTractFeature } from '../../types/map-tract-feature';
import type { DeskMap } from '../../types/node';
import type { ExternalRef } from '../../types/external-ref';

function feature(tractKey: string, overrides: Partial<MapTractFeature> = {}): MapTractFeature {
  return normalizeMapTractFeature({
    id: `feat-${tractKey}`,
    workspaceId: 'ws-1',
    assetId: 'asset-1',
    tractKey,
    polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
    bbox: [0, 0, 1, 1],
    ...overrides,
  });
}

function deskMap(id: string, code: string, grossAcres = ''): DeskMap {
  return {
    id,
    name: code,
    code,
    tractId: null,
    grossAcres,
    pooledAcres: '',
    description: '',
    nodeIds: [],
  } as DeskMap;
}

describe('suggestTractMatches', () => {
  const deskMaps = [
    deskMap('dm-203', '18-203'),
    deskMap('dm-201', '18-201'),
    deskMap('dm-4a', '4a'),
    deskMap('dm-1', '1'),
  ];

  it('matches exact Tract↔code', () => {
    const [s] = suggestTractMatches([feature('18-203')], deskMaps);
    expect(s).toMatchObject({ deskMapId: 'dm-203', confidence: 'exact' });
  });

  it('matches normalized (case/space/underscore) when no exact', () => {
    const [s] = suggestTractMatches([feature('18 _201')], deskMaps);
    expect(s).toMatchObject({ deskMapId: 'dm-201', confidence: 'normalized' });
  });

  it('returns none for an unmatched key (no silent auto-link)', () => {
    const [s] = suggestTractMatches([feature('99')], deskMaps);
    expect(s).toMatchObject({ deskMapId: null, confidence: 'none' });
  });

  it('does not confuse sibling keys 4 / 4a', () => {
    const result = suggestTractMatches([feature('4'), feature('4a')], deskMaps);
    // "4" has no exact/normalized DeskMap here → none; "4a" matches dm-4a
    expect(result[0]).toMatchObject({ tractKey: '4', deskMapId: null });
    expect(result[1]).toMatchObject({ tractKey: '4a', deskMapId: 'dm-4a', confidence: 'exact' });
  });

  it('normalizeTractCode lowercases and collapses separators', () => {
    expect(normalizeTractCode('18 _201')).toBe('18-201');
    expect(normalizeTractCode('  4A ')).toBe('4a');
  });
});

describe('suggestTractMatches — acreage crosswalk (renumbered export)', () => {
  // The real Dr. Elmore unit: codes TRn, but the operator's ArcGIS export keys
  // tracts as 1/2/3/4/4a/5/22 — so the pairing must come from acreage.
  const unitDeskMaps = [
    deskMap('dm-tr1', 'TR1', '55.5016'),
    deskMap('dm-tr2', 'TR2', '106.19'),
    deskMap('dm-tr3', 'TR3', '28.223'),
    deskMap('dm-tr4', 'TR4', '14.64'),
    deskMap('dm-tr5', 'TR5', '8.44'),
    deskMap('dm-tr6', 'TR6', '42.581'),
    deskMap('dm-tr7', 'TR7', '20.546'),
  ];

  // Acreages as the export delivers them (string Acres for 1/2, geodesic for the
  // rest) plus the three neighbor tracts that must NOT win a unit DeskMap.
  function feat(tractKey: string, acres: number) {
    return feature(tractKey, { acres });
  }

  it('crosswalks every unit tract to its DeskMap and leaves neighbors unmatched', () => {
    const features = [
      feat('1', 106.236),
      feat('2', 42.581),
      feat('3', 26.32),
      feat('4', 15.06),
      feat('4a', 10.13),
      feat('5', 21.2),
      feat('22', 57.2),
      feat('18-203', 110.0),
      feat('18-201', 88.056),
      feat('18-4', 108.076),
    ];
    const byKey = new Map(
      suggestTractMatches(features, unitDeskMaps).map((s) => [s.tractKey, s])
    );

    expect(byKey.get('1')).toMatchObject({ deskMapId: 'dm-tr2', confidence: 'acreage' });
    expect(byKey.get('2')).toMatchObject({ deskMapId: 'dm-tr6', confidence: 'acreage' });
    expect(byKey.get('3')).toMatchObject({ deskMapId: 'dm-tr3', confidence: 'acreage' });
    expect(byKey.get('4')).toMatchObject({ deskMapId: 'dm-tr4', confidence: 'acreage' });
    expect(byKey.get('4a')).toMatchObject({ deskMapId: 'dm-tr5', confidence: 'acreage' });
    expect(byKey.get('5')).toMatchObject({ deskMapId: 'dm-tr7', confidence: 'acreage' });
    expect(byKey.get('22')).toMatchObject({ deskMapId: 'dm-tr1', confidence: 'acreage' });

    // The three neighbors cluster near TR2 by area but must not steal it.
    expect(byKey.get('18-203')).toMatchObject({ deskMapId: null, confidence: 'none' });
    expect(byKey.get('18-201')).toMatchObject({ deskMapId: null, confidence: 'none' });
    expect(byKey.get('18-4')).toMatchObject({ deskMapId: null, confidence: 'none' });

    // Each DeskMap claimed at most once.
    const claimed = [...byKey.values()].map((s) => s.deskMapId).filter(Boolean);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('greedy one-to-one keeps the closest tract; a near-sized neighbor falls to none', () => {
    const dms = [deskMap('dm-tr2', 'TR2', '106.19')];
    const byKey = new Map(
      suggestTractMatches([feat('1', 106.236), feat('18-4', 108.076)], dms).map((s) => [
        s.tractKey,
        s,
      ])
    );
    expect(byKey.get('1')).toMatchObject({ deskMapId: 'dm-tr2', confidence: 'acreage' });
    expect(byKey.get('18-4')).toMatchObject({ deskMapId: null, confidence: 'none' });
  });

  it('never overrides an exact code match with acreage', () => {
    const dms = [deskMap('dm-tr6', 'TR6', '42.581')];
    const byKey = new Map(
      suggestTractMatches([feat('TR6', 999), feat('x', 42.581)], dms).map((s) => [s.tractKey, s])
    );
    expect(byKey.get('TR6')).toMatchObject({ deskMapId: 'dm-tr6', confidence: 'exact' });
    // TR6 is already claimed by the code match, so the 42.581 feature gets none.
    expect(byKey.get('x')).toMatchObject({ deskMapId: null, confidence: 'none' });
  });

  it('rejects an acreage match that is wildly out of tolerance', () => {
    const dms = [deskMap('dm-tr5', 'TR5', '8.44')];
    const [s] = suggestTractMatches([feat('huge', 500)], dms);
    expect(s).toMatchObject({ deskMapId: null, confidence: 'none' });
  });

  it('uses geodesic area when the export left Acres blank', () => {
    // A ~0.01° square near the equator computes to ~306 geodesic acres.
    const blank = feature('blank', {
      acres: null,
      polygons: [
        {
          outer: [
            [0, 0],
            [0.01, 0],
            [0.01, 0.01],
            [0, 0.01],
          ],
          holes: [],
        },
      ],
    });
    const [s] = suggestTractMatches([blank], [deskMap('dm-x', 'X', '306')]);
    expect(s).toMatchObject({ deskMapId: 'dm-x', confidence: 'acreage' });
  });
});

describe('ArcGIS external ref helpers', () => {
  it('builds an arcgis ref from a feature (ObjectID + key, no GlobalID here)', () => {
    const ref = buildArcgisExternalRef(feature('18-203', { objectId: 1 }));
    expect(ref).toMatchObject({
      system: 'arcgis',
      objectId: 1,
      externalId: '18-203',
      layerName: 'Tracts',
    });
    expect(ref?.globalId).toBeUndefined();
  });

  it('matches the same ArcGIS target by ObjectID', () => {
    const a: ExternalRef = { system: 'arcgis', objectId: 7, externalId: 'A' };
    const b: ExternalRef = { system: 'arcgis', objectId: 7, externalId: 'B' };
    const c: ExternalRef = { system: 'arcgis', objectId: 9, externalId: 'A' };
    expect(sameArcgisTarget(a, b)).toBe(true);
    expect(sameArcgisTarget(a, c)).toBe(false);
  });

  it('upsert replaces the same target (idempotent), remove drops it', () => {
    const existing: ExternalRef[] = [
      { system: 'url', url: 'https://x' },
      { system: 'arcgis', objectId: 7, label: 'old' },
    ];
    const ref: ExternalRef = { system: 'arcgis', objectId: 7, label: 'new' };
    const upserted = upsertExternalRef(existing, ref);
    expect(upserted).toHaveLength(2);
    expect(upserted.filter((r) => r.system === 'arcgis')).toEqual([ref]);
    // re-upsert is idempotent
    expect(upsertExternalRef(upserted, ref)).toHaveLength(2);
    // remove drops the arcgis ref, keeps the url ref
    const removed = removeExternalRef(upserted, ref);
    expect(removed).toEqual([{ system: 'url', url: 'https://x' }]);
  });
});
