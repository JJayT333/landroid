export const MAP_ASSET_KIND_OPTIONS = [
  'Map',
  'Plat',
  'Exhibit',
  'Image',
  'GeoJSON',
  'Other',
] as const;

export type MapAssetKind = (typeof MAP_ASSET_KIND_OPTIONS)[number];

export const MAP_REGION_STATUS_OPTIONS = [
  'Idea',
  'Open',
  'Active',
  'Leased',
  'Follow-up',
  'Closed',
] as const;

export type MapRegionStatus = (typeof MAP_REGION_STATUS_OPTIONS)[number];

export const MAP_REFERENCE_SOURCE_OPTIONS = [
  'Manual',
  'RRC GIS Viewer',
  'RRC Research',
  'RRC Download',
] as const;

export type MapReferenceSource = (typeof MAP_REFERENCE_SOURCE_OPTIONS)[number];

const MAP_REFERENCE_SOURCE_SET = new Set<string>(MAP_REFERENCE_SOURCE_OPTIONS);
const ALLOWED_MAP_REFERENCE_PROTOCOLS = new Set(['http:', 'https:']);

export interface MapAsset {
  id: string;
  workspaceId: string;
  title: string;
  kind: MapAssetKind;
  fileName: string;
  mimeType: string;
  notes: string;
  presentationSummary: string;
  isFeatured: boolean;
  deskMapId: string | null;
  nodeId: string | null;
  linkedOwnerId: string | null;
  leaseId: string | null;
  researchSourceId: string | null;
  researchProjectRecordId: string | null;
  county: string;
  prospect: string;
  effectiveDate: string;
  source: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedMapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface MapRegion {
  id: string;
  workspaceId: string;
  assetId: string;
  title: string;
  shortLabel: string;
  status: MapRegionStatus;
  summary: string;
  notes: string;
  acreage: string;
  color: string;
  geometryKind: 'rect';
  rect: NormalizedMapRect;
  deskMapId: string | null;
  nodeId: string | null;
  linkedOwnerId: string | null;
  leaseId: string | null;
  researchSourceId: string | null;
  researchProjectRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapExternalReference {
  id: string;
  workspaceId: string;
  assetId: string | null;
  regionId: string | null;
  source: MapReferenceSource;
  label: string;
  url: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMapReferenceText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function coerceNullableId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function normalizeMapReferenceSource(value: unknown): MapReferenceSource {
  return MAP_REFERENCE_SOURCE_SET.has(String(value))
    ? (value as MapReferenceSource)
    : 'Manual';
}

export function normalizeMapReferenceUrl(value: unknown): string {
  const trimmed = normalizeMapReferenceText(value);
  if (!trimmed) return '';

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!ALLOWED_MAP_REFERENCE_PROTOCOLS.has(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function getMapReferenceUrlValidationMessage(value: string): string | null {
  const trimmed = normalizeMapReferenceText(value);
  if (!trimmed) return null;
  return normalizeMapReferenceUrl(trimmed)
    ? null
    : 'Use a valid http:// or https:// link. Unsupported schemes are blocked.';
}

export function inferMapKind(fileName: string, mimeType: string): MapAssetKind {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (
    lowerMime.includes('json') ||
    lowerName.endsWith('.geojson') ||
    lowerName.endsWith('.json')
  ) {
    return 'GeoJSON';
  }
  if (lowerMime.startsWith('image/')) {
    return 'Image';
  }
  if (lowerName.includes('plat')) {
    return 'Plat';
  }
  if (lowerName.includes('exhibit')) {
    return 'Exhibit';
  }
  if (lowerMime.includes('pdf')) {
    return 'Map';
  }
  return 'Other';
}

export function createBlankMapAsset(
  workspaceId: string,
  file: Blob,
  {
    fileName,
    mimeType,
    overrides,
  }: {
    fileName: string;
    mimeType: string;
    overrides?: Partial<MapAsset>;
  }
): MapAsset {
  const now = nowIso();
  const asset: MapAsset = {
    id: overrides?.id ?? `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    title: fileName.replace(/\.[^.]+$/, ''),
    kind: inferMapKind(fileName, mimeType),
    fileName,
    mimeType,
    notes: '',
    presentationSummary: '',
    isFeatured: false,
    deskMapId: null,
    nodeId: null,
    linkedOwnerId: null,
    leaseId: null,
    researchSourceId: null,
    researchProjectRecordId: null,
    county: '',
    prospect: '',
    effectiveDate: '',
    source: '',
    blob: file,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
  asset.workspaceId = workspaceId;
  asset.fileName = overrides?.fileName ?? fileName;
  asset.mimeType = overrides?.mimeType ?? mimeType;
  asset.blob = overrides?.blob ?? file;
  asset.presentationSummary = overrides?.presentationSummary ?? asset.presentationSummary;
  asset.isFeatured = overrides?.isFeatured ?? asset.isFeatured;
  return asset;
}

export function createBlankMapRegion(
  workspaceId: string,
  assetId: string,
  overrides: Partial<MapRegion> = {}
): MapRegion {
  const now = nowIso();
  const region: MapRegion = {
    id: overrides.id ?? `region-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    assetId,
    title: 'New Region',
    shortLabel: '',
    status: 'Idea',
    summary: '',
    notes: '',
    acreage: '',
    color: '#9f6a2d',
    geometryKind: 'rect',
    rect: {
      x: 0.2,
      y: 0.2,
      width: 0.2,
      height: 0.2,
      page: 0,
    },
    deskMapId: null,
    nodeId: null,
    linkedOwnerId: null,
    leaseId: null,
    researchSourceId: null,
    researchProjectRecordId: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  region.workspaceId = workspaceId;
  region.assetId = assetId;
  return region;
}

export function createBlankMapExternalReference(
  workspaceId: string,
  overrides: Partial<MapExternalReference> = {}
): MapExternalReference {
  const now = nowIso();
  const reference: MapExternalReference = {
    id: overrides.id ?? `mref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    assetId: null,
    regionId: null,
    source: 'Manual',
    label: '',
    url: '',
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  reference.workspaceId = workspaceId;
  return reference;
}

export function normalizeMapAsset(
  asset: Pick<MapAsset, 'id'> & Partial<MapAsset>
): MapAsset {
  const normalized = createBlankMapAsset(
    asset.workspaceId ?? '',
    asset.blob ?? new Blob([], { type: asset.mimeType ?? 'application/octet-stream' }),
    {
      fileName: asset.fileName ?? asset.title ?? asset.id,
      mimeType: asset.mimeType ?? asset.blob?.type ?? 'application/octet-stream',
      overrides: asset,
    }
  );
  normalized.presentationSummary = asset.presentationSummary ?? '';
  normalized.isFeatured = asset.isFeatured ?? false;
  normalized.researchSourceId = coerceNullableId(asset.researchSourceId);
  normalized.researchProjectRecordId = coerceNullableId(
    asset.researchProjectRecordId
  );
  return normalized;
}

export function normalizeMapRegion(
  region: Pick<MapRegion, 'id'> & Partial<MapRegion>
): MapRegion {
  const normalized = createBlankMapRegion(
    region.workspaceId ?? '',
    region.assetId ?? '',
    region
  );
  normalized.rect = {
    x: clampPercent(region.rect?.x ?? normalized.rect.x),
    y: clampPercent(region.rect?.y ?? normalized.rect.y),
    width: clampPercent(region.rect?.width ?? normalized.rect.width),
    height: clampPercent(region.rect?.height ?? normalized.rect.height),
    page: Math.max(0, Math.floor(region.rect?.page ?? normalized.rect.page)),
  };
  normalized.researchSourceId = coerceNullableId(region.researchSourceId);
  normalized.researchProjectRecordId = coerceNullableId(
    region.researchProjectRecordId
  );
  return normalized;
}

export function normalizeMapExternalReference(
  reference: Pick<MapExternalReference, 'id'> & Partial<MapExternalReference>
): MapExternalReference {
  return createBlankMapExternalReference(
    typeof reference.workspaceId === 'string' ? reference.workspaceId : '',
    {
      id: reference.id,
      workspaceId:
        typeof reference.workspaceId === 'string' ? reference.workspaceId : '',
      assetId: coerceNullableId(reference.assetId),
      regionId: coerceNullableId(reference.regionId),
      source: normalizeMapReferenceSource(reference.source),
      label: normalizeMapReferenceText(reference.label),
      url: normalizeMapReferenceUrl(reference.url),
      notes: typeof reference.notes === 'string' ? reference.notes : '',
      createdAt:
        typeof reference.createdAt === 'string' ? reference.createdAt : undefined,
      updatedAt:
        typeof reference.updatedAt === 'string' ? reference.updatedAt : undefined,
    }
  );
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
