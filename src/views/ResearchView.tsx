import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AssetPreviewModal from '../components/modals/AssetPreviewModal';
import DrillingPermitMasterDecoderPanel from '../components/research/DrillingPermitMasterDecoderPanel';
import HorizontalDrillingDecoderPanel from '../components/research/HorizontalDrillingDecoderPanel';
import PendingDrillingDecoderPanel from '../components/research/PendingDrillingDecoderPanel';
import RrcDelimitedPreviewTable from '../components/research/RrcDelimitedPreviewTable';
import FormField from '../components/shared/FormField';
import { RRC_DATASET_CATALOG } from '../data/rrc-datasets';
import { buildRrcDelimitedTextPreview } from '../research/rrc-delimited-text';
import {
  DRILLING_PERMIT_MASTER_DATASET_IDS,
  decodeDrillingPermitMasterImports,
  type DrillingPermitMasterDecodeResult,
} from '../research/rrc-drilling-permit-master';
import {
  HORIZONTAL_DRILLING_DATASET_ID,
  decodeHorizontalDrillingImports,
  type HorizontalDrillingDecodeResult,
} from '../research/rrc-horizontal-drilling';
import {
  buildResearchImportFileFingerprint,
  createResearchImportMetadataDraft,
  researchImportMetadataDraftIsDirty,
} from '../research/research-import-metadata';
import { buildResearchFormulaStarterRecords } from '../research/formula-starters';
import {
  PENDING_DRILLING_FILE_SPECS,
  PENDING_DRILLING_DATASET_ID,
  decodePendingDrillingImports,
  detectPendingDrillingFileKind,
  type PendingDrillingDecodeResult,
} from '../research/rrc-pending-drilling';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  RESEARCH_CONTEXT_OPTIONS,
  RESEARCH_FORMULA_CATEGORY_OPTIONS,
  RESEARCH_PROJECT_RECORD_TYPE_OPTIONS,
  RESEARCH_PROJECT_STATUS_OPTIONS,
  RESEARCH_QUESTION_STATUS_OPTIONS,
  RESEARCH_REVIEW_STATUS_OPTIONS,
  RESEARCH_SOURCE_TYPE_OPTIONS,
  RRC_DATASET_CATEGORIES,
  RRC_DATASETS_PAGE_URL,
  createBlankResearchFormula,
  createBlankResearchImport,
  createBlankResearchProjectRecord,
  createBlankResearchQuestion,
  createBlankResearchSource,
  getDecoderStatusForFormat,
  type ResearchContext,
  type ResearchFormula,
  type ResearchFormulaCategory,
  type ResearchImportFormat,
  type ResearchProjectRecord,
  type ResearchProjectRecordType,
  type ResearchProjectStatus,
  type ResearchQuestion,
  type ResearchQuestionStatus,
  type ResearchReviewStatus,
  type ResearchSource,
  type ResearchSourceType,
} from '../types/research';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isTextPreviewFormat(format: ResearchImportFormat) {
  return format === 'TXT' || format === 'ASCII';
}

function matchesSearch(search: string, values: Array<string | null | undefined>) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

function matchesFilter<T extends string>(filter: T | 'All', value: T) {
  return filter === 'All' || filter === value;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((candidate) => candidate !== id)
    : [...ids, id];
}

function labelForSource(source: ResearchSource) {
  return source.title || source.citation || source.id;
}

function labelForFormula(formula: ResearchFormula) {
  return formula.title || formula.formulaText || formula.id;
}

function labelForProjectRecord(record: ResearchProjectRecord) {
  return (
    record.name ||
    record.mlrsSerial ||
    record.legacySerial ||
    record.serialOrReference ||
    record.id
  );
}

function labelForQuestion(question: ResearchQuestion) {
  return question.question || question.id;
}

function mapFromOptions(options: Array<{ id: string; label: string }>) {
  return new Map(options.map((option) => [option.id, option.label]));
}

function labelFromMap(
  labels: Map<string, string>,
  id: string | null | undefined
): string {
  return id ? labels.get(id) ?? id : '';
}

function labelsFromIds(labels: Map<string, string>, ids: string[]): string[] {
  return ids.map((id) => labels.get(id) ?? id);
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function NullableSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ id: string; label: string }>;
  emptyLabel: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  rows = 4,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
      />
    </div>
  );
}

