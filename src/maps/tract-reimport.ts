/**
 * Detect a likely re-import of an ArcGIS tract export.
 *
 * Each ingest mints a fresh asset, so re-importing the same file would stack a
 * second copy of every tract. We never dedup silently (the operator's standing
 * rule is warn-and-choose); this just flags the prior asset most of whose tracts
 * the new file repeats, so the UI can offer to replace it or keep both.
 */
import type { MapTractFeature } from '../types/map-tract-feature';
import { normalizeTractCode } from './feature-tract-matcher';

export interface TractReimportMatch {
  /** The prior asset whose tracts substantially overlap the new file. */
  assetId: string;
  /** How many of the prior asset's tracts also appear in the new file. */
  matched: number;
  /** The prior asset's tract count. */
  priorTotal: number;
}

/** A prior asset counts as a re-import when the new file repeats most of its tracts. */
const OVERLAP_THRESHOLD = 0.7;

export function detectTractReimport(
  newTractKeys: readonly string[],
  existing: readonly MapTractFeature[]
): TractReimportMatch | null {
  if (newTractKeys.length === 0 || existing.length === 0) return null;
  const newKeys = new Set(newTractKeys.map(normalizeTractCode));

  const keysByAsset = new Map<string, Set<string>>();
  for (const feature of existing) {
    const keys = keysByAsset.get(feature.assetId) ?? new Set<string>();
    keys.add(normalizeTractCode(feature.tractKey));
    keysByAsset.set(feature.assetId, keys);
  }

  let best: TractReimportMatch | null = null;
  for (const [assetId, keys] of keysByAsset) {
    let matched = 0;
    for (const key of keys) {
      if (newKeys.has(key)) matched += 1;
    }
    if (matched / keys.size >= OVERLAP_THRESHOLD && (!best || matched > best.matched)) {
      best = { assetId, matched, priorTotal: keys.size };
    }
  }
  return best;
}
