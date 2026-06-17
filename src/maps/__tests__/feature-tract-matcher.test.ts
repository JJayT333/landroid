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

function deskMap(id: string, code: string): DeskMap {
  return {
    id,
    name: code,
    code,
    tractId: null,
    grossAcres: '',
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