function LinkCheckboxes({
  title,
  ids,
  options,
  onChange,
}: {
  title: string;
  ids: string[];
  options: Array<{ id: string; label: string }>;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
        {title}
      </div>
      {options.length === 0 ? (
        <div className="text-sm text-ink-light">No records available yet.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ids.includes(option.id)}
                onChange={() => onChange(toggleId(ids, option.id))}
                className="h-4 w-4 rounded border-ledger-line text-leather focus:ring-leather"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type ResearchSection =
  | 'home'
  | 'sources'
  | 'formulas'
  | 'projects'
  | 'questions'
  | 'imports';
type DatasetCategoryFilter =
  | (typeof RRC_DATASET_CATEGORIES)[number]
  | 'All';

const RESEARCH_SECTIONS: Array<{
  id: ResearchSection;
  label: string;
  description: string;
}> = [
  {
    id: 'home',
    label: 'Home',
    description: 'Research overview, review queue, and cross-library search.',
  },
  {
    id: 'sources',
    label: 'Sources',
    description: 'Statutes, cases, agency pages, files, notes, and map evidence.',
  },
  {
    id: 'formulas',
    label: 'Formulas',
    description: 'Landman-readable math cards tied to sources and engine references.',
  },
  {
    id: 'projects',
    label: 'Project Records',
    description: 'Federal/private lease, tract, acquisition, and map-linked records.',
  },
  {
    id: 'questions',
    label: 'Questions',
    description: 'Saved research questions and cited answers for later AI grounding.',
  },
  {
    id: 'imports',
    label: 'Data Imports',
    description: 'Advanced RRC import staging and decoder proof-of-concept.',
  },
];

const CATEGORY_OPTIONS: DatasetCategoryFilter[] = [
  'All',
  ...RRC_DATASET_CATEGORIES,
];

export default function ResearchView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceId = useResearchStore((state) => state.workspaceId);
  const imports = useResearchStore((state) => state.imports);
  const sources = useResearchStore((state) => state.sources);
  const formulas = useResearchStore((state) => state.formulas);
  const projectRecords = useResearchStore((state) => state.projectRecords);
  const questions = useResearchStore((state) => state.questions);
  const addImport = useResearchStore((state) => state.addImport);
  const updateImport = useResearchStore((state) => state.updateImport);
  const removeImport = useResearchStore((state) => state.removeImport);
  const addSource = useResearchStore((state) => state.addSource);
  const updateSource = useResearchStore((state) => state.updateSource);
  const removeSource = useResearchStore((state) => state.removeSource);
  const addFormula = useResearchStore((state) => state.addFormula);
  const updateFormula = useResearchStore((state) => state.updateFormula);
  const removeFormula = useResearchStore((state) => state.removeFormula);
  const addProjectRecord = useResearchStore((state) => state.addProjectRecord);
  const updateProjectRecord = useResearchStore((state) => state.updateProjectRecord);
  const removeProjectRecord = useResearchStore((state) => state.removeProjectRecord);
  const addQuestion = useResearchStore((state) => state.addQuestion);
  const updateQuestion = useResearchStore((state) => state.updateQuestion);
  const removeQuestion = useResearchStore((state) => state.removeQuestion);

  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const mapAssets = useMapStore((state) => state.mapAssets);
  const mapRegions = useMapStore((state) => state.mapRegions);

  const [section, setSection] = useState<ResearchSection>('home');
  const [search, setSearch] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<
    ResearchSourceType | 'All'
  >('All');
  const [sourceContextFilter, setSourceContextFilter] = useState<
    ResearchContext | 'All'
  >('All');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<
    ResearchReviewStatus | 'All'
  >('All');
  const [formulaCategoryFilter, setFormulaCategoryFilter] = useState<
    ResearchFormulaCategory | 'All'
  >('All');
  const [formulaStatusFilter, setFormulaStatusFilter] = useState<
    ResearchReviewStatus | 'All'
  >('All');
  const [projectTypeFilter, setProjectTypeFilter] = useState<
    ResearchProjectRecordType | 'All'
  >('All');
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    ResearchProjectStatus | 'All'
  >('All');
  const [questionStatusFilter, setQuestionStatusFilter] = useState<
    ResearchQuestionStatus | 'All'
  >('All');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [category, setCategory] = useState<DatasetCategoryFilter>('All');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    RRC_DATASET_CATALOG[0]?.id ?? null
  );
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [previewImportId, setPreviewImportId] = useState<string | null>(null);
  const [pendingDecodeState, setPendingDecodeState] = useState<{
    decoded: PendingDrillingDecodeResult | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({ decoded: null, isLoading: false, errorMessage: null });
  const [drillingPermitMasterDecodeState, setDrillingPermitMasterDecodeState] =
    useState<{
      decoded: DrillingPermitMasterDecodeResult | null;
      isLoading: boolean;
      errorMessage: string | null;
    }>({ decoded: null, isLoading: false, errorMessage: null });
  const [horizontalDrillingDecodeState, setHorizontalDrillingDecodeState] =
    useState<{
      decoded: HorizontalDrillingDecodeResult | null;
      isLoading: boolean;
      errorMessage: string | null;
    }>({ decoded: null, isLoading: false, errorMessage: null });
  const [selectedTextPreviewState, setSelectedTextPreviewState] = useState<{
    preview: ReturnType<typeof buildRrcDelimitedTextPreview> | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({ preview: null, isLoading: false, errorMessage: null });
  const [importMetadataDraft, setImportMetadataDraft] = useState<ReturnType<
    typeof createResearchImportMetadataDraft
  > | null>(null);
  const [importMetadataSaveError, setImportMetadataSaveError] = useState<string | null>(null);
  const [isSavingImportMetadata, setIsSavingImportMetadata] = useState(false);
  const pendingDatasetJumpRef = useRef<{ importId: string; datasetId: string } | null>(null);
  const lastPendingDecodeFingerprintRef = useRef<string | null>(null);
  const lastDrillingPermitMasterDecodeFingerprintRef = useRef<string | null>(null);
  const lastHorizontalDrillingDecodeFingerprintRef = useRef<string | null>(null);

  const sourceOptions = sources.map((source) => ({
    id: source.id,
    label: labelForSource(source),
  }));
  const formulaOptions = formulas.map((formula) => ({
    id: formula.id,
    label: labelForFormula(formula),
  }));
  const projectOptions = projectRecords.map((record) => ({
    id: record.id,
    label: labelForProjectRecord(record),
  }));
  const mapAssetOptions = mapAssets.map((asset) => ({
    id: asset.id,
    label: [asset.title || asset.fileName || asset.id, asset.kind]
      .filter(Boolean)
      .join(' • '),
  }));
  const mapRegionOptions = mapRegions.map((region) => ({
    id: region.id,
    label: [
      mapAssets.find((asset) => asset.id === region.assetId)?.title ??
        mapAssets.find((asset) => asset.id === region.assetId)?.fileName ??
        'Unlinked map',
      region.title || region.shortLabel || region.id,
    ].join(' / '),
  }));
  const importOptions = imports.map((researchImport) => ({
    id: researchImport.id,
    label: researchImport.title || researchImport.fileName || researchImport.id,
  }));
  const deskMapOptions = deskMaps.map((deskMap) => ({
    id: deskMap.id,
    label: deskMap.name || deskMap.id,
  }));
  const nodeOptions = nodes.map((node) => ({
    id: node.id,
    label: node.grantee || node.docNo || node.id,
  }));
  const ownerOptions = owners.map((owner) => ({
    id: owner.id,
    label: owner.name || owner.id,
  }));
  const leaseOptions = leases.map((lease) => ({
    id: lease.id,
    label: lease.leaseName || lease.lessee || lease.docNo || lease.id,
  }));

  const sourceLabelById = useMemo(() => mapFromOptions(sourceOptions), [sourceOptions]);
  const formulaLabelById = useMemo(
    () => mapFromOptions(formulaOptions),
    [formulaOptions]
  );
  const projectLabelById = useMemo(
    () => mapFromOptions(projectOptions),
    [projectOptions]
  );
  const deskMapLabelById = useMemo(
    () => mapFromOptions(deskMapOptions),
    [deskMapOptions]
  );
  const nodeLabelById = useMemo(() => mapFromOptions(nodeOptions), [nodeOptions]);
  const ownerLabelById = useMemo(() => mapFromOptions(ownerOptions), [ownerOptions]);
  const leaseLabelById = useMemo(() => mapFromOptions(leaseOptions), [leaseOptions]);
  const mapAssetLabelById = useMemo(
    () => mapFromOptions(mapAssetOptions),
    [mapAssetOptions]
  );
  const mapRegionLabelById = useMemo(
    () => mapFromOptions(mapRegionOptions),
    [mapRegionOptions]
  );
  const importLabelById = useMemo(
    () => mapFromOptions(importOptions),
    [importOptions]
  );

  const filteredSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          matchesFilter(sourceTypeFilter, source.sourceType) &&
          matchesFilter(sourceContextFilter, source.context) &&
          matchesFilter(sourceStatusFilter, source.status) &&
          matchesSearch(search, [
            source.title,
            source.sourceType,
            source.context,
            source.status,
            source.citation,
            source.url,
            source.notes,
            labelFromMap(deskMapLabelById, source.links.deskMapId),
            labelFromMap(nodeLabelById, source.links.nodeId),
            labelFromMap(ownerLabelById, source.links.ownerId),
            labelFromMap(leaseLabelById, source.links.leaseId),
            labelFromMap(mapAssetLabelById, source.links.mapAssetId),
            labelFromMap(mapRegionLabelById, source.links.mapRegionId),
            labelFromMap(importLabelById, source.links.importId),
          ])
      ),
    [
      deskMapLabelById,
      importLabelById,
      leaseLabelById,
      mapAssetLabelById,
      mapRegionLabelById,
      nodeLabelById,
      ownerLabelById,
      search,
      sourceContextFilter,
      sourceStatusFilter,
      sourceTypeFilter,
      sources,
    ]
  );
  const filteredFormulas = useMemo(
    () =>
      formulas.filter(
        (formula) =>
          matchesFilter(formulaCategoryFilter, formula.category) &&
          matchesFilter(formulaStatusFilter, formula.status) &&
          matchesSearch(search, [
            formula.title,
            formula.category,
            formula.status,
            formula.formulaText,
            formula.explanation,
            formula.variables,
            formula.example,
            formula.engineReference,
            formula.notes,
            ...labelsFromIds(sourceLabelById, formula.sourceIds),
          ])
      ),
    [formulaCategoryFilter, formulaStatusFilter, formulas, search, sourceLabelById]
  );
  const filteredProjectRecords = useMemo(
    () =>
      projectRecords.filter(
        (record) =>
          matchesFilter(projectTypeFilter, record.recordType) &&
          matchesFilter(projectStatusFilter, record.status) &&
          matchesSearch(search, [
            record.name,
            record.recordType,
            record.jurisdiction,
            record.status,
            record.acquisitionStatus,
            record.serialOrReference,
            record.legacySerial,
            record.mlrsSerial,
            record.lesseeOrApplicant,
            record.operator,
            record.state,
            record.county,
            record.prospectArea,
            record.effectiveDate,
            record.expirationDate,
            record.primaryTerm,
            record.nextAction,
            record.nextActionDate,
            record.priority,
            record.sourcePacketStatus,
            record.acres,
            record.legalDescription,
            record.notes,
            ...labelsFromIds(sourceLabelById, record.sourceIds),
            labelFromMap(mapAssetLabelById, record.mapAssetId),
            labelFromMap(mapRegionLabelById, record.mapRegionId),
            labelFromMap(deskMapLabelById, record.deskMapId),
            labelFromMap(nodeLabelById, record.nodeId),
            labelFromMap(ownerLabelById, record.ownerId),
            labelFromMap(leaseLabelById, record.leaseId),
            labelFromMap(importLabelById, record.importId),
          ])
      ),
    [
      deskMapLabelById,
      importLabelById,
      leaseLabelById,
      mapAssetLabelById,
      mapRegionLabelById,
      nodeLabelById,
      ownerLabelById,
      projectRecords,
      projectStatusFilter,
      projectTypeFilter,
      search,
      sourceLabelById,
    ]
  );
  const filteredQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          matchesFilter(questionStatusFilter, question.status) &&
          matchesSearch(search, [
            question.question,
            question.answer,
            question.status,
            question.notes,
            ...labelsFromIds(sourceLabelById, question.sourceIds),
            ...labelsFromIds(formulaLabelById, question.formulaIds),
            ...labelsFromIds(projectLabelById, question.projectRecordIds),
          ])
      ),
    [
      formulaLabelById,
      projectLabelById,
      questionStatusFilter,
      questions,
      search,
      sourceLabelById,
    ]
  );

  useEffect(() => {
    if (!selectedSourceId || !sources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(sources[0]?.id ?? null);
    }
  }, [selectedSourceId, sources]);
  useEffect(() => {
    if (!selectedFormulaId || !formulas.some((formula) => formula.id === selectedFormulaId)) {
      setSelectedFormulaId(formulas[0]?.id ?? null);
    }
  }, [formulas, selectedFormulaId]);
  useEffect(() => {
    if (
      !selectedProjectId ||
      !projectRecords.some((record) => record.id === selectedProjectId)
    ) {
      setSelectedProjectId(projectRecords[0]?.id ?? null);
    }
  }, [projectRecords, selectedProjectId]);
  useEffect(() => {
    if (!selectedQuestionId || !questions.some((question) => question.id === selectedQuestionId)) {
      setSelectedQuestionId(questions[0]?.id ?? null);
    }
  }, [questions, selectedQuestionId]);

  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedFormula = formulas.find((formula) => formula.id === selectedFormulaId) ?? null;
  const selectedProjectRecord =
    projectRecords.find((record) => record.id === selectedProjectId) ?? null;
  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ?? null;

  const filteredDatasets = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return RRC_DATASET_CATALOG.filter((dataset) => {
      const matchesCategory = category === 'All' || dataset.category === category;
      const matchesDatasetSearch =
        lowerSearch.length === 0 ||
        dataset.title.toLowerCase().includes(lowerSearch) ||
        dataset.summary.toLowerCase().includes(lowerSearch) ||
        dataset.notes.toLowerCase().includes(lowerSearch);
      return matchesCategory && matchesDatasetSearch;
    });
  }, [category, search]);

  useEffect(() => {
    if (filteredDatasets.length === 0) {
      setSelectedDatasetId(null);
      return;
    }
    if (selectedDatasetId && filteredDatasets.some((dataset) => dataset.id === selectedDatasetId)) {
      return;
    }
    setSelectedDatasetId(filteredDatasets[0]?.id ?? null);
  }, [filteredDatasets, selectedDatasetId]);

  const selectedDataset =
    filteredDatasets.find((dataset) => dataset.id === selectedDatasetId) ??
    RRC_DATASET_CATALOG.find((dataset) => dataset.id === selectedDatasetId) ??
    filteredDatasets[0] ??
    null;

  const visibleImports = useMemo(() => {
    if (!selectedDataset) return imports;
    return imports.filter((researchImport) => researchImport.datasetId === selectedDataset.id);
  }, [imports, selectedDataset]);

  useEffect(() => {
    const pendingDatasetJump = pendingDatasetJumpRef.current;
    if (
      pendingDatasetJump &&
      selectedImportId === pendingDatasetJump.importId &&
      selectedDataset?.id === pendingDatasetJump.datasetId
    ) {
      if (visibleImports.some((researchImport) => researchImport.id === selectedImportId)) {
        pendingDatasetJumpRef.current = null;
      }
      return;
    }

    if (visibleImports.length === 0) {
      setSelectedImportId(null);
      return;
    }
    if (selectedImportId && visibleImports.some((researchImport) => researchImport.id === selectedImportId)) {
      return;
    }
    setSelectedImportId(visibleImports[0]?.id ?? null);
  }, [selectedDataset?.id, selectedImportId, visibleImports]);

  const selectedImport = imports.find((researchImport) => researchImport.id === selectedImportId) ?? null;
  const previewImport = imports.find((researchImport) => researchImport.id === previewImportId) ?? null;
  const isPendingDrillingDataset = selectedDataset?.id === PENDING_DRILLING_DATASET_ID;
  const isDrillingPermitMasterDataset =
    typeof selectedDataset?.id === 'string' &&
    DRILLING_PERMIT_MASTER_DATASET_IDS.includes(
      selectedDataset.id as (typeof DRILLING_PERMIT_MASTER_DATASET_IDS)[number]
    );
  const isHorizontalDrillingDataset = selectedDataset?.id === HORIZONTAL_DRILLING_DATASET_ID;
  const pendingDecodeFingerprint = useMemo(
    () =>
      buildResearchImportFileFingerprint(
        visibleImports
          .filter((researchImport) => Boolean(detectPendingDrillingFileKind(researchImport.fileName)))
          .map((researchImport) => ({
            id: researchImport.id,
            fileName: researchImport.fileName,
            blob: researchImport.blob,
          }))
      ),
    [visibleImports]
  );
  const drillingPermitMasterDecodeFingerprint = useMemo(
    () =>
      buildResearchImportFileFingerprint(
        visibleImports.map((researchImport) => ({
          id: researchImport.id,
          fileName: researchImport.fileName,
          blob: researchImport.blob,
        }))
      ),
    [visibleImports]
  );
  const horizontalDrillingDecodeFingerprint = useMemo(
    () =>
      buildResearchImportFileFingerprint(
        visibleImports.map((researchImport) => ({
          id: researchImport.id,
          fileName: researchImport.fileName,
          blob: researchImport.blob,
        }))
      ),
    [visibleImports]
  );

  useEffect(() => {
    if (!selectedImport) {
      setImportMetadataDraft(null);
      setImportMetadataSaveError(null);
      setIsSavingImportMetadata(false);
      return;
    }

    setImportMetadataDraft(createResearchImportMetadataDraft(selectedImport));
    setImportMetadataSaveError(null);
    setIsSavingImportMetadata(false);
  }, [
    selectedImport?.datasetId,
    selectedImport?.id,
    selectedImport?.notes,
    selectedImport?.title,
  ]);

  const importDatasetOptions = useMemo(() => {
    const options = RRC_DATASET_CATALOG.map((dataset) => ({
      id: dataset.id,
      title: dataset.title,
    }));
    if (
      importMetadataDraft?.datasetId &&
      !options.some((option) => option.id === importMetadataDraft.datasetId)
    ) {
      options.unshift({
        id: importMetadataDraft.datasetId,
        title: `Legacy dataset (${importMetadataDraft.datasetId})`,
      });
    }
    return options;
  }, [importMetadataDraft?.datasetId]);

  const isImportMetadataDirty = researchImportMetadataDraftIsDirty(
    selectedImport,
    importMetadataDraft
  );

  useEffect(() => {
    if (!isPendingDrillingDataset) {
      lastPendingDecodeFingerprintRef.current = null;
      setPendingDecodeState({ decoded: null, isLoading: false, errorMessage: null });
      return;
    }

    if (visibleImports.length === 0) {
      setPendingDecodeState({
        decoded: decodePendingDrillingImports([]),
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    if (pendingDecodeFingerprint === lastPendingDecodeFingerprintRef.current) {
      return;
    }

    lastPendingDecodeFingerprintRef.current = pendingDecodeFingerprint;

    let cancelled = false;
    setPendingDecodeState((current) => ({
      decoded: current.decoded,
      isLoading: true,
      errorMessage: null,
    }));

    Promise.all(
      visibleImports.map(async (researchImport) => ({
        importId: researchImport.id,
        fileName: researchImport.fileName,
        text: detectPendingDrillingFileKind(researchImport.fileName)
          ? await researchImport.blob.text()
          : '',
      }))
    )
      .then((downloadSources) => {
        if (cancelled) return;
        setPendingDecodeState({
          decoded: decodePendingDrillingImports(downloadSources),
          isLoading: false,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPendingDecodeState({
          decoded: null,
          isLoading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Failed to decode the pending permit files.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isPendingDrillingDataset, pendingDecodeFingerprint, visibleImports]);

  useEffect(() => {
    if (!isDrillingPermitMasterDataset) {
      lastDrillingPermitMasterDecodeFingerprintRef.current = null;
      setDrillingPermitMasterDecodeState({
        decoded: null,
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    if (visibleImports.length === 0) {
      setDrillingPermitMasterDecodeState({
        decoded: decodeDrillingPermitMasterImports([]),
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    if (
      drillingPermitMasterDecodeFingerprint ===
      lastDrillingPermitMasterDecodeFingerprintRef.current
    ) {
      return;
    }

    lastDrillingPermitMasterDecodeFingerprintRef.current =
      drillingPermitMasterDecodeFingerprint;

    let cancelled = false;
    setDrillingPermitMasterDecodeState((current) => ({
      decoded: current.decoded,
      isLoading: true,
      errorMessage: null,
    }));

    Promise.all(
      visibleImports.map(async (researchImport) => ({
        importId: researchImport.id,
        fileName: researchImport.fileName,
        text: isTextPreviewFormat(researchImport.detectedFormat)
          ? await researchImport.blob.text()
          : '',
      }))
    )
      .then((downloadSources) => {
        if (cancelled) return;
        setDrillingPermitMasterDecodeState({
          decoded: decodeDrillingPermitMasterImports(downloadSources),
          isLoading: false,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDrillingPermitMasterDecodeState({
          decoded: null,
          isLoading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Failed to decode the drilling permit master files.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    drillingPermitMasterDecodeFingerprint,
    isDrillingPermitMasterDataset,
    visibleImports,
  ]);

  useEffect(() => {
    if (!isHorizontalDrillingDataset) {
      lastHorizontalDrillingDecodeFingerprintRef.current = null;
      setHorizontalDrillingDecodeState({
        decoded: null,
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    if (visibleImports.length === 0) {
      setHorizontalDrillingDecodeState({
        decoded: decodeHorizontalDrillingImports([]),
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    if (
      horizontalDrillingDecodeFingerprint ===
      lastHorizontalDrillingDecodeFingerprintRef.current
    ) {
      return;
    }

    lastHorizontalDrillingDecodeFingerprintRef.current =
      horizontalDrillingDecodeFingerprint;

    let cancelled = false;
    setHorizontalDrillingDecodeState((current) => ({
      decoded: current.decoded,
      isLoading: true,
      errorMessage: null,
    }));

    Promise.all(
      visibleImports.map(async (researchImport) => ({
        importId: researchImport.id,
        fileName: researchImport.fileName,
        text: isTextPreviewFormat(researchImport.detectedFormat)
          ? await researchImport.blob.text()
          : '',
      }))
    )
      .then((downloadSources) => {
        if (cancelled) return;
        setHorizontalDrillingDecodeState({
          decoded: decodeHorizontalDrillingImports(downloadSources),
          isLoading: false,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHorizontalDrillingDecodeState({
          decoded: null,
          isLoading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Failed to decode the horizontal drilling permit files.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    horizontalDrillingDecodeFingerprint,
    isHorizontalDrillingDataset,
    visibleImports,
  ]);

  useEffect(() => {
    if (!selectedImport || !isTextPreviewFormat(selectedImport.detectedFormat)) {
      setSelectedTextPreviewState({
        preview: null,
        isLoading: false,
        errorMessage: null,
      });
      return;
    }

    let cancelled = false;
    setSelectedTextPreviewState({
      preview: null,
      isLoading: true,
      errorMessage: null,
    });

    const pendingFileKind = detectPendingDrillingFileKind(selectedImport.fileName);

    selectedImport.blob
      .text()
      .then((text) => {
        if (cancelled) return;
        setSelectedTextPreviewState({
          preview: buildRrcDelimitedTextPreview(text, {
            knownColumns: pendingFileKind
              ? PENDING_DRILLING_FILE_SPECS[pendingFileKind].columns
              : undefined,
            maxRows: 20,
          }),
          isLoading: false,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSelectedTextPreviewState({
          preview: null,
          isLoading: false,
          errorMessage:
            error instanceof Error ? error.message : 'Failed to read the selected text file.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedImport?.blob,
    selectedImport?.detectedFormat,
    selectedImport?.fileName,
    selectedImport?.id,
  ]);

  function getImportStatusLabel(
    importId: string,
    detectedFormat: ResearchImportFormat
  ) {
    if (isHorizontalDrillingDataset) {
      const summary = horizontalDrillingDecodeState.decoded?.parsedFiles.find(
        (parsedFile) => parsedFile.importId === importId
      );
      if (summary?.recognized) {
        return `${detectedFormat} • Horizontal Decoder • ${summary.recordCount} rows`;
      }
    }
    if (isDrillingPermitMasterDataset) {
      const summary = drillingPermitMasterDecodeState.decoded?.parsedFiles.find(
        (parsedFile) => parsedFile.importId === importId
      );
      if (summary?.recognized) {
        return `${detectedFormat} • Permit Master Decoder • ${summary.recordCount} records`;
      }
      if (summary && summary.ignoredRecordTypes.length > 0) {
        return `${detectedFormat} • Companion segments only`;
      }
    }
    if (isPendingDrillingDataset) {
      const summary = pendingDecodeState.decoded?.parsedFiles.find(
        (parsedFile) => parsedFile.importId === importId
      );
      if (summary?.fileKind) {
        return `${detectedFormat} • Pending Permit Decoder • ${summary.recordCount} rows`;
      }
    }
    return `${detectedFormat} • ${getDecoderStatusForFormat(detectedFormat)}`;
  }

  const setImportMetadataField = (
    field: keyof NonNullable<typeof importMetadataDraft>,
    value: string | null
  ) => {
    setImportMetadataDraft((current) =>
      current ? { ...current, [field]: value } : current
    );
  };

  const resetImportMetadataDraft = () => {
    if (!selectedImport) return;
    pendingDatasetJumpRef.current = null;
    setImportMetadataDraft(createResearchImportMetadataDraft(selectedImport));
    setImportMetadataSaveError(null);
  };

  const handleSaveImportMetadata = async () => {
    if (!selectedImport || !importMetadataDraft || !isImportMetadataDirty) return;

    const previousDatasetId = selectedDataset?.id ?? null;
    const nextDatasetId = importMetadataDraft.datasetId;
    const shouldJumpDataset =
      typeof nextDatasetId === 'string' &&
      nextDatasetId.length > 0 &&
      nextDatasetId !== selectedDataset?.id;

    setIsSavingImportMetadata(true);
    setImportMetadataSaveError(null);

    try {
      if (shouldJumpDataset) {
        pendingDatasetJumpRef.current = {
          importId: selectedImport.id,
          datasetId: nextDatasetId,
        };
        setSelectedDatasetId(nextDatasetId);
        setSelectedImportId(selectedImport.id);
      }

      await updateImport(selectedImport.id, {
        title: importMetadataDraft.title,
        datasetId: importMetadataDraft.datasetId,
        notes: importMetadataDraft.notes,
      });
    } catch (error) {
      pendingDatasetJumpRef.current = null;
      if (shouldJumpDataset) {
        setSelectedDatasetId(previousDatasetId);
      }
      setImportMetadataSaveError(
        error instanceof Error
          ? error.message
          : 'Failed to save the research import details.'
      );
    } finally {
      setIsSavingImportMetadata(false);
    }
  };

  const createSourceRecord = async (overrides: Partial<ResearchSource> = {}) => {
    if (!workspaceId) return;
    const source = createBlankResearchSource(workspaceId, {
      title: 'New Source',
      ...overrides,
    });
    await addSource(source);
    setSection('sources');
    setSelectedSourceId(source.id);
  };

  const createFormulaRecord = async (overrides: Partial<ResearchFormula> = {}) => {
    if (!workspaceId) return;
    const formula = createBlankResearchFormula(workspaceId, {
      title: 'New Formula',
      ...overrides,
    });
    await addFormula(formula);
    setSection('formulas');
    setSelectedFormulaId(formula.id);
  };

  const createProjectRecord = async (
    overrides: Partial<ResearchProjectRecord> = {}
  ) => {
    if (!workspaceId) return;
    const record = createBlankResearchProjectRecord(workspaceId, {
      name: 'New Project Record',
      recordType: 'Other',
      jurisdiction: 'General',
      ...overrides,
    });
    await addProjectRecord(record);
    setSection('projects');
    setSelectedProjectId(record.id);
  };

  const createQuestionRecord = async (
    overrides: Partial<ResearchQuestion> = {}
  ) => {
    if (!workspaceId) return;
    const question = createBlankResearchQuestion(workspaceId, {
      question: 'New research question',
      ...overrides,
    });
    await addQuestion(question);
    setSection('questions');
    setSelectedQuestionId(question.id);
  };

  const addFormulaStarters = async () => {
    if (!workspaceId) return;
    const starters = buildResearchFormulaStarterRecords(
      workspaceId,
      sources,
      formulas
    );
    if (starters.source) {
      await addSource(starters.source);
    }
    for (const formula of starters.formulas) {
      await addFormula(formula);
    }
    setSection('formulas');
    setSelectedFormulaId(starters.formulas[0]?.id ?? formulas[0]?.id ?? null);
  };

  const activeSection = RESEARCH_SECTIONS.find((item) => item.id === section)!;
  const totalRecords =
    sources.length + formulas.length + projectRecords.length + questions.length;

  return (
    <div className="h-full grid gap-4 p-4 bg-parchment-dark/30 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-4 border-b border-ledger-line bg-ledger space-y-3">
          <div>
            <div className="text-lg font-display font-bold text-ink">Research</div>
            <div className="text-xs text-ink-light">
              Source library, formula cards, federal/private project records, and saved questions.
            </div>
          </div>

          <FormField label="Search Research" value={search} onChange={setSearch} />

          <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-[11px] text-ink-light">
            This workspace is for source-grounded review. RRC downloads remain available in
            Data Imports, but DBF/EBCDIC decoding is no longer the main track.
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {RESEARCH_SECTIONS.map((item) => {
            const count =
              item.id === 'home'
                ? totalRecords
                : item.id === 'sources'
                ? sources.length
                : item.id === 'formulas'
                  ? formulas.length
                  : item.id === 'projects'
                    ? projectRecords.length
                    : item.id === 'questions'
                      ? questions.length
                      : imports.length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full border-b border-ledger-line px-4 py-3 text-left transition-colors ${
                  section === item.id ? 'bg-leather/10' : 'hover:bg-ledger'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">{item.label}</div>
                  <span className="text-[11px] text-ink-light">{count}</span>
                </div>
                <div className="mt-1 text-xs text-ink-light">{item.description}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 grid gap-4 grid-rows-[auto_minmax(0,1fr)]">
        <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm p-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-display font-bold text-ink">
              {activeSection.label}
            </div>
            <div className="text-sm text-ink-light">{activeSection.description}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-light">
              <span className="rounded-full border border-ledger-line bg-ledger px-2 py-0.5">
                {sources.length} sources
              </span>
              <span className="rounded-full border border-ledger-line bg-ledger px-2 py-0.5">
                {formulas.length} formulas
              </span>
              <span className="rounded-full border border-ledger-line bg-ledger px-2 py-0.5">
                {projectRecords.length} project records
              </span>
              <span className="rounded-full border border-ledger-line bg-ledger px-2 py-0.5">
                {totalRecords} source-of-truth records
              </span>
            </div>
          </div>

          {section === 'sources' && (
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() => void createSourceRecord()}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
            >
              Add Source
            </button>
          )}
          {section === 'formulas' && (
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() => void createFormulaRecord()}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
            >
              Add Formula
            </button>
          )}
          {section === 'projects' && (
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() => void createProjectRecord()}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
            >
              Add Project Record
            </button>
          )}
          {section === 'questions' && (
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() => void createQuestionRecord()}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
            >
              Add Question
            </button>
          )}
        </div>

        {section === 'home' && (
          <div className="min-h-0 overflow-auto rounded-xl border border-ledger-line bg-parchment shadow-sm p-4 space-y-4">
            <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
              <ResearchHomeTile
                title="Sources"
                count={sources.length}
                description="Authorities, documents, notes, and map evidence."
                actionLabel="Add Source"
                onOpen={() => setSection('sources')}
                onAction={() => void createSourceRecord()}
              />
              <ResearchHomeTile
                title="Formulas"
                count={formulas.length}
                description="Current Texas math cards with variables and source links."
                actionLabel="Add Starters"
                onOpen={() => setSection('formulas')}
                onAction={() => void addFormulaStarters()}
              />
              <ResearchHomeTile
                title="Project Records"
                count={projectRecords.length}
                description="Federal/private leases, mapped tracts, and targets."
                actionLabel="Add Record"
                onOpen={() => setSection('projects')}
                onAction={() => void createProjectRecord()}
              />
              <ResearchHomeTile
                title="Questions"
                count={questions.length}
                description="Manual answers and later AI-grounding prompts."
                actionLabel="Add Question"
                onOpen={() => setSection('questions')}
                onAction={() => void createQuestionRecord()}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <section className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      Cross-Library Search
                    </div>
                    <div className="text-xs text-ink-light">
                      Search reads record text plus linked sources, map evidence, owners,
                      leases, tracts, and imported file labels.
                    </div>
                  </div>
                  <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5 text-[11px] text-ink-light">
                    {search.trim()
                      ? filteredSources.length +
                        filteredFormulas.length +
                        filteredProjectRecords.length +
                        filteredQuestions.length
                      : totalRecords}{' '}
                    records
                  </span>
                </div>

                {search.trim() ? (
                  <div className="grid gap-2">
                    {filteredSources.slice(0, 4).map((source) => (
                      <SearchResultButton
                        key={source.id}
                        type="Source"
                        title={labelForSource(source)}
                        meta={`${source.sourceType} • ${source.context} • ${source.status}`}
                        onClick={() => {
                          setSection('sources');
                          setSelectedSourceId(source.id);
                        }}
                      />
                    ))}
                    {filteredFormulas.slice(0, 4).map((formula) => (
                      <SearchResultButton
                        key={formula.id}
                        type="Formula"
                        title={labelForFormula(formula)}
                        meta={`${formula.category} • ${formula.status}`}
                        onClick={() => {
                          setSection('formulas');
                          setSelectedFormulaId(formula.id);
                        }}
                      />
                    ))}
                    {filteredProjectRecords.slice(0, 4).map((record) => (
                      <SearchResultButton
                        key={record.id}
                        type="Project"
                        title={labelForProjectRecord(record)}
                        meta={`${record.recordType} • ${record.status}`}
                        onClick={() => {
                          setSection('projects');
                          setSelectedProjectId(record.id);
                        }}
                      />
                    ))}
                    {filteredQuestions.slice(0, 4).map((question) => (
                      <SearchResultButton
                        key={question.id}
                        type="Question"
                        title={labelForQuestion(question)}
                        meta={question.status}
                        onClick={() => {
                          setSection('questions');
                          setSelectedQuestionId(question.id);
                        }}
                      />
                    ))}
                    {filteredSources.length +
                      filteredFormulas.length +
                      filteredProjectRecords.length +
                      filteredQuestions.length ===
                      0 && (
                      <div className="rounded-lg border border-dashed border-ledger-line bg-parchment px-4 py-5 text-sm text-ink-light">
                        No Research records match this search.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-ledger-line bg-parchment px-4 py-5 text-sm text-ink-light">
                    Use the search box to find sources, formulas, project records, and
                    saved questions from one place.
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Review Queue</div>
                  <div className="text-xs text-ink-light">
                    Draft, Needs Review, and Under Review records stay visible before
                    they become relied-upon authority.
                  </div>
                </div>
                <ReviewQueueRow
                  label="Sources marked Needs Review"
                  count={
                    sources.filter((source) => source.status === 'Needs Review').length
                  }
                  onClick={() => {
                    setSection('sources');
                    setSourceStatusFilter('Needs Review');
                  }}
                />
                <ReviewQueueRow
                  label="Formula cards marked Needs Review"
                  count={
                    formulas.filter((formula) => formula.status === 'Needs Review').length
                  }
                  onClick={() => {
                    setSection('formulas');
                    setFormulaStatusFilter('Needs Review');
                  }}
                />
                <ReviewQueueRow
                  label="Project records under review"
                  count={
                    projectRecords.filter(
                      (record) => record.status === 'Under Review'
                    ).length
                  }
                  onClick={() => {
                    setSection('projects');
                    setProjectStatusFilter('Under Review');
                  }}
                />
                <ReviewQueueRow
                  label="Saved questions still open"
                  count={
                    questions.filter((question) => question.status !== 'Answered')
                      .length
                  }
                  onClick={() => {
                    setSection('questions');
                    setQuestionStatusFilter('Needs Review');
                  }}
                />
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Federal/private records stay reference-only here. They do not run
                  Texas Desk Map, Leasehold, NPRI, ORRI, WI, payout, or ONRR math.
                </div>
              </section>
            </div>
          </div>
        )}

        {section === 'sources' && (
          <div className="grid min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <RecordList
              emptyText={
                search.trim() ||
                sourceTypeFilter !== 'All' ||
                sourceContextFilter !== 'All' ||
                sourceStatusFilter !== 'All'
                  ? 'No sources match this search or filter.'
                  : 'No sources yet. Add statutes, cases, BLM/RRC links, project notes, or file-backed references here.'
              }
              toolbar={
                <FilterToolbar>
                  <FilterSelect
                    label="Type"
                    value={sourceTypeFilter}
                    options={['All', ...RESEARCH_SOURCE_TYPE_OPTIONS]}
                    onChange={(value) =>
                      setSourceTypeFilter(value as ResearchSourceType | 'All')
                    }
                  />
                  <FilterSelect
                    label="Context"
                    value={sourceContextFilter}
                    options={['All', ...RESEARCH_CONTEXT_OPTIONS]}
                    onChange={(value) =>
                      setSourceContextFilter(value as ResearchContext | 'All')
                    }
                  />
                  <FilterSelect
                    label="Status"
                    value={sourceStatusFilter}
                    options={['All', ...RESEARCH_REVIEW_STATUS_OPTIONS]}
                    onChange={(value) =>
                      setSourceStatusFilter(value as ResearchReviewStatus | 'All')
                    }
                  />
                </FilterToolbar>
              }
              records={filteredSources.map((source) => ({
                id: source.id,
                title: labelForSource(source),
                meta: `${source.sourceType} • ${source.context} • ${source.status}`,
                body: source.citation || source.url || source.notes,
              }))}
              selectedId={selectedSourceId}
              onSelect={setSelectedSourceId}
            />
            <DetailShell
              title={selectedSource ? labelForSource(selectedSource) : 'No source selected'}
              subtitle="A source can support formulas, project records, saved questions, maps, and import files."
              onDelete={
                selectedSource
                  ? async () => {
                      if (!confirm('Delete this research source?')) return;
                      await removeSource(selectedSource.id);
                    }
                  : undefined
              }
            >
              {selectedSource ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Title"
                      value={selectedSource.title}
                      onChange={(value) => updateSource(selectedSource.id, { title: value })}
                    />
                    <SelectField<ResearchSourceType>
                      label="Source Type"
                      value={selectedSource.sourceType}
                      options={RESEARCH_SOURCE_TYPE_OPTIONS}
                      onChange={(value) => updateSource(selectedSource.id, { sourceType: value })}
                    />
                    <SelectField<ResearchContext>
                      label="Context"
                      value={selectedSource.context}
                      options={RESEARCH_CONTEXT_OPTIONS}
                      onChange={(value) => updateSource(selectedSource.id, { context: value })}
                    />
                    <SelectField<ResearchReviewStatus>
                      label="Review Status"
                      value={selectedSource.status}
                      options={RESEARCH_REVIEW_STATUS_OPTIONS}
                      onChange={(value) => updateSource(selectedSource.id, { status: value })}
                    />
                    <FormField
                      label="Citation / Doc Ref"
                      value={selectedSource.citation}
                      onChange={(value) => updateSource(selectedSource.id, { citation: value })}
                    />
                    <FormField
                      label="URL"
                      value={selectedSource.url}
                      onChange={(value) => updateSource(selectedSource.id, { url: value })}
                      className="md:col-span-2"
                    />
                  </div>
                  <TextAreaField
                    label="Notes"
                    value={selectedSource.notes}
                    rows={7}
                    placeholder="Why this source matters, what it proves, and any review cautions."
                    onChange={(value) => updateSource(selectedSource.id, { notes: value })}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <NullableSelect
                      label="Desk Map"
                      value={selectedSource.links.deskMapId}
                      options={deskMapOptions}
                      emptyLabel="No Desk Map link"
                      onChange={(deskMapId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, deskMapId },
                        })
                      }
                    />
                    <NullableSelect
                      label="Title / Branch Card"
                      value={selectedSource.links.nodeId}
                      options={nodeOptions}
                      emptyLabel="No card link"
                      onChange={(nodeId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, nodeId },
                        })
                      }
                    />
                    <NullableSelect
                      label="Owner"
                      value={selectedSource.links.ownerId}
                      options={ownerOptions}
                      emptyLabel="No owner link"
                      onChange={(ownerId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, ownerId },
                        })
                      }
                    />
                    <NullableSelect
                      label="Lease"
                      value={selectedSource.links.leaseId}
                      options={leaseOptions}
                      emptyLabel="No lease link"
                      onChange={(leaseId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, leaseId },
                        })
                      }
                    />
                    <NullableSelect
                      label="Map Asset"
                      value={selectedSource.links.mapAssetId}
                      options={mapAssetOptions}
                      emptyLabel="No map asset link"
                      onChange={(mapAssetId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, mapAssetId },
                        })
                      }
                    />
                    <NullableSelect
                      label="Map Region"
                      value={selectedSource.links.mapRegionId}
                      options={mapRegionOptions}
                      emptyLabel="No map region link"
                      onChange={(mapRegionId) => {
                        const regionAssetId =
                          mapRegions.find((region) => region.id === mapRegionId)
                            ?.assetId ?? selectedSource.links.mapAssetId;
                        updateSource(selectedSource.id, {
                          links: {
                            ...selectedSource.links,
                            mapAssetId: regionAssetId,
                            mapRegionId,
                          },
                        });
                      }}
                    />
                    <NullableSelect
                      label="Imported File"
                      value={selectedSource.links.importId}
                      options={importOptions}
                      emptyLabel="No import link"
                      onChange={(importId) =>
                        updateSource(selectedSource.id, {
                          links: { ...selectedSource.links, importId },
                        })
                      }
                    />
                  </div>
                  <LinkedSummary
                    title="Used By"
                    emptyText="No formulas, project records, or saved questions cite this source yet."
                    items={[
                      ...formulas
                        .filter((formula) =>
                          formula.sourceIds.includes(selectedSource.id)
                        )
                        .map((formula) => ({
                          label: labelForFormula(formula),
                          meta: `Formula • ${formula.category}`,
                        })),
                      ...projectRecords
                        .filter((record) =>
                          record.sourceIds.includes(selectedSource.id)
                        )
                        .map((record) => ({
                          label: labelForProjectRecord(record),
                          meta: `Project Record • ${record.recordType}`,
                        })),
                      ...questions
                        .filter((question) =>
                          question.sourceIds.includes(selectedSource.id)
                        )
                        .map((question) => ({
                          label: labelForQuestion(question),
                          meta: `Question • ${question.status}`,
                        })),
                    ]}
                  />
                </div>
              ) : (
                <EmptyDetail message="Add or select a source to begin." />
              )}
            </DetailShell>
          </div>
        )}

        {section === 'formulas' && (
          <div className="grid min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <RecordList
              emptyText={
                search.trim() ||
                formulaCategoryFilter !== 'All' ||
                formulaStatusFilter !== 'All'
                  ? 'No formula cards match this search or filter.'
                  : 'No formulas yet. Add the formulas you want LANDroid to explain and later expose to AI.'
              }
              toolbar={
                <FilterToolbar>
                  <FilterSelect
                    label="Category"
                    value={formulaCategoryFilter}
                    options={['All', ...RESEARCH_FORMULA_CATEGORY_OPTIONS]}
                    onChange={(value) =>
                      setFormulaCategoryFilter(
                        value as ResearchFormulaCategory | 'All'
                      )
                    }
                  />
                  <FilterSelect
                    label="Status"
                    value={formulaStatusFilter}
                    options={['All', ...RESEARCH_REVIEW_STATUS_OPTIONS]}
                    onChange={(value) =>
                      setFormulaStatusFilter(value as ResearchReviewStatus | 'All')
                    }
                  />
                  <button
                    type="button"
                    disabled={!workspaceId}
                    onClick={() => void addFormulaStarters()}
                    className="self-end px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
                  >
                    Add Math Starters
                  </button>
                </FilterToolbar>
              }
              records={filteredFormulas.map((formula) => ({
                id: formula.id,
                title: labelForFormula(formula),
                meta: `${formula.category} • ${formula.status}`,
                body: formula.explanation || formula.formulaText,
              }))}
              selectedId={selectedFormulaId}
              onSelect={setSelectedFormulaId}
            />
            <DetailShell
              title={selectedFormula ? labelForFormula(selectedFormula) : 'No formula selected'}
              subtitle="A formula card should explain what LANDroid calculates, what variables mean, and what source or convention supports it."
              onDelete={
                selectedFormula
                  ? async () => {
                      if (!confirm('Delete this research formula?')) return;
                      await removeFormula(selectedFormula.id);
                    }
                  : undefined
              }
            >
              {selectedFormula ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Title"
                      value={selectedFormula.title}
                      onChange={(value) => updateFormula(selectedFormula.id, { title: value })}
                    />
                    <SelectField<ResearchFormulaCategory>
                      label="Category"
                      value={selectedFormula.category}
                      options={RESEARCH_FORMULA_CATEGORY_OPTIONS}
                      onChange={(value) =>
                        updateFormula(selectedFormula.id, { category: value })
                      }
                    />
                    <SelectField<ResearchReviewStatus>
                      label="Status"
                      value={selectedFormula.status}
                      options={RESEARCH_REVIEW_STATUS_OPTIONS}
                      onChange={(value) => updateFormula(selectedFormula.id, { status: value })}
                    />
                    <FormField
                      label="Engine Reference"
                      value={selectedFormula.engineReference}
                      onChange={(value) =>
                        updateFormula(selectedFormula.id, { engineReference: value })
                      }
                    />
                  </div>
                  <TextAreaField
                    label="Formula"
                    value={selectedFormula.formulaText}
                    rows={3}
                    placeholder="leased fraction x lease royalty"
                    onChange={(value) =>
                      updateFormula(selectedFormula.id, { formulaText: value })
                    }
                  />
                  <TextAreaField
                    label="Plain-English Explanation"
                    value={selectedFormula.explanation}
                    rows={4}
                    onChange={(value) =>
                      updateFormula(selectedFormula.id, { explanation: value })
                    }
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextAreaField
                      label="Variables"
                      value={selectedFormula.variables}
                      rows={4}
                      onChange={(value) =>
                        updateFormula(selectedFormula.id, { variables: value })
                      }
                    />
                    <TextAreaField
                      label="Example"
                      value={selectedFormula.example}
                      rows={4}
                      onChange={(value) =>
                        updateFormula(selectedFormula.id, { example: value })
                      }
                    />
                  </div>
                  <LinkCheckboxes
                    title="Supporting Sources"
                    ids={selectedFormula.sourceIds}
                    options={sourceOptions}
                    onChange={(sourceIds) =>
                      updateFormula(selectedFormula.id, { sourceIds })
                    }
                  />
                  <TextAreaField
                    label="Notes"
                    value={selectedFormula.notes}
                    rows={4}
                    onChange={(value) => updateFormula(selectedFormula.id, { notes: value })}
                  />
                  <LinkedSummary
                    title="Used By"
                    emptyText="No saved questions cite this formula yet."
                    items={questions
                      .filter((question) =>
                        question.formulaIds.includes(selectedFormula.id)
                      )
                      .map((question) => ({
                        label: labelForQuestion(question),
                        meta: `Question • ${question.status}`,
                      }))}
                  />
                </div>
              ) : (
                <EmptyDetail message="Add or select a formula card to begin." />
              )}
            </DetailShell>
          </div>
        )}

        {section === 'projects' && (
          <div className="grid min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <RecordList
              emptyText={
                search.trim() ||
                projectTypeFilter !== 'All' ||
                projectStatusFilter !== 'All'
                  ? 'No project records match this search or filter.'
                  : 'No project records yet. Add federal leases, private leases, mapped tracts, or acquisition targets here.'
              }
              toolbar={
                <FilterToolbar>
                  <FilterSelect
                    label="Type"
                    value={projectTypeFilter}
                    options={['All', ...RESEARCH_PROJECT_RECORD_TYPE_OPTIONS]}
                    onChange={(value) =>
                      setProjectTypeFilter(value as ResearchProjectRecordType | 'All')
                    }
                  />
                  <FilterSelect
                    label="Status"
                    value={projectStatusFilter}
                    options={['All', ...RESEARCH_PROJECT_STATUS_OPTIONS]}
                    onChange={(value) =>
                      setProjectStatusFilter(value as ResearchProjectStatus | 'All')
                    }
                  />
                </FilterToolbar>
              }
              records={filteredProjectRecords.map((record) => ({
                id: record.id,
                title: labelForProjectRecord(record),
                meta: `${record.recordType} • ${record.status}`,
                body:
                  [
                    record.mlrsSerial || record.legacySerial || record.serialOrReference,
                    record.county || record.prospectArea,
                    record.expirationDate ? `Expires ${record.expirationDate}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ') ||
                  record.legalDescription ||
                  record.notes,
              }))}
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
            <DetailShell
              title={
                selectedProjectRecord
                  ? labelForProjectRecord(selectedProjectRecord)
                  : 'No project record selected'
              }
              subtitle="Federal/private project records are information tracking only in this phase. They do not alter Texas title or payout math."
              onDelete={
                selectedProjectRecord
                  ? async () => {
                      if (!confirm('Delete this project record?')) return;
                      await removeProjectRecord(selectedProjectRecord.id);
                    }
                  : undefined
              }
            >
              {selectedProjectRecord ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Federal/private math is intentionally not active here yet. Use this
                    record to track leases, tracts, acquisition status, maps, and sources.
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Name"
                      value={selectedProjectRecord.name}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { name: value })
                      }
                    />
                    <FormField
                      label="Serial / Reference"
                      value={selectedProjectRecord.serialOrReference}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          serialOrReference: value,
                        })
                      }
                    />
                    <FormField
                      label="Legacy Serial"
                      value={selectedProjectRecord.legacySerial}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          legacySerial: value,
                        })
                      }
                    />
                    <FormField
                      label="MLRS Serial"
                      value={selectedProjectRecord.mlrsSerial}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          mlrsSerial: value,
                        })
                      }
                    />
                    <SelectField<ResearchProjectRecordType>
                      label="Record Type"
                      value={selectedProjectRecord.recordType}
                      options={RESEARCH_PROJECT_RECORD_TYPE_OPTIONS}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          recordType: value,
                        })
                      }
                    />
                    <SelectField<ResearchContext>
                      label="Jurisdiction"
                      value={selectedProjectRecord.jurisdiction}
                      options={RESEARCH_CONTEXT_OPTIONS}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          jurisdiction: value,
                        })
                      }
                    />
                    <SelectField<ResearchProjectStatus>
                      label="Status"
                      value={selectedProjectRecord.status}
                      options={RESEARCH_PROJECT_STATUS_OPTIONS}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { status: value })
                      }
                    />
                    <FormField
                      label="Acquisition Status"
                      value={selectedProjectRecord.acquisitionStatus}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          acquisitionStatus: value,
                        })
                      }
                    />
                    <FormField
                      label="Lessee / Applicant"
                      value={selectedProjectRecord.lesseeOrApplicant}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          lesseeOrApplicant: value,
                        })
                      }
                    />
                    <FormField
                      label="Operator"
                      value={selectedProjectRecord.operator}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { operator: value })
                      }
                    />
                    <FormField
                      label="State"
                      value={selectedProjectRecord.state}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { state: value })
                      }
                    />
                    <FormField
                      label="County"
                      value={selectedProjectRecord.county}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { county: value })
                      }
                    />
                    <FormField
                      label="Prospect Area"
                      value={selectedProjectRecord.prospectArea}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          prospectArea: value,
                        })
                      }
                    />
                    <FormField
                      label="Effective Date"
                      type="date"
                      value={selectedProjectRecord.effectiveDate}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          effectiveDate: value,
                        })
                      }
                    />
                    <FormField
                      label="Expiration Date"
                      type="date"
                      value={selectedProjectRecord.expirationDate}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          expirationDate: value,
                        })
                      }
                    />
                    <FormField
                      label="Primary Term"
                      value={selectedProjectRecord.primaryTerm}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          primaryTerm: value,
                        })
                      }
                    />
                    <FormField
                      label="Next Action Date"
                      type="date"
                      value={selectedProjectRecord.nextActionDate}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          nextActionDate: value,
                        })
                      }
                    />
                    <FormField
                      label="Priority"
                      value={selectedProjectRecord.priority}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { priority: value })
                      }
                    />
                    <FormField
                      label="Source Packet Status"
                      value={selectedProjectRecord.sourcePacketStatus}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, {
                          sourcePacketStatus: value,
                        })
                      }
                    />
                    <FormField
                      label="Acres"
                      value={selectedProjectRecord.acres}
                      onChange={(value) =>
                        updateProjectRecord(selectedProjectRecord.id, { acres: value })
                      }
                    />
                  </div>
                  <TextAreaField
                    label="Legal Description / Tract Notes"
                    value={selectedProjectRecord.legalDescription}
                    rows={5}
                    onChange={(value) =>
                      updateProjectRecord(selectedProjectRecord.id, {
                        legalDescription: value,
                      })
                    }
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <NullableSelect
                      label="Map Asset"
                      value={selectedProjectRecord.mapAssetId}
                      options={mapAssetOptions}
                      emptyLabel="No map asset link"
                      onChange={(mapAssetId) =>
                        updateProjectRecord(selectedProjectRecord.id, { mapAssetId })
                      }
                    />
                    <NullableSelect
                      label="Map Region"
                      value={selectedProjectRecord.mapRegionId}
                      options={mapRegionOptions}
                      emptyLabel="No map region link"
                      onChange={(mapRegionId) => {
                        const regionAssetId =
                          mapRegions.find((region) => region.id === mapRegionId)
                            ?.assetId ?? selectedProjectRecord.mapAssetId;
                        updateProjectRecord(selectedProjectRecord.id, {
                          mapAssetId: regionAssetId,
                          mapRegionId,
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <NullableSelect
                      label="Desk Map"
                      value={selectedProjectRecord.deskMapId}
                      options={deskMapOptions}
                      emptyLabel="No desk map link"
                      onChange={(deskMapId) =>
                        updateProjectRecord(selectedProjectRecord.id, { deskMapId })
                      }
                    />
                    <NullableSelect
                      label="Title / Lease Card"
                      value={selectedProjectRecord.nodeId}
                      options={nodeOptions}
                      emptyLabel="No card link"
                      onChange={(nodeId) =>
                        updateProjectRecord(selectedProjectRecord.id, { nodeId })
                      }
                    />
                    <NullableSelect
                      label="Owner"
                      value={selectedProjectRecord.ownerId}
                      options={ownerOptions}
                      emptyLabel="No owner link"
                      onChange={(ownerId) =>
                        updateProjectRecord(selectedProjectRecord.id, { ownerId })
                      }
                    />
                    <NullableSelect
                      label="Lease"
                      value={selectedProjectRecord.leaseId}
                      options={leaseOptions}
                      emptyLabel="No lease link"
                      onChange={(leaseId) =>
                        updateProjectRecord(selectedProjectRecord.id, { leaseId })
                      }
                    />
                    <NullableSelect
                      label="Import File"
                      value={selectedProjectRecord.importId}
                      options={importOptions}
                      emptyLabel="No import link"
                      onChange={(importId) =>
                        updateProjectRecord(selectedProjectRecord.id, { importId })
                      }
                    />
                  </div>
                  <LinkCheckboxes
                    title="Supporting Sources"
                    ids={selectedProjectRecord.sourceIds}
                    options={sourceOptions}
                    onChange={(sourceIds) =>
                      updateProjectRecord(selectedProjectRecord.id, { sourceIds })
                    }
                  />
                  <TextAreaField
                    label="Next Action"
                    value={selectedProjectRecord.nextAction}
                    rows={3}
                    onChange={(value) =>
                      updateProjectRecord(selectedProjectRecord.id, {
                        nextAction: value,
                      })
                    }
                  />
                  <TextAreaField
                    label="Notes"
                    value={selectedProjectRecord.notes}
                    rows={5}
                    onChange={(value) =>
                      updateProjectRecord(selectedProjectRecord.id, { notes: value })
                    }
                  />
                </div>
              ) : (
                <EmptyDetail message="Add or select a federal/private project record to begin." />
              )}
            </DetailShell>
          </div>
        )}

        {section === 'questions' && (
          <div className="grid min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <RecordList
              emptyText={
                search.trim() || questionStatusFilter !== 'All'
                  ? 'No saved questions match this search or filter.'
                  : 'No saved questions yet. Add questions you want LANDroid or a future AI layer to answer from sources.'
              }
              toolbar={
                <FilterToolbar>
                  <FilterSelect
                    label="Status"
                    value={questionStatusFilter}
                    options={['All', ...RESEARCH_QUESTION_STATUS_OPTIONS]}
                    onChange={(value) =>
                      setQuestionStatusFilter(value as ResearchQuestionStatus | 'All')
                    }
                  />
                </FilterToolbar>
              }
              records={filteredQuestions.map((question) => ({
                id: question.id,
                title: labelForQuestion(question),
                meta: question.status,
                body: question.answer || question.notes,
              }))}
              selectedId={selectedQuestionId}
              onSelect={setSelectedQuestionId}
            />
            <DetailShell
              title={selectedQuestion ? labelForQuestion(selectedQuestion) : 'No question selected'}
              subtitle="Saved questions are manual and source-grounded now, but shaped for later AI retrieval."
              onDelete={
                selectedQuestion
                  ? async () => {
                      if (!confirm('Delete this saved question?')) return;
                      await removeQuestion(selectedQuestion.id);
                    }
                  : undefined
              }
            >
              {selectedQuestion ? (
                <div className="space-y-4">
                  <TextAreaField
                    label="Question"
                    value={selectedQuestion.question}
                    rows={3}
                    onChange={(value) =>
                      updateQuestion(selectedQuestion.id, { question: value })
                    }
                  />
                  <SelectField<ResearchQuestionStatus>
                    label="Status"
                    value={selectedQuestion.status}
                    options={RESEARCH_QUESTION_STATUS_OPTIONS}
                    onChange={(value) =>
                      updateQuestion(selectedQuestion.id, { status: value })
                    }
                  />
                  <TextAreaField
                    label="Answer / Working Notes"
                    value={selectedQuestion.answer}
                    rows={6}
                    placeholder="Save the cited answer or the current working answer here."
                    onChange={(value) =>
                      updateQuestion(selectedQuestion.id, { answer: value })
                    }
                  />
                  <LinkCheckboxes
                    title="Linked Sources"
                    ids={selectedQuestion.sourceIds}
                    options={sourceOptions}
                    onChange={(sourceIds) =>
                      updateQuestion(selectedQuestion.id, { sourceIds })
                    }
                  />
                  <LinkCheckboxes
                    title="Linked Formulas"
                    ids={selectedQuestion.formulaIds}
                    options={formulaOptions}
                    onChange={(formulaIds) =>
                      updateQuestion(selectedQuestion.id, { formulaIds })
                    }
                  />
                  <LinkCheckboxes
                    title="Linked Project Records"
                    ids={selectedQuestion.projectRecordIds}
                    options={projectOptions}
                    onChange={(projectRecordIds) =>
                      updateQuestion(selectedQuestion.id, { projectRecordIds })
                    }
                  />
                  <TextAreaField
                    label="Notes"
                    value={selectedQuestion.notes}
                    rows={4}
                    onChange={(value) =>
                      updateQuestion(selectedQuestion.id, { notes: value })
                    }
                  />
                </div>
              ) : (
                <EmptyDetail message="Add or select a saved question to begin." />
              )}
            </DetailShell>
          </div>
        )}

        {section === 'imports' && (
          <div className="grid min-h-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-4 border-b border-ledger-line bg-ledger space-y-3">
                <div>
                  <div className="text-sm font-semibold text-ink">RRC Data Imports</div>
                  <div className="text-xs text-ink-light">
                    Advanced staging for official RRC downloads and selected decoders.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCategory(option)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        category === option
                          ? 'bg-leather text-parchment'
                          : 'bg-parchment text-ink-light border border-ledger-line hover:text-ink'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {filteredDatasets.map((dataset) => {
                  const importCount = imports.filter(
                    (researchImport) => researchImport.datasetId === dataset.id
                  ).length;
                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => setSelectedDatasetId(dataset.id)}
                      className={`w-full text-left px-4 py-3 border-b border-ledger-line transition-colors ${
                        selectedDataset?.id === dataset.id ? 'bg-leather/10' : 'hover:bg-ledger'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-ink">{dataset.title}</div>
                        <span className="text-[11px] text-ink-light">{importCount}</span>
                      </div>
                      <div className="text-[11px] text-ink-light mt-1">
                        {dataset.category} • {dataset.decoderStatus}
                      </div>
                      <div className="text-xs text-ink mt-2">{dataset.summary}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-4 border-b border-ledger-line bg-ledger flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-display font-bold text-ink">
                    {selectedDataset?.title ?? 'Data Imports'}
                  </div>
                  <div className="text-xs text-ink-light">
                    {selectedDataset
                      ? `${selectedDataset.formats.join(', ')} • ${selectedDataset.cadence}`
                      : 'Choose a dataset family to stage downloaded files.'}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={!workspaceId}
                    onClick={() => inputRef.current?.click()}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
                  >
                    Import Files
                  </button>
                  <a
                    href={selectedDataset?.officialUrl ?? RRC_DATASETS_PAGE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-ink hover:bg-parchment border border-ledger-line transition-colors"
                  >
                    Open Official Page
                  </a>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                onChange={async (event) => {
                  if (!workspaceId) return;
                  const files = Array.from(event.target.files ?? []);
                  for (const file of files) {
                    const researchImport = createBlankResearchImport(workspaceId, file, {
                      fileName: file.name,
                      mimeType: file.type || 'application/octet-stream',
                      datasetId: selectedDataset?.id ?? null,
                    });
                    await addImport(researchImport);
                    setSelectedImportId(researchImport.id);
                  }
                  event.target.value = '';
                }}
              />

              <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="rounded-xl border border-ledger-line bg-ledger overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-ledger-line">
                    <div className="text-sm font-semibold text-ink">Imported Files</div>
                    <div className="text-xs text-ink-light">{visibleImports.length} files</div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {visibleImports.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-ink-light">
                        No files staged for this dataset family.
                      </div>
                    ) : (
                      visibleImports.map((researchImport) => (
                        <button
                          key={researchImport.id}
                          type="button"
                          onClick={() => setSelectedImportId(researchImport.id)}
                          className={`w-full text-left px-4 py-3 border-b border-ledger-line transition-colors ${
                            selectedImport?.id === researchImport.id
                              ? 'bg-leather/10'
                              : 'hover:bg-parchment'
                          }`}
                        >
                          <div className="text-sm font-semibold text-ink">
                            {researchImport.title}
                          </div>
                          <div className="text-[11px] text-ink-light mt-1">
                            {researchImport.fileName}
                          </div>
                          <div className="text-xs text-ink-light mt-2">
                            {getImportStatusLabel(
                              researchImport.id,
                              researchImport.detectedFormat
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-auto">
                  {selectedImport ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="text-lg font-display font-bold text-ink">
                              {importMetadataDraft?.title || selectedImport.title}
                            </div>
                            <div className="text-xs text-ink-light break-all">
                              {selectedImport.fileName}
                            </div>
                            <div className="text-xs text-ink-light">
                              {getImportStatusLabel(
                                selectedImport.id,
                                selectedImport.detectedFormat
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewImportId(selectedImport.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadBlob(selectedImport.blob, selectedImport.fileName)
                              }
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Delete this imported research file?')) return;
                                await removeImport(selectedImport.id);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <FormField
                            label="Title"
                            value={importMetadataDraft?.title ?? ''}
                            onChange={(value) => setImportMetadataField('title', value)}
                          />
                          <div>
                            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                              Dataset Family
                            </label>
                            <select
                              value={importMetadataDraft?.datasetId ?? ''}
                              onChange={(event) =>
                                setImportMetadataField('datasetId', event.target.value || null)
                              }
                              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
                            >
                              {importMetadataDraft?.datasetId === null && (
                                <option value="">Unassigned legacy import</option>
                              )}
                              {importDatasetOptions.map((dataset) => (
                                <option key={dataset.id} value={dataset.id}>
                                  {dataset.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <TextAreaField
                          label="Notes"
                          value={importMetadataDraft?.notes ?? ''}
                          rows={5}
                          placeholder="What this file is, how trustworthy it is, and what decode/manual work is still needed."
                          onChange={(value) => setImportMetadataField('notes', value)}
                        />

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-ledger-line bg-ledger px-3 py-2">
                          <div className="text-xs text-ink-light">
                            Import edits stay local until you save them.
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!isImportMetadataDirty || isSavingImportMetadata}
                              onClick={resetImportMetadataDraft}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-parchment transition-colors disabled:opacity-50"
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              disabled={!isImportMetadataDirty || isSavingImportMetadata}
                              onClick={() => void handleSaveImportMetadata()}
                              className="px-3 py-1.5 rounded-lg bg-leather text-parchment text-xs font-semibold hover:bg-leather-light transition-colors disabled:opacity-50"
                            >
                              {isSavingImportMetadata ? 'Saving...' : 'Save Details'}
                            </button>
                          </div>
                        </div>

                        {importMetadataSaveError && (
                          <div className="rounded-lg border border-seal/30 bg-seal/5 px-3 py-2 text-sm text-seal">
                            {importMetadataSaveError}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-ledger-line bg-ledger p-4 text-sm text-ink">
                        Data imports are now secondary. Use them when a raw official
                        download needs to support a source, project record, or saved
                        research question.
                      </div>

                      {selectedTextPreviewState.isLoading && (
                        <div className="rounded-xl border border-ledger-line bg-ledger p-4 text-sm text-ink-light">
                          Building a readable table preview for this text file.
                        </div>
                      )}

                      {selectedTextPreviewState.errorMessage && (
                        <div className="rounded-xl border border-seal/30 bg-seal/5 p-4 text-sm text-seal">
                          {selectedTextPreviewState.errorMessage}
                        </div>
                      )}

                      {selectedTextPreviewState.preview && (
                        <RrcDelimitedPreviewTable
                          title="Readable TXT Preview"
                          preview={selectedTextPreviewState.preview}
                          description="LANDroid parsed the selected RRC text file into a table so you can review it without raw delimiter noise."
                        />
                      )}

                      {isPendingDrillingDataset && (
                        <PendingDrillingDecoderPanel
                          decoded={pendingDecodeState.decoded}
                          isLoading={pendingDecodeState.isLoading}
                          errorMessage={pendingDecodeState.errorMessage}
                          selectedImportId={selectedImportId}
                        />
                      )}

                      {isDrillingPermitMasterDataset && (
                        <DrillingPermitMasterDecoderPanel
                          decoded={drillingPermitMasterDecodeState.decoded}
                          isLoading={drillingPermitMasterDecodeState.isLoading}
                          errorMessage={drillingPermitMasterDecodeState.errorMessage}
                          selectedImportId={selectedImportId}
                        />
                      )}

                      {isHorizontalDrillingDataset && (
                        <HorizontalDrillingDecoderPanel
                          decoded={horizontalDrillingDecodeState.decoded}
                          isLoading={horizontalDrillingDecodeState.isLoading}
                          errorMessage={horizontalDrillingDecodeState.errorMessage}
                          selectedImportId={selectedImportId}
                        />
                      )}
                    </div>
                  ) : (
                    <EmptyDetail message="Choose an imported file or import a new one from the selected dataset family." />
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </section>

      {previewImport && (
        <AssetPreviewModal
          fileName={previewImport.fileName}
          mimeType={previewImport.mimeType}
          blob={previewImport.blob}
          onClose={() => setPreviewImportId(null)}
        />
      )}
    </div>
  );
}

function RecordList({
  records,
  selectedId,
  emptyText,
  toolbar,
  onSelect,
}: {
  records: Array<{ id: string; title: string; meta: string; body: string }>;
  selectedId: string | null;
  emptyText: string;
  toolbar?: ReactNode;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
      {toolbar && <div className="border-b border-ledger-line bg-ledger p-3">{toolbar}</div>}
      <div className="flex-1 overflow-auto">
        {records.length === 0 ? (
          <div className="px-4 py-6 text-sm text-ink-light">{emptyText}</div>
        ) : (
          records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onSelect(record.id)}
              className={`w-full text-left px-4 py-3 border-b border-ledger-line transition-colors ${
                selectedId === record.id ? 'bg-leather/10' : 'hover:bg-ledger'
              }`}
            >
              <div className="text-sm font-semibold text-ink">{record.title}</div>
              <div className="mt-1 text-[11px] text-ink-light">{record.meta}</div>
              {record.body && (
                <div className="mt-2 line-clamp-2 text-xs text-ink">{record.body}</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function FilterToolbar({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-xs text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResearchHomeTile({
  title,
  count,
  description,
  actionLabel,
  onOpen,
  onAction,
}: {
  title: string;
  count: number;
  description: string;
  actionLabel: string;
  onOpen: () => void;
  onAction: () => void;
}) {
  return (
    <section className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left hover:text-leather transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="text-xl font-display font-bold text-ink">{count}</div>
        </div>
        <div className="mt-1 text-xs text-ink-light">{description}</div>
      </button>
      <button
        type="button"
        onClick={onAction}
        className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
      >
        {actionLabel}
      </button>
    </section>
  );
}

function SearchResultButton({
  type,
  title,
  meta,
  onClick,
}: {
  type: string;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-left hover:border-leather/40 hover:bg-parchment-dark/30 transition-colors"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-light">
        {type}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1 text-xs text-ink-light">{meta}</div>
    </button>
  );
}

function ReviewQueueRow({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-left hover:border-leather/40 hover:bg-parchment-dark/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-sm font-semibold text-ink">{count}</span>
      </div>
    </button>
  );
}

function LinkedSummary({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: Array<{ label: string; meta: string }>;
}) {
  return (
    <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-light">{emptyText}</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={`${item.meta}-${item.label}`}
              className="rounded-lg border border-ledger-line bg-parchment px-3 py-2"
            >
              <div className="text-sm font-semibold text-ink truncate">{item.label}</div>
              <div className="mt-1 text-[11px] text-ink-light">{item.meta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailShell({
  title,
  subtitle,
  onDelete,
  children,
}: {
  title: string;
  subtitle: string;
  onDelete?: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
      <div className="border-b border-ledger-line bg-ledger px-4 py-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-display font-bold text-ink truncate">{title}</div>
          <div className="text-xs text-ink-light">{subtitle}</div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

function EmptyDetail({ message }: { message: string }) {
  return (
    <div className="h-full rounded-xl border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
      <div className="max-w-lg px-6 text-center">
        <div className="text-xl font-display font-bold text-ink">Nothing selected</div>
        <div className="mt-2 text-sm text-ink-light">{message}</div>
      </div>
    </div>
  );
}
