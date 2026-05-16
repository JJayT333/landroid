/**
 * External-system reference hook (Phase 5 ride-along).
 *
 * Lets a LANDroid record point at the same real-world object that lives
 * in another system — primarily ArcGIS (tracts, units, map features) but
 * also free-form file paths and URLs. Records carry an optional
 * `externalRefs[]` array; today nothing reads it, but future ArcGIS
 * integration work (CSV/GeoJSON export with LAND_TRACT_ID, click-through
 * popups, ArcGIS Pro add-ins) can populate and consume it without
 * another Dexie migration or `.landroid` schema bump.
 *
 * **Identity rule** — when LANDroid and ArcGIS both point at the same
 * feature, the business link is:
 *   - LANDroid side: the record's stable UUID (`docId`, `id`, etc.).
 *   - ArcGIS side: the feature's `GlobalID`.
 *   - `ObjectID` is a convenience/cache field only; it can change when a
 *     feature class is republished and must not be the sole link.
 *
 * The math layer never reads this field. Same pattern as `depthRange`:
 * schema hook today, real consumer comes later in a dedicated phase.
 */

export const EXTERNAL_REF_SYSTEMS = ['arcgis', 'file', 'url', 'other'] as const;
export type ExternalRefSystem = (typeof EXTERNAL_REF_SYSTEMS)[number];

export interface ExternalRef {
  /** Which external system this reference belongs to. */
  system: ExternalRefSystem;
  /** Free-form external identifier (system-specific). */
  externalId?: string;
  /**
   * ArcGIS feature GlobalID. The stable cross-database business link
   * on the ArcGIS side; prefer this over `objectId` for joins.
   */
  globalId?: string;
  /**
   * ArcGIS feature ObjectID. Convenience/cache only — can change when
   * a feature class is republished. Never the sole link.
   */
  objectId?: string | number;
  /** ArcGIS layer name (e.g., `"Tracts"`). */
  layerName?: string;
  /** ArcGIS layer service URL. */
  layerUrl?: string;
  /** Generic deep-link URL (for `system === 'url'` or click-through). */
  url?: string;
  /** Generic file-vault path or local path display value. */
  path?: string;
  /** Human-readable label shown in UI. */
  label?: string;
  /** ISO timestamp of last successful sync, when applicable. */
  lastSyncedAt?: string;
}

export function isExternalRefSystem(value: unknown): value is ExternalRefSystem {
  return (
    typeof value === 'string'
    && (EXTERNAL_REF_SYSTEMS as readonly string[]).includes(value)
  );
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalObjectId(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

/**
 * Coerce an arbitrary input into an `ExternalRef`, or `null` if the
 * input doesn't carry enough signal to be useful (no system, or no
 * identifier whatsoever).
 */
export function normalizeExternalRef(value: unknown): ExternalRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as {
    system?: unknown;
    externalId?: unknown;
    globalId?: unknown;
    objectId?: unknown;
    layerName?: unknown;
    layerUrl?: unknown;
    url?: unknown;
    path?: unknown;
    label?: unknown;
    lastSyncedAt?: unknown;
  };
  const system: ExternalRefSystem = isExternalRefSystem(raw.system)
    ? raw.system
    : 'other';
  const ref: ExternalRef = { system };

  const externalId = asOptionalString(raw.externalId);
  if (externalId !== undefined) ref.externalId = externalId;
  const globalId = asOptionalString(raw.globalId);
  if (globalId !== undefined) ref.globalId = globalId;
  const objectId = asOptionalObjectId(raw.objectId);
  if (objectId !== undefined) ref.objectId = objectId;
  const layerName = asOptionalString(raw.layerName);
  if (layerName !== undefined) ref.layerName = layerName;
  const layerUrl = asOptionalString(raw.layerUrl);
  if (layerUrl !== undefined) ref.layerUrl = layerUrl;
  const url = asOptionalString(raw.url);
  if (url !== undefined) ref.url = url;
  const path = asOptionalString(raw.path);
  if (path !== undefined) ref.path = path;
  const label = asOptionalString(raw.label);
  if (label !== undefined) ref.label = label;
  const lastSyncedAt = asOptionalString(raw.lastSyncedAt);
  if (lastSyncedAt !== undefined) ref.lastSyncedAt = lastSyncedAt;

  // Reject refs that carry no identifier at all — keeping them would
  // bloat records with empty placeholder objects.
  const hasIdentifier =
    ref.externalId !== undefined
    || ref.globalId !== undefined
    || ref.objectId !== undefined
    || ref.url !== undefined
    || ref.path !== undefined;
  if (!hasIdentifier) return null;

  return ref;
}

/**
 * Normalize an optional array of external refs, dropping any entry that
 * fails {@link normalizeExternalRef}. Returns `undefined` (not an empty
 * array) when the input would be empty so the field stays omittable on
 * round-trip serialization.
 */
export function normalizeExternalRefs(value: unknown): ExternalRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ExternalRef[] = [];
  for (const entry of value) {
    const normalized = normalizeExternalRef(entry);
    if (normalized) out.push(normalized);
  }
  return out.length > 0 ? out : undefined;
}
