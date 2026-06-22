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
import { featureAcres } from './tract-area';

export type TractMatchConfidence = 'exact' | 'normalized' | 'acreage' | 'none';

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

/** First positive number in a free-text acreage string, e.g. "106.19 ac" → 106.19. */
function parseAcreage(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const acres = parseFloat(match[0]);
  return Number.isFinite(acres) && acres > 0 ? acres : null;
}

/**
 * How far a feature's acreage may sit from a DeskMap's and still be a candidate.
 * Generous on purpose — interior splits move acreage and the result is a human-
 * confirmed SUGGESTION, never a silent link — with the greedy one-to-one
 * assignment below preventing a near-sized neighbor from stealing a tract.
 */
function acreageTolerance(deskMapAcres: number): number {
  return Math.max(3, 0.2 * deskMapAcres);
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

  // Pass 1 — code match (exact, then normalized). The DeskMaps these claim are
  // off the table for the acreage pass so a fuzzy match can't override a code.
  const results = new Map<string, TractMatchSuggestion>();
  const usedDeskMapIds = new Set<string>();
  for (const feature of features) {
    const exact = byCode.get(feature.tractKey.trim());
    const deskMapId = exact ?? byNormalized.get(normalizeTractCode(feature.tractKey)) ?? null;
    const confidence: TractMatchConfidence = exact
      ? 'exact'
      : deskMapId
        ? 'normalized'
        : 'none';
    if (deskMapId) usedDeskMapIds.add(deskMapId);
    results.set(feature.id, {
      featureId: feature.id,
      tractKey: feature.tractKey,
      deskMapId,
      confidence,
    });
  }

  // Pass 2 — acreage crosswalk for renumbered exports whose Tract keys don't
  // equal the DeskMap codes. Greedy nearest-acreage, one feature to one DeskMap,
  // smallest distance first, within tolerance. Greedy (not an optimal-assignment
  // solver) is deliberate: the result is a human-confirmed suggestion, and on
  // real exports it pairs the unit tracts and leaves near-sized neighbors out.
  const availableDeskMaps = deskMaps
    .filter((deskMap) => !usedDeskMapIds.has(deskMap.id))
    .map((deskMap) => ({ id: deskMap.id, acres: parseAcreage(deskMap.grossAcres) }))
    .filter((deskMap): deskMap is { id: string; acres: number } => deskMap.acres !== null);

  if (availableDeskMaps.length > 0) {
    const unmatched = features
      .filter((feature) => results.get(feature.id)?.deskMapId == null)
      .map((feature) => ({ id: feature.id, acres: featureAcres(feature) }))
      .filter((feature): feature is { id: string; acres: number } => feature.acres !== null);

    const pairs: Array<{ featureId: string; deskMapId: string; dist: number }> = [];
    for (const feature of unmatched) {
      for (const deskMap of availableDeskMaps) {
        const dist = Math.abs(deskMap.acres - feature.acres);
        if (dist <= acreageTolerance(deskMap.acres)) {
          pairs.push({ featureId: feature.id, deskMapId: deskMap.id, dist });
        }
      }
    }
    // Smallest distance first; explicit id tie-breakers make the assignment
    // deterministic regardless of engine sort stability or input ordering.
    pairs.sort(
      (a, b) =>
        a.dist - b.dist
        || a.featureId.localeCompare(b.featureId)
        || a.deskMapId.localeCompare(b.deskMapId)
    );

    const claimedFeatures = new Set<string>();
    const claimedDeskMaps = new Set<string>(usedDeskMapIds);
    for (const pair of pairs) {
      if (claimedFeatures.has(pair.featureId) || claimedDeskMaps.has(pair.deskMapId)) continue;
      claimedFeatures.add(pair.featureId);
      claimedDeskMaps.add(pair.deskMapId);
      const suggestion = results.get(pair.featureId);
      if (suggestion) {
        suggestion.deskMapId = pair.deskMapId;
        suggestion.confidence = 'acreage';
      }
    }
  }

  return features.map((feature) => results.get(feature.id) as TractMatchSuggestion);
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
