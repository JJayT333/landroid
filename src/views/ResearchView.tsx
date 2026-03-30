import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  PENDING_DRILLING_FILE_SPECS,
  PENDING_DRILLING_DATASET_ID,
  decodePendingDrillingImports,
  detectPendingDrillingFileKind,
  type PendingDrillingDecodeResult,
} from '../research/rrc-pending-drilling';
import { useResearchStore } from '../store/research-store';
import {
  RRC_DATASET_CATEGORIES,
  RRC_DATASETS_PAGE_URL,
  createBlankResearchImport,
  getDecoderStatusForFormat,
  type ResearchImportFormat,
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

const ALL_CATEGORIES = 'All';
type DatasetCategoryFilter =
  | (typeof RRC_DATASET_CATEGORIES)[number]
  | typeof ALL_CATEGORIES;
const CATEGORY_OPTIONS: DatasetCategoryFilter[] = [
  ALL_CATEGORIES,
  ...RRC_DATASET_CATEGORIES,
];

export default function ResearchView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceId = useResearchStore((state) => state.workspaceId);
  const imports = useResearchStore((state) => state.imports);
  const addImport = useResearchStore((state) => state.addImport);
  const updateImport = useResearchStore((state) => state.updateImport);
  const removeImport = useResearchStore((state) => state.removeImport);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DatasetCategoryFilter>(ALL_CATEGORIES);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    RRC_DATASET_CATALOG[0]?.id ?? null
  );
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [previewImportId, setPreviewImportId] = useState<string | null>(null);
  const [pendingDecodeState, setPendingDecodeState] = useState<{
    decoded: PendingDrillingDecodeResult | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({
    decoded: null,
    isLoading: false,
    errorMessage: null,
  });
  const [drillingPermitMasterDecodeState, setDrillingPermitMasterDecodeState] = useState<{
    decoded: DrillingPermitMasterDecodeResult | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({
    decoded: null,
    isLoading: false,
    errorMessage: null,
  });
  const [horizontalDrillingDecodeState, setHorizontalDrillingDecodeState] = useState<{
    decoded: HorizontalDrillingDecodeResult | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({
    decoded: null,
    isLoading: false,
    errorMessage: null,
  });
  const [selectedTextPreviewState, setSelectedTextPreviewState] = useState<{
    preview: ReturnType<typeof buildRrcDelimitedTextPreview> | null;
    isLoading: boolean;
    errorMessage: string | null;
  }>({
    preview: null,
    isLoading: false,
    errorMessage: null,
  });
  const [importMetadataDraft, setImportMetadataDraft] = useState<ReturnType<
    typeof createResearchImportMetadataDraft
  > | null>(null);
  const [importMetadataSaveError, setImportMetadataSaveError] = useState<string | null>(null);
  const [isSavingImportMetadata, setIsSavingImportMetadata] = useState(false);
  const pendingDatasetJumpRef = useRef<{
    importId: string;
    datasetId: string;
  } | null>(null);
  const lastPendingDecodeFingerprintRef = useRef<string | null>(null);
  const lastDrillingPermitMasterDecodeFingerprintRef = useRef<string | null>(null);
  const lastHorizontalDrillingDecodeFingerprintRef = useRef<string | null>(null);

  const filteredDatasets = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return RRC_DATASET_CATALOG.filter((dataset) => {
      const matchesCategory = category === ALL_CATEGORIES || dataset.category === category;
      const matchesSearch =
        lowerSearch.length === 0 ||
        dataset.title.toLowerCase().includes(lowerSearch) ||
        dataset.summary.toLowerCase().includes(lowerSearch) ||
        dataset.notes.toLowerCase().includes(lowerSearch);
      return matchesCategory && matchesSearch;
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

  const selectedImport =
    imports.find((researchImport) => researchImport.id === selectedImportId) ??
    null;
  const previewImport =
    imports.find((researchImport) => researchImport.id === previewImportId) ?? null;
  const isPendingDrillingDataset =
    selectedDataset?.id === PENDING_DRILLING_DATASET_ID;
  const isDrillingPermitMasterDataset =
    typeof selectedDataset?.id === 'string' &&
    DRILLING_PERMIT_MASTER_DATASET_IDS.includes(
      selectedDataset.id as (typeof DRILLING_PERMIT_MASTER_DATASET_IDS)[number]
    );
  const isHorizontalDrillingDataset =
    selectedDataset?.id === HORIZONTAL_DRILLING_DATASET_ID;
  const pendingDecodeFingerprint = useMemo(
    () =>
      buildResearchImportFileFingerprint(
        visibleImports
          .filter((researchImport) =>
            Boolean(detectPendingDrillingFileKind(researchImport.fileName))
          )
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
      setPendingDecodeState({
        decoded: null,
        isLoading: false,
        errorMessage: null,
      });
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
      .then((sources) => {
        if (cancelled) return;
        setPendingDecodeState({
          decoded: decodePendingDrillingImports(sources),
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
      .then((sources) => {
        if (cancelled) return;
        setDrillingPermitMasterDecodeState({
          decoded: decodeDrillingPermitMasterImports(sources),
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
      .then((sources) => {
        if (cancelled) return;
        setHorizontalDrillingDecodeState({
          decoded: decodeHorizontalDrillingImports(sources),
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

  const pendingFileSummariesByImportId = useMemo(
    () =>
      new Map(
        (pendingDecodeState.decoded?.parsedFiles ?? [])
          .filter(
            (parsedFile): parsedFile is typeof parsedFile & { importId: string } =>
              typeof parsedFile.importId === 'string'
          )
          .map((parsedFile) => [parsedFile.importId, parsedFile])
      ),
    [pendingDecodeState.decoded]
  );
  const drillingPermitMasterFileSummariesByImportId = useMemo(
    () =>
      new Map(
        (drillingPermitMasterDecodeState.decoded?.parsedFiles ?? [])
          .filter(
            (parsedFile): parsedFile is typeof parsedFile & { importId: string } =>
              typeof parsedFile.importId === 'string'
          )
          .map((parsedFile) => [parsedFile.importId, parsedFile])
      ),
    [drillingPermitMasterDecodeState.decoded]
  );
  const horizontalDrillingFileSummariesByImportId = useMemo(
    () =>
      new Map(
        (horizontalDrillingDecodeState.decoded?.parsedFiles ?? [])
          .filter(
            (parsedFile): parsedFile is typeof parsedFile & { importId: string } =>
              typeof parsedFile.importId === 'string'
          )
          .map((parsedFile) => [parsedFile.importId, parsedFile])
      ),
    [horizontalDrillingDecodeState.decoded]
  );

  function getImportStatusLabel(
    importId: string,
    detectedFormat: ResearchImportFormat
  ) {
    if (isHorizontalDrillingDataset) {
      const summary = horizontalDrillingFileSummariesByImportId.get(importId);
      if (!summary) {
        return `${detectedFormat} • ${getDecoderStatusForFormat(detectedFormat)}`;
      }
      if (summary.recognized) {
        return `${detectedFormat} • Horizontal Decoder • ${summary.recordCount} rows`;
      }
      return `${detectedFormat} • Staged only`;
    }
    if (isDrillingPermitMasterDataset) {
      const summary = drillingPermitMasterFileSummariesByImportId.get(importId);
      if (!summary) {
        return `${detectedFormat} • ${getDecoderStatusForFormat(detectedFormat)}`;
      }
      if (summary.recognized) {
        return `${detectedFormat} • Permit Master Decoder • ${summary.recordCount} records`;
      }
      if (summary.ignoredRecordTypes.length > 0) {
        return `${detectedFormat} • Companion segments only`;
      }
      return `${detectedFormat} • Staged only`;
    }
    if (!isPendingDrillingDataset) {
      return `${detectedFormat} • ${getDecoderStatusForFormat(detectedFormat)}`;
    }
    const summary = pendingFileSummariesByImportId.get(importId);
    if (!summary) {
      return `${detectedFormat} • ${getDecoderStatusForFormat(detectedFormat)}`;
    }
    if (summary.fileKind) {
      return `${detectedFormat} • Pending Permit Decoder • ${summary.recordCount} rows`;
    }
    return `${detectedFormat} • Staged only`;
  }

  const setImportMetadataField = (
    field: keyof NonNullable<typeof importMetadataDraft>,
    value: string | null
  ) => {
    setImportMetadataDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
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

  return (
    <div className="h-full grid gap-4 p-4 bg-parchment-dark/30 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-4 border-b border-ledger-line bg-ledger space-y-3">
          <div>
            <div className="text-lg font-display font-bold text-ink">Research</div>
            <div className="text-xs text-ink-light">
              Official RRC dataset families, import staging, and decoder triage.
            </div>
          </div>

          <FormField
            label="Search Datasets"
            value={search}
            onChange={setSearch}
          />

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

          <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-[11px] text-ink-light">
            The official RRC page mixes CSV, JSON, ASCII, shapefiles, TIFF/PDF, and a
            large amount of EBCDIC. LANDroid can stage all of them now, but only some
            formats are immediately preview-friendly in-browser.
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
                  {dataset.category} • {dataset.cadence}
                </div>
                <div className="text-xs text-ink mt-2">{dataset.summary}</div>
              </button>
            );
          })}
          {filteredDatasets.length === 0 && (
            <div className="px-4 py-6 text-sm text-ink-light">
              No datasets match the current search and category filters.
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 grid gap-4 grid-rows-[auto_minmax(0,1fr)]">
        <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm p-4 space-y-4">
          {selectedDataset ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-xl font-display font-bold text-ink">
                      {selectedDataset.title}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-parchment-dark/40 text-[11px] font-semibold text-ink-light border border-ledger-line">
                      {selectedDataset.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        selectedDataset.decoderStatus === 'Preview Ready'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedDataset.decoderStatus === 'Structured Later'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-seal/10 text-seal'
                      }`}
                    >
                      {selectedDataset.decoderStatus}
                    </span>
                  </div>
                  <div className="text-sm text-ink">{selectedDataset.summary}</div>
                  <div className="text-xs text-ink-light">
                    Formats: {selectedDataset.formats.join(', ')} • cadence:{' '}
                    {selectedDataset.cadence}
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
                    href={selectedDataset.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-ink hover:bg-ledger border border-ledger-line transition-colors"
                  >
                    Open Official Page
                  </a>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                    What LANDroid can do now
                  </div>
                    <div className="text-sm text-ink mt-2">
                      {selectedDataset.id === PENDING_DRILLING_DATASET_ID
                        ? 'Store, preview, and decode the core permit, wellbore, and lat/long files immediately.'
                        : isHorizontalDrillingDataset
                          ? 'Store the ASCII file now and decode the horizontal permit rows into a readable preview immediately.'
                        : isDrillingPermitMasterDataset
                          ? 'Store the master files now and decode the core fixed-width permit, status, and coordinate records immediately.'
                          : selectedDataset.decoderStatus === 'Preview Ready'
                            ? 'Store, preview, tag, and review these files immediately.'
                            : selectedDataset.decoderStatus === 'Structured Later'
                              ? 'Store and organize the files now; parser-ready work can follow in a later phase.'
                              : 'Store and tag the raw files now, but full decoding needs a dataset-specific parser or field manual.'}
                    </div>
                </div>
                <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                    Import Strategy
                  </div>
                  <div className="text-sm text-ink mt-2">
                    Import the downloaded file exactly as received, keep the official PDF
                    manual beside it when possible, and let LANDroid become the workspace
                    where raw files and decoded understanding meet.
                  </div>
                </div>
                <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                    Official Notes
                  </div>
                  <div className="text-sm text-ink mt-2">{selectedDataset.notes}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-ink-light">
              Choose a dataset family on the left to start building out the RRC research
              workspace.
            </div>
          )}

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
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-ledger-line bg-ledger flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">Imported Files</div>
                <div className="text-xs text-ink-light">
                  {selectedDataset
                    ? `Showing files linked to ${selectedDataset.title}`
                    : 'Showing all imported research files'}
                </div>
              </div>
              <div className="text-xs text-ink-light">{visibleImports.length} files</div>
            </div>

            <div className="flex-1 overflow-auto">
              {visibleImports.length === 0 ? (
                <div className="px-4 py-6 text-sm text-ink-light">
                  No imports yet for this dataset family. Use `Import Files` to stage the
                  raw downloads you want to work from.
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
                        : 'hover:bg-ledger'
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

          <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-ledger-line bg-ledger">
              <div className="text-sm font-semibold text-ink">Imported File Detail</div>
              <div className="text-xs text-ink-light">
                Preview-friendly formats can open here now. Legacy formats still benefit
                from being staged and documented in one place.
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
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
                            if (!confirm('Delete this imported research file?')) {
                              return;
                            }
                            await removeImport(selectedImport.id);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-ledger-line bg-ledger px-3 py-2">
                      <div className="text-xs text-ink-light">
                        Changes stay local until you save them.
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
                          onClick={() => {
                            void handleSaveImportMetadata();
                          }}
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
                            <option value="">
                              Unassigned legacy import
                            </option>
                          )}
                          {importDatasetOptions.map((dataset) => (
                            <option key={dataset.id} value={dataset.id}>
                              {dataset.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                        Notes
                      </label>
                      <textarea
                        value={importMetadataDraft?.notes ?? ''}
                        onChange={(event) =>
                          setImportMetadataField('notes', event.target.value)
                        }
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
                        placeholder="What this file is, how trustworthy it is, and what decode/manual work is still needed."
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                      Why this matters
                    </div>
                    <div className="text-sm text-ink">
                      Even when the file is EBCDIC or another hard-to-read legacy format,
                      having it staged here keeps the raw source, your notes, and the
                      dataset family together while we decide which decoders are worth
                      building next.
                    </div>
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
                      description="LANDroid parsed the selected RRC text file into a table so you can review it without reading raw delimiter noise."
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
                <div className="h-full rounded-xl border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="text-xl font-display font-bold text-ink">
                      No imported file selected
                    </div>
                    <div className="text-sm text-ink-light mt-2">
                      Choose a dataset family, import a file, and start building your own
                      RRC research workspace from there.
                    </div>
                    <a
                      href={RRC_DATASETS_PAGE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-4 px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                    >
                      Open Official RRC Downloads Page
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
