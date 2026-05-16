import { describe, expect, it } from 'vitest';
import {
  EXTERNAL_REF_SYSTEMS,
  isExternalRefSystem,
  normalizeExternalRef,
  normalizeExternalRefs,
  type ExternalRef,
} from '../external-ref';
import { normalizeDeskMap } from '../node';

describe('isExternalRefSystem', () => {
  it('accepts every option in EXTERNAL_REF_SYSTEMS', () => {
    for (const system of EXTERNAL_REF_SYSTEMS) {
      expect(isExternalRefSystem(system)).toBe(true);
    }
  });

  it('rejects unknown or wrong-type input', () => {
    expect(isExternalRefSystem('mongo')).toBe(false);
    expect(isExternalRefSystem('ARCGIS')).toBe(false); // case-sensitive
    expect(isExternalRefSystem(undefined)).toBe(false);
    expect(isExternalRefSystem(42)).toBe(false);
  });
});

describe('normalizeExternalRef', () => {
  it('preserves a full ArcGIS-shaped ref', () => {
    const input: ExternalRef = {
      system: 'arcgis',
      externalId: 'TRACT-A-001',
      globalId: '{ABC-123-DEF}',
      objectId: 42,
      layerName: 'Tracts',
      layerUrl: 'https://example.com/arcgis/rest/services/Tracts/FeatureServer/0',
      label: 'Tract A-001',
      lastSyncedAt: '2026-05-15T12:00:00.000Z',
    };
    expect(normalizeExternalRef(input)).toEqual(input);
  });

  it('coerces an unknown system to "other"', () => {
    expect(
      normalizeExternalRef({ system: 'mongo', externalId: 'x' })
    ).toEqual({ system: 'other', externalId: 'x' });
  });

  it('returns null when no identifier is present', () => {
    expect(normalizeExternalRef({ system: 'arcgis' })).toBeNull();
    expect(normalizeExternalRef({ system: 'arcgis', label: 'just a label' })).toBeNull();
  });

  it('accepts objectId as either string or number', () => {
    expect(
      normalizeExternalRef({ system: 'arcgis', objectId: 12 })?.objectId
    ).toBe(12);
    expect(
      normalizeExternalRef({ system: 'arcgis', objectId: '12' })?.objectId
    ).toBe('12');
  });

  it('drops empty-string identifiers', () => {
    expect(
      normalizeExternalRef({ system: 'arcgis', externalId: '   ' })
    ).toBeNull();
    expect(
      normalizeExternalRef({ system: 'arcgis', externalId: 'real', globalId: '   ' })?.globalId
    ).toBeUndefined();
  });

  it('returns null for non-object inputs', () => {
    expect(normalizeExternalRef(null)).toBeNull();
    expect(normalizeExternalRef(undefined)).toBeNull();
    expect(normalizeExternalRef('arcgis')).toBeNull();
    expect(normalizeExternalRef([])).toBeNull();
    expect(normalizeExternalRef(42)).toBeNull();
  });

  it('accepts a URL-only ref (system=url, no GlobalID/ObjectID)', () => {
    expect(
      normalizeExternalRef({ system: 'url', url: 'https://example.com/tract/1' })
    ).toEqual({ system: 'url', url: 'https://example.com/tract/1' });
  });

  it('accepts a path-only file ref', () => {
    expect(
      normalizeExternalRef({ system: 'file', path: '/vault/deed.pdf' })
    ).toEqual({ system: 'file', path: '/vault/deed.pdf' });
  });

  it('trims string identifiers', () => {
    const normalized = normalizeExternalRef({
      system: 'arcgis',
      externalId: '  TRACT-1  ',
      globalId: '  {GUID}  ',
    });
    expect(normalized?.externalId).toBe('TRACT-1');
    expect(normalized?.globalId).toBe('{GUID}');
  });
});

describe('normalizeExternalRefs', () => {
  it('returns undefined (not []) for non-arrays', () => {
    expect(normalizeExternalRefs(undefined)).toBeUndefined();
    expect(normalizeExternalRefs(null)).toBeUndefined();
    expect(normalizeExternalRefs({})).toBeUndefined();
    expect(normalizeExternalRefs('arcgis')).toBeUndefined();
  });

  it('returns undefined when every entry is unusable', () => {
    expect(
      normalizeExternalRefs([{ system: 'arcgis' }, null, 'bare'])
    ).toBeUndefined();
  });

  it('preserves order and drops invalid entries', () => {
    const result = normalizeExternalRefs([
      { system: 'arcgis', externalId: 'one' },
      { system: 'arcgis' /* no id */ },
      'oops',
      { system: 'url', url: 'https://example.com' },
    ]);
    expect(result).toEqual([
      { system: 'arcgis', externalId: 'one' },
      { system: 'url', url: 'https://example.com' },
    ]);
  });
});

describe('DeskMap.externalRefs (Phase 5 ride-along)', () => {
  it('passes valid externalRefs through normalizeDeskMap', () => {
    const refs = [{ system: 'arcgis', globalId: '{TRACT-GUID}' }];
    const normalized = normalizeDeskMap({
      id: 'dm-1',
      name: 'Tract 1',
      grossAcres: '320',
      pooledAcres: '320',
      nodeIds: [],
      externalRefs: refs,
    });
    expect(normalized.externalRefs).toEqual([
      { system: 'arcgis', globalId: '{TRACT-GUID}' },
    ]);
  });

  it('omits the externalRefs key when input has none (byte-identical pre-overhaul export)', () => {
    const normalized = normalizeDeskMap({
      id: 'dm-1',
      name: 'Tract 1',
      grossAcres: '320',
      pooledAcres: '320',
      nodeIds: [],
    });
    expect(normalized.externalRefs).toBeUndefined();
    expect('externalRefs' in normalized).toBe(false);
  });

  it('omits the key when every input ref is unusable', () => {
    const normalized = normalizeDeskMap({
      id: 'dm-1',
      name: 'Tract 1',
      grossAcres: '320',
      pooledAcres: '320',
      nodeIds: [],
      externalRefs: [{ system: 'arcgis' }, null],
    });
    expect(normalized.externalRefs).toBeUndefined();
    expect('externalRefs' in normalized).toBe(false);
  });
});
