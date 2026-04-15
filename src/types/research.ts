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

export const RESEARCH_SOURCE_TYPE_OPTIONS = [
  'Statute',
  'Case',
  'Agency Guidance',
  'Manual',
  'Map / GIS',
  'Lease Document',
  'Project Note',
  'Other',
] as const;
export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPE_OPTIONS)[number];

export const RESEARCH_CONTEXT_OPTIONS = [
  'Texas',
  'Federal / BLM',
  'Private',
  'General',
  'Other',
] as const;
export type ResearchContext = (typeof RESEARCH_CONTEXT_OPTIONS)[number];

export const RESEARCH_REVIEW_STATUS_OPTIONS = [
  'Draft',
  'Verified',
  'Needs Review',
] as const;
export type ResearchReviewStatus = (typeof RESEARCH_REVIEW_STATUS_OPTIONS)[number];

export const RESEARCH_FORMULA_CATEGORY_OPTIONS = [
  'Ownership',
  'Leasehold',
  'NPRI',
  'ORRI',
  'Federal / Private Prep',
  'Transfer Order',
  'Other',
] as const;
export type ResearchFormulaCategory =
  (typeof RESEARCH_FORMULA_CATEGORY_OPTIONS)[number];

export const RESEARCH_PROJECT_RECORD_TYPE_OPTIONS = [
  'Federal Lease',
  'Private Lease',
  'Mapped Tract',
  'Acquisition Target',
  'Unit / CA',
  'Other',
] as const;
export type ResearchProjectRecordType =
  (typeof RESEARCH_PROJECT_RECORD_TYPE_OPTIONS)[number];

export const RESEARCH_PROJECT_STATUS_OPTIONS = [
  'Current',
  'Target',
  'Under Review',
  'Closed',
  'Inactive',
] as const;
export type ResearchProjectStatus =
  (typeof RESEARCH_PROJECT_STATUS_OPTIONS)[number];

export const RESEARCH_QUESTION_STATUS_OPTIONS = [
  'Draft',
  'Answered',
  'Needs Review',
] as const;
export type ResearchQuestionStatus =
  (typeof RESEARCH_QUESTION_STATUS_OPTIONS)[number];

export interface ResearchObjectLinks {
  deskMapId: string | null;
  nodeId: string | null;
  ownerId: string | null;
  leaseId: string | null;
  mapAssetId: string | null;
  mapRegionId: string | null;
  importId: string | null;
}

export interface ResearchSource {
  id: string;
  workspaceId: string;
  title: string;
  sourceType: ResearchSourceType;
  context: ResearchContext;
  status: ResearchReviewStatus;
  citation: string;
  url: string;
  notes: string;
  links: ResearchObjectLinks;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFormula {
  id: string;
  workspaceId: string;
  title: string;
  category: ResearchFormulaCategory;
  status: ResearchReviewStatus;
  formulaText: string;
  explanation: string;
  variables: string;
  example: string;
  engineReference: string;
  sourceIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProjectRecord {
  id: string;
  workspaceId: string;
  recordType: ResearchProjectRecordType;
  jurisdiction: ResearchContext;
  status: ResearchProjectStatus;
  acquisitionStatus: string;
  name: string;
  serialOrReference: string;
  legacySerial: string;
  mlrsSerial: string;
  lesseeOrApplicant: string;
  operator: string;
  state: string;
  county: string;
  prospectArea: string;
  effectiveDate: string;
  expirationDate: string;
  primaryTerm: string;
  nextAction: string;
  nextActionDate: string;
  priority: string;
  sourcePacketStatus: string;
  acres: string;
  legalDescription: string;
  sourceIds: string[];
  mapAssetId: string | null;
  mapRegionId: string | null;
  deskMapId: string | null;
  nodeId: string | null;
  ownerId: string | null;
  leaseId: string | null;
  importId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchQuestion {
  id: string;
  workspaceId: string;
  question: string;
  answer: string;
  status: ResearchQuestionStatus;
  sourceIds: string[];
  formulaIds: string[];
  projectRecordIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

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

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableId(value: unknown): string | null {
  const text = asString(value);
  return text.length > 0 ? text : null;
}

function normalizeOption<T extends readonly string[]>(
  options: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? value
    : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(asString).filter(Boolean))]
    : [];
}

export function createBlankResearchLinks(
  overrides: Partial<ResearchObjectLinks> = {}
): ResearchObjectLinks {
  return {
    deskMapId: null,
    nodeId: null,
    ownerId: null,
    leaseId: null,
    mapAssetId: null,
    mapRegionId: null,
    importId: null,
    ...overrides,
  };
}

export function normalizeResearchLinks(value: unknown): ResearchObjectLinks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankResearchLinks();
  }
  const record = value as Partial<Record<keyof ResearchObjectLinks, unknown>>;
  return createBlankResearchLinks({
    deskMapId: asNullableId(record.deskMapId),
    nodeId: asNullableId(record.nodeId),
    ownerId: asNullableId(record.ownerId),
    leaseId: asNullableId(record.leaseId),
    mapAssetId: asNullableId(record.mapAssetId),
    mapRegionId: asNullableId(record.mapRegionId),
    importId: asNullableId(record.importId),
  });
}

