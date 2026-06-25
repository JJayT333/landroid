import { describe, expect, it } from 'vitest';
import { detectTractReimport } from '../tract-reimport';
import type { MapTractFeature } from '../../types/map-tract-feature';

function feat(assetId: string, tractKey: string): MapTractFeature {
  return { id: `${assetId}-${tractKey}`, assetId, tractKey } as MapTractFeature;
}

const UNIT = ['1', '2', '3', '4', '4a', '5', '22'];

describe('detectTractReimport', () => {
  const prior = UNIT.map((key) => feat('asset-1', key));

  it('flags a re-import of the same tract set', () => {
    expect(detectTractReimport(UNIT, prior)).toMatchObject({
      assetId: 'asset-1',
      matched: 7,
      priorTotal: 7,
    });
  });

  it('flags substantial overlap at/above the threshold (5/7)', () => {
    expect(detectTractReimport(['1', '2', '3', '4', '4a'], prior)?.assetId).toBe('asset-1');
  });

  it('ignores a different file (low overlap)', () => {
    expect(detectTractReimport(['99', '100'], prior)).toBeNull();
  });

  it('normalizes keys (case/space/underscore)', () => {
    expect(detectTractReimport(['1', '2', '3', '4', ' 4A ', '5', '22'], prior)?.matched).toBe(7);
  });

  it('returns null when nothing is loaded yet', () => {
    expect(detectTractReimport(['1', '2'], [])).toBeNull();
    expect(detectTractReimport([], prior)).toBeNull();
  });

  it('picks the asset with the most overlap among several', () => {
    const existing = [
      ...['1', '2', '3'].map((k) => feat('asset-a', k)),
      ...['1', '2', '3', '4', '4a'].map((k) => feat('asset-b', k)),
    ];
    expect(detectTractReimport(['1', '2', '3', '4', '4a'], existing)?.assetId).toBe('asset-b');
  });
});
