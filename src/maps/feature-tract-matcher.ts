/**
 * Match ingested GeoJSON tract features to LANDroid DeskMaps (DA2-M, PR M2).
 *
 * The join is the GeoJSON `Tract` property ↔ `DeskMap.code` (verified to match
 * exactly on the operator's export). We suggest the exact match first, then a
 * normalized match (case/space/underscore-insensitive), and leave the rest for
 * the operator to resolve — never a silent auto-link, because real exports carry
 * sibling keys like "4", "4a", and "18-4" that a human must disambiguate.
 *
 * Confirming a match also writes the ArcGIS `ExternalRef` onto the DeskMap,
 * finally populating the long-dormant `DeskMap.externalRefs` contract.
 */
import type { MapTractFeature } from '../types/map-tract-feature';
import type { DeskMap } from '../types/node';
import { normalizeExternalRef, type ExternalRef } from '../types/external-ref';

export type TractMatchConfidence = 'exact' | 'normalized' | 'none';

export interface TractMatchSuggestion {
  featureId: string;
  tractKey: string;
  /** The suggested DeskMap id, or null when nothing matched. */
  deskMapId: string | null;
  confidence: TractMatchConfidence;
}

/** Case/space/underscore-insensitive code key, e.g. "18 _201" → "18-201". */
export function normalizeTractCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function suggestTractMatches(
  features: readonly MapTractFeature[],
  deskMaps: readonly DeskMap[]
): TractMatchSuggestion[] {
  const byCode = new Map<string, string>();
  const byNormalized = new Map<string, string>();
  for (const deskMap of deskMaps) {
    const code = deskMap.code?.trim();
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, deskMap.id);
    const normalized = normalizeTractCode(code);
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, deskMap.id);
  }

  return features.map((feature) => {
    const exact = byCode.get(feature.tractKey.trim());
    if (exact) {
      return { featureId: feature.id, tractKey: feature.tractKey, deskMapId: exact, confidence: 'exact' };
    }
    const normalized = byNormalized.get(normalizeTractCode(feature.tractKey));
    if (normalized) {
      return {
        featureId: feature.id,
        tractKey: feature.tractKey,
        deskMapId: normalized,
        confidence: 'normalized',
      };
    }
    return { featureId: feature.id, tractKey: feature.tractKey, deskMapId: null, confidence: 'none' };
  });
}

/** The ArcGIS `ExternalRef` for a tract feature (or null if it carries no id). */
export function buildArcgisExternalRef(feature: MapTractFeature): ExternalRef | null {
  return normalizeExternalRef({
    system: 'arcgis',
    externalId: feature.tractKey,
    globalId: feature.globalId,
    objectId: feature.objectId,
    layerName: 'Tracts',
    label: feature.tractKey,
  });
}

/** Whether two refs point at the same ArcGIS feature (GlobalID > ObjectID > key). */
export function sameArcgisTarget(a: ExternalRef, b: ExternalRef): boolean {
  if (a.system !== 'arcgis' || b.system !== 'arcgis') return false;
  if (a.globalId && b.globalId) return a.globalId === b.globalId;
  if (a.objectId !== undefined && b.objectId !== undefined) {
    return String(a.objectId) === String(b.objectId);
  }
  return Boolean(a.externalId) && a.externalId === b.externalId;
}

/** Replace any existing ref for the same ArcGIS target, else append (idempotent). */
export function upsertExternalRef(
  refs: readonly ExternalRef[],
  ref: ExternalRef
): ExternalRef[] {
  return [...refs.filter((existing) => !sameArcgisTarget(existing, ref)), ref];
}

/** Drop any ref pointing at the same ArcGIS target as `ref`. */
export function removeExternalRef(
  refs: readonly ExternalRef[],
  ref: ExternalRef
): ExternalRef[] {
  return refs.filter((existing) => !sameArcgisTarget(existing, ref));
}
