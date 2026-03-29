export const MAP_ASSET_KIND_OPTIONS = [
  'Map',
  'Plat',
  'Exhibit',
  'Image',
  'GeoJSON',
  'Other',
] as const;

export type MapAssetKind = (typeof MAP_ASSET_KIND_OPTIONS)[number];

export interface MapAsset {
  id: string;
  workspaceId: string;
  title: string;
  kind: MapAssetKind;
  fileName: string;
  mimeType: string;
  notes: string;
  deskMapId: string | null;
  nodeId: string | null;
  linkedOwnerId: string | null;
  leaseId: string | null;
  county: string;
  prospect: string;
  effectiveDate: string;
  source: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
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
    deskMapId: null,
    nodeId: null,
    linkedOwnerId: null,
    leaseId: null,
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
  return asset;
}