export function createBlankResearchSource(
  workspaceId: string,
  overrides: Partial<ResearchSource> = {}
): ResearchSource {
  const now = nowIso();
  const source: ResearchSource = {
    id: overrides.id ?? `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    title: '',
    sourceType: 'Project Note',
    context: 'General',
    status: 'Draft',
    citation: '',
    url: '',
    notes: '',
    links: createBlankResearchLinks(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  source.workspaceId = workspaceId;
  source.sourceType = normalizeOption(
    RESEARCH_SOURCE_TYPE_OPTIONS,
    source.sourceType,
    'Project Note'
  );
  source.context = normalizeOption(RESEARCH_CONTEXT_OPTIONS, source.context, 'General');
  source.status = normalizeOption(
    RESEARCH_REVIEW_STATUS_OPTIONS,
    source.status,
    'Draft'
  );
  source.links = normalizeResearchLinks(source.links);
  return source;
}

export function normalizeResearchSource(
  source: Pick<ResearchSource, 'id'> & Partial<ResearchSource>
): ResearchSource {
  return createBlankResearchSource(source.workspaceId ?? '', {
    ...source,
    title: asString(source.title),
    citation: asString(source.citation),
    url: asString(source.url),
    notes: typeof source.notes === 'string' ? source.notes : '',
    links: normalizeResearchLinks(source.links),
  });
}

export function createBlankResearchFormula(
  workspaceId: string,
  overrides: Partial<ResearchFormula> = {}
): ResearchFormula {
  const now = nowIso();
  const formula: ResearchFormula = {
    id: overrides.id ?? `formula-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    title: '',
    category: 'Ownership',
    status: 'Draft',
    formulaText: '',
    explanation: '',
    variables: '',
    example: '',
    engineReference: '',
    sourceIds: [],
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  formula.workspaceId = workspaceId;
  formula.category = normalizeOption(
    RESEARCH_FORMULA_CATEGORY_OPTIONS,
    formula.category,
    'Ownership'
  );
  formula.status = normalizeOption(
    RESEARCH_REVIEW_STATUS_OPTIONS,
    formula.status,
    'Draft'
  );
  formula.sourceIds = normalizeStringArray(formula.sourceIds);
  return formula;
}

export function normalizeResearchFormula(
  formula: Pick<ResearchFormula, 'id'> & Partial<ResearchFormula>
): ResearchFormula {
  return createBlankResearchFormula(formula.workspaceId ?? '', {
    ...formula,
    title: asString(formula.title),
    formulaText: typeof formula.formulaText === 'string' ? formula.formulaText : '',
    explanation: typeof formula.explanation === 'string' ? formula.explanation : '',
    variables: typeof formula.variables === 'string' ? formula.variables : '',
    example: typeof formula.example === 'string' ? formula.example : '',
    engineReference:
      typeof formula.engineReference === 'string' ? formula.engineReference : '',
    sourceIds: normalizeStringArray(formula.sourceIds),
    notes: typeof formula.notes === 'string' ? formula.notes : '',
  });
}

export function createBlankResearchProjectRecord(
  workspaceId: string,
  overrides: Partial<ResearchProjectRecord> = {}
): ResearchProjectRecord {
  const now = nowIso();
  const projectRecord: ResearchProjectRecord = {
    id: overrides.id ?? `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    recordType: 'Federal Lease',
    jurisdiction: 'Federal / BLM',
    status: 'Under Review',
    acquisitionStatus: '',
    name: '',
    serialOrReference: '',
    legacySerial: '',
    mlrsSerial: '',
    lesseeOrApplicant: '',
    operator: '',
    state: '',
    county: '',
    prospectArea: '',
    effectiveDate: '',
    expirationDate: '',
    primaryTerm: '',
    nextAction: '',
    nextActionDate: '',
    priority: '',
    sourcePacketStatus: '',
    acres: '',
    legalDescription: '',
    sourceIds: [],
    mapAssetId: null,
    mapRegionId: null,
    deskMapId: null,
    nodeId: null,
    ownerId: null,
    leaseId: null,
    importId: null,
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  projectRecord.workspaceId = workspaceId;
  projectRecord.recordType = normalizeOption(
    RESEARCH_PROJECT_RECORD_TYPE_OPTIONS,
    projectRecord.recordType,
    'Federal Lease'
  );
  projectRecord.jurisdiction = normalizeOption(
    RESEARCH_CONTEXT_OPTIONS,
    projectRecord.jurisdiction,
    'Federal / BLM'
  );
  projectRecord.status = normalizeOption(
    RESEARCH_PROJECT_STATUS_OPTIONS,
    projectRecord.status,
    'Under Review'
  );
  projectRecord.sourceIds = normalizeStringArray(projectRecord.sourceIds);
  projectRecord.mapAssetId = asNullableId(projectRecord.mapAssetId);
  projectRecord.mapRegionId = asNullableId(projectRecord.mapRegionId);
  return projectRecord;
}

export function normalizeResearchProjectRecord(
  projectRecord: Pick<ResearchProjectRecord, 'id'> & Partial<ResearchProjectRecord>
): ResearchProjectRecord {
  return createBlankResearchProjectRecord(projectRecord.workspaceId ?? '', {
    ...projectRecord,
    acquisitionStatus:
      typeof projectRecord.acquisitionStatus === 'string'
        ? projectRecord.acquisitionStatus
        : '',
    name: asString(projectRecord.name),
    serialOrReference: asString(projectRecord.serialOrReference),
    legacySerial: asString(projectRecord.legacySerial),
    mlrsSerial: asString(projectRecord.mlrsSerial),
    lesseeOrApplicant:
      typeof projectRecord.lesseeOrApplicant === 'string'
        ? projectRecord.lesseeOrApplicant
        : '',
    operator: typeof projectRecord.operator === 'string' ? projectRecord.operator : '',
    state: asString(projectRecord.state),
    county: asString(projectRecord.county),
    prospectArea: asString(projectRecord.prospectArea),
    effectiveDate: asString(projectRecord.effectiveDate),
    expirationDate: asString(projectRecord.expirationDate),
    primaryTerm: asString(projectRecord.primaryTerm),
    nextAction:
      typeof projectRecord.nextAction === 'string' ? projectRecord.nextAction : '',
    nextActionDate: asString(projectRecord.nextActionDate),
    priority: asString(projectRecord.priority),
    sourcePacketStatus: asString(projectRecord.sourcePacketStatus),
    acres: asString(projectRecord.acres),
    legalDescription:
      typeof projectRecord.legalDescription === 'string'
        ? projectRecord.legalDescription
        : '',
    sourceIds: normalizeStringArray(projectRecord.sourceIds),
    mapAssetId: asNullableId(projectRecord.mapAssetId),
    mapRegionId: asNullableId(projectRecord.mapRegionId),
    deskMapId: asNullableId(projectRecord.deskMapId),
    nodeId: asNullableId(projectRecord.nodeId),
    ownerId: asNullableId(projectRecord.ownerId),
    leaseId: asNullableId(projectRecord.leaseId),
    importId: asNullableId(projectRecord.importId),
    notes: typeof projectRecord.notes === 'string' ? projectRecord.notes : '',
  });
}

export function createBlankResearchQuestion(
  workspaceId: string,
  overrides: Partial<ResearchQuestion> = {}
): ResearchQuestion {
  const now = nowIso();
  const question: ResearchQuestion = {
    id: overrides.id ?? `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    question: '',
    answer: '',
    status: 'Draft',
    sourceIds: [],
    formulaIds: [],
    projectRecordIds: [],
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  question.workspaceId = workspaceId;
  question.status = normalizeOption(
    RESEARCH_QUESTION_STATUS_OPTIONS,
    question.status,
    'Draft'
  );
  question.sourceIds = normalizeStringArray(question.sourceIds);
  question.formulaIds = normalizeStringArray(question.formulaIds);
  question.projectRecordIds = normalizeStringArray(question.projectRecordIds);
  return question;
}

export function normalizeResearchQuestion(
  question: Pick<ResearchQuestion, 'id'> & Partial<ResearchQuestion>
): ResearchQuestion {
  return createBlankResearchQuestion(question.workspaceId ?? '', {
    ...question,
    question: typeof question.question === 'string' ? question.question : '',
    answer: typeof question.answer === 'string' ? question.answer : '',
    sourceIds: normalizeStringArray(question.sourceIds),
    formulaIds: normalizeStringArray(question.formulaIds),
    projectRecordIds: normalizeStringArray(question.projectRecordIds),
    notes: typeof question.notes === 'string' ? question.notes : '',
  });
}

export interface ResearchLinkValidity {
  deskMapIds?: Set<string>;
  nodeIds?: Set<string>;
  ownerIds?: Set<string>;
  leaseIds?: Set<string>;
  mapAssetIds?: Set<string>;
  mapRegionIds?: Set<string>;
  importIds?: Set<string>;
  sourceIds?: Set<string>;
  formulaIds?: Set<string>;
  projectRecordIds?: Set<string>;
}

function keepValidId(value: string | null, validIds: Set<string> | undefined): string | null {
  return value && (!validIds || validIds.has(value)) ? value : null;
}

function keepValidIds(values: string[], validIds: Set<string> | undefined): string[] {
  return validIds ? values.filter((value) => validIds.has(value)) : values;
}

export function sanitizeResearchLinks(
  data: {
    sources: ResearchSource[];
    formulas: ResearchFormula[];
    projectRecords: ResearchProjectRecord[];
    questions: ResearchQuestion[];
  },
  validity: ResearchLinkValidity
) {
  return {
    sources: data.sources.map((source) => ({
      ...source,
      links: {
        deskMapId: keepValidId(source.links.deskMapId, validity.deskMapIds),
        nodeId: keepValidId(source.links.nodeId, validity.nodeIds),
        ownerId: keepValidId(source.links.ownerId, validity.ownerIds),
        leaseId: keepValidId(source.links.leaseId, validity.leaseIds),
        mapAssetId: keepValidId(source.links.mapAssetId, validity.mapAssetIds),
        mapRegionId: keepValidId(source.links.mapRegionId, validity.mapRegionIds),
        importId: keepValidId(source.links.importId, validity.importIds),
      },
    })),
    formulas: data.formulas.map((formula) => ({
      ...formula,
      sourceIds: keepValidIds(formula.sourceIds, validity.sourceIds),
    })),
    projectRecords: data.projectRecords.map((projectRecord) => ({
      ...projectRecord,
      sourceIds: keepValidIds(projectRecord.sourceIds, validity.sourceIds),
      mapAssetId: keepValidId(projectRecord.mapAssetId, validity.mapAssetIds),
      mapRegionId: keepValidId(projectRecord.mapRegionId, validity.mapRegionIds),
      deskMapId: keepValidId(projectRecord.deskMapId, validity.deskMapIds),
      nodeId: keepValidId(projectRecord.nodeId, validity.nodeIds),
      ownerId: keepValidId(projectRecord.ownerId, validity.ownerIds),
      leaseId: keepValidId(projectRecord.leaseId, validity.leaseIds),
      importId: keepValidId(projectRecord.importId, validity.importIds),
    })),
    questions: data.questions.map((question) => ({
      ...question,
      sourceIds: keepValidIds(question.sourceIds, validity.sourceIds),
      formulaIds: keepValidIds(question.formulaIds, validity.formulaIds),
      projectRecordIds: keepValidIds(
        question.projectRecordIds,
        validity.projectRecordIds
      ),
    })),
  };
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
    normalizeOption(
      RESEARCH_IMPORT_FORMAT_OPTIONS,
      overrides?.detectedFormat,
      detectResearchImportFormat(researchImport.fileName, researchImport.mimeType)
    );
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
      overrides: {
        ...researchImport,
        title: asString(researchImport.title),
        notes: typeof researchImport.notes === 'string' ? researchImport.notes : '',
      },
    }
  );
}
