export const RRC_DATASETS_PAGE_URL =
  'https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/';

export const RESEARCH_IMPORT_FORMAT_OPTIONS = [
  'ASCII',
  'CSV',
  'JSON',
  'TXT',
  'PDF',
  'Image/TIFF',
  'EBCDIC',
  'Shapefile/DBF',
  'ZIP',
  'Other',
] as const;

export type ResearchImportFormat =
  (typeof RESEARCH_IMPORT_FORMAT_OPTIONS)[number];

export const RRC_DATASET_CATEGORIES = [
  'Production',
  'Well / Permit',
  'GIS / Mapping',
  'Field / Regulatory',
  'Organization / Operator',
  'Tax / Incentive',
] as const;

export type RrcDatasetCategory =
  (typeof RRC_DATASET_CATEGORIES)[number];

export type RrcDecoderStatus = 'Preview Ready' | 'Structured Later' | 'Needs Decoder';

export interface RrcDatasetCatalogItem {
  id: string;
  title: string;
  category: RrcDatasetCategory;
  cadence: string;
  formats: ResearchImportFormat[];
  decoderStatus: RrcDecoderStatus;
  summary: string;
  notes: string;
  officialUrl: string;
}

export interface ResearchImport {
  id: string;
  workspaceId: string;
  datasetId: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  detectedFormat: ResearchImportFormat;
  notes: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

export function detectResearchImportFormat(
  fileName: string,
  mimeType: string
): ResearchImportFormat {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerName.endsWith('.csv') || lowerMime.includes('csv')) return 'CSV';
  if (
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.geojson') ||
    lowerMime.includes('json')
  ) {
    return 'JSON';
  }
  if (lowerName.endsWith('.txt') || lowerMime.startsWith('text/')) return 'TXT';
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) return 'PDF';
  if (
    lowerName.endsWith('.tif') ||
    lowerName.endsWith('.tiff') ||
    lowerMime.startsWith('image/')
  ) {
    return 'Image/TIFF';
  }
  if (
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.gz') ||
    lowerName.endsWith('.tar')
  ) {
    return 'ZIP';
  }
  if (
    lowerName.endsWith('.shp') ||
    lowerName.endsWith('.dbf') ||
    lowerName.endsWith('.prj') ||
    lowerName.endsWith('.shx')
  ) {
    return 'Shapefile/DBF';
  }
  if (
    lowerName.endsWith('.ebc') ||
    lowerName.endsWith('.ebcdic') ||
    lowerName.endsWith('.dat')
  ) {
    return 'EBCDIC';
  }
  if (lowerName.endsWith('.asc')) return 'ASCII';
  return 'Other';
}

export function getDecoderStatusForFormat(
  format: ResearchImportFormat
): RrcDecoderStatus {
  if (
    format === 'CSV' ||
    format === 'JSON' ||
    format === 'TXT' ||
    format === 'PDF' ||
    format === 'Image/TIFF'
  ) {
    return 'Preview Ready';
  }
  if (format === 'ASCII') return 'Structured Later';
  return 'Needs Decoder';
}

export function createBlankResearchImport(
  workspaceId: string,
  file: Blob,
  {
    fileName,
    mimeType,
    datasetId = null,
    overrides,
  }: {
    fileName: string;
    mimeType: string;
    datasetId?: string | null;
    overrides?: Partial<ResearchImport>;
  }
): ResearchImport {
  const now = nowIso();
  const researchImport: ResearchImport = {
    id:
      overrides?.id ??
      `rrc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    datasetId,
    title: fileName.replace(/\.[^.]+$/, ''),
    fileName,
    mimeType,
    detectedFormat: detectResearchImportFormat(fileName, mimeType),
    notes: '',
    blob: file,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
  researchImport.workspaceId = workspaceId;
  researchImport.fileName = overrides?.fileName ?? fileName;
  researchImport.mimeType = overrides?.mimeType ?? mimeType;
  researchImport.datasetId = overrides?.datasetId ?? datasetId;
  researchImport.detectedFormat =
    overrides?.detectedFormat ??
    detectResearchImportFormat(researchImport.fileName, researchImport.mimeType);
  researchImport.blob = overrides?.blob ?? file;
  return researchImport;
}

export function normalizeResearchImport(
  researchImport: Pick<ResearchImport, 'id'> & Partial<ResearchImport>
): ResearchImport {
  return createBlankResearchImport(
    researchImport.workspaceId ?? '',
    researchImport.blob ??
      new Blob([], {
        type: researchImport.mimeType ?? 'application/octet-stream',
      }),
    {
      fileName: researchImport.fileName ?? researchImport.title ?? researchImport.id,
      mimeType:
        researchImport.mimeType ??
        researchImport.blob?.type ??
        'application/octet-stream',
      datasetId: researchImport.datasetId ?? null,
      overrides: researchImport,
    }
  );
}
