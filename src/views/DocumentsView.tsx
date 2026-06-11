import { useCallback, useEffect, useMemo, useState } from 'react';
import PdfViewerModal from '../components/modals/PdfViewerModal';
import Button from '../components/shared/Button';
import UndoRedoControls from '../components/shell/UndoRedoControls';
import {
  DOCUMENT_AREA_LABELS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_REGISTRY_VIEWS,
  buildDocumentRegistryRows,
  buildPacketManifest,
  buildPacketPreview,
  filterDocumentRegistryRows,
  type DocumentRegistryRow,
  type DocumentRegistryViewId,
  type RegistryDocument,
} from '../documents/document-registry';
import {
  listDocumentRegistryData,
  updateDocMetadata,
  type DocumentMetadataPatch,
} from '../storage/document-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../store/write-lease-store';
import {
  DOCUMENT_AREA_OPTIONS,
  DOCUMENT_KIND_OPTIONS,
  DOCUMENT_OCR_STATUS_OPTIONS,
  normalizeDocumentOcrStatus,
  type DocumentArea,
  type DocumentKind,
  type DocumentOcrStatus,
} from '../types/document';

type LinkedStateFilter = 'all' | 'linked' | 'unlinked';
type PacketSource = 'filter' | 'selected' | 'runsheet';

interface RegistryData {
  documents: RegistryDocument[];
  attachments: Awaited<ReturnType<typeof listDocumentRegistryData>>['attachments'];
}

interface MetadataDraft {
  displayTitle: string;
  documentArea: DocumentArea;
  kind: DocumentKind;
  instrumentType: string;
  county: string;
  instrumentNumber: string;
  volume: string;
  page: string;
  effectiveDate: string;
  recordingDate: string;
  grantor: string;
  grantee: string;
  notes: string;
  sourceReference: string;
  ocrStatus: DocumentOcrStatus;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function displayDate(doc: RegistryDocument): string {
  return doc.recordingDate || doc.effectiveDate || doc.createdAt.slice(0, 10);
}

function draftFromRow(row: DocumentRegistryRow): MetadataDraft {
  const doc = row.document;
  return {
    displayTitle: doc.displayTitle ?? row.displayTitle,
    documentArea: row.resolvedArea,
    kind: doc.kind,
    instrumentType: doc.instrumentType ?? '',
    county: doc.county ?? '',
    instrumentNumber: doc.instrumentNumber ?? '',
    volume: doc.volume ?? '',
    page: doc.page ?? '',
    effectiveDate: doc.effectiveDate ?? '',
    recordingDate: doc.recordingDate ?? '',
    grantor: doc.grantor ?? '',
    grantee: doc.grantee ?? '',
    notes: doc.notes ?? '',
    sourceReference: doc.sourceReference ?? '',
    ocrStatus: normalizeDocumentOcrStatus(doc.ocrStatus),
  };
}

function manifestFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `landroid-document-packet-manifest-${stamp}.json`;
}

function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
}: {
  label: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as TValue)}
        className="w-full rounded-md border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full resize-y rounded-md border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export default function DocumentsView() {
  const readOnly = useWorkspaceReadOnly();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const projectName = useWorkspaceStore((state) => state.projectName);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const setActiveNode = useWorkspaceStore((state) => state.setActiveNode);
  const setView = useUIStore((state) => state.setView);

  const [registryData, setRegistryData] = useState<RegistryData>({
    documents: [],
    attachments: [],
  });
  const [viewFilter, setViewFilter] = useState<DocumentRegistryViewId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'all'>('all');
  const [tractFilter, setTractFilter] = useState<string | 'all'>('all');
  const [linkedState, setLinkedState] = useState<LinkedStateFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [packetSource, setPacketSource] = useState<PacketSource>('filter');
  const [pdfViewDocId, setPdfViewDocId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MetadataDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const nodeAttachmentSignature = useMemo(
    () =>
      nodes
        .flatMap((node) =>
          node.attachments.map((attachment) => attachment.attachmentId)
        )
        .join('|'),
    [nodes]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listDocumentRegistryData(workspaceId)
      .then((data) => {
        if (!alive) return;
        setRegistryData(data);
      })
      .catch((error) => {
        if (!alive) return;
        setStatusMessage(
          error instanceof Error
            ? `Document registry failed to load: ${error.message}`
            : 'Document registry failed to load.'
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nodeAttachmentSignature, workspaceId, reloadToken]);

  const rows = useMemo(
    () =>
      buildDocumentRegistryRows({
        documents: registryData.documents,
        attachments: registryData.attachments,
        nodes,
        deskMaps,
      }),
    [deskMaps, nodes, registryData.attachments, registryData.documents]
  );

  const filteredRows = useMemo(
    () =>
      filterDocumentRegistryRows(rows, {
        view: viewFilter,
        searchQuery,
        kind: kindFilter,
        tractId: tractFilter,
        linkedState,
        dateFrom,
        dateTo,
      }),
    [dateFrom, dateTo, kindFilter, linkedState, rows, searchQuery, tractFilter, viewFilter]
  );

  const selectedDocIdSet = useMemo(() => new Set(selectedDocIds), [selectedDocIds]);
  const activeRow = useMemo(
    () => rows.find((row) => row.document.docId === activeDocId) ?? null,
    [activeDocId, rows]
  );

  useEffect(() => {
    setSelectedDocIds((current) =>
      current.filter((docId) => rows.some((row) => row.document.docId === docId))
    );
    if (activeDocId && !rows.some((row) => row.document.docId === activeDocId)) {
      setActiveDocId(null);
    }
  }, [activeDocId, rows]);

  useEffect(() => {
    if (filteredRows.length === 0) return;
    if (
      !activeDocId
      || !filteredRows.some((row) => row.document.docId === activeDocId)
    ) {
      setActiveDocId(filteredRows[0].document.docId);
    }
  }, [activeDocId, filteredRows]);

  useEffect(() => {
    setDraft(activeRow ? draftFromRow(activeRow) : null);
  }, [activeRow]);

  const packetRows = useMemo(() => {
    if (packetSource === 'runsheet') {
      return rows.filter((row) => row.resolvedArea === 'runsheet_mineral_title');
    }
    if (packetSource === 'selected') {
      const selected = rows.filter((row) => selectedDocIdSet.has(row.document.docId));
      if (selected.length > 0) return selected;
      return activeRow ? [activeRow] : [];
    }
    return filteredRows;
  }, [activeRow, filteredRows, packetSource, rows, selectedDocIdSet]);

  const packetPreview = useMemo(() => buildPacketPreview(packetRows), [packetRows]);

  const updateDraft = useCallback(
    <TKey extends keyof MetadataDraft>(key: TKey, value: MetadataDraft[TKey]) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    },
    []
  );

  const toggleSelected = useCallback((docId: string) => {
    setSelectedDocIds((current) =>
      current.includes(docId)
        ? current.filter((candidate) => candidate !== docId)
        : [...current, docId]
    );
  }, []);

  const handleSaveMetadata = useCallback(async () => {
    if (readOnly) return;
    if (!activeRow || !draft) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const patch: DocumentMetadataPatch = { ...draft };
      await updateDocMetadata(activeRow.document.docId, patch);
      setStatusMessage('Metadata saved.');
      setReloadToken((token) => token + 1);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Metadata save failed: ${error.message}`
          : 'Metadata save failed.'
      );
    } finally {
      setSaving(false);
    }
  }, [activeRow, draft, readOnly]);

  const downloadManifest = useCallback(() => {
    const manifest = buildPacketManifest(packetRows);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = manifestFileName();
    anchor.click();
    URL.revokeObjectURL(url);
  }, [packetRows]);

  const tractOptions = useMemo(
    () =>
      deskMaps
        .filter((deskMap) => deskMap.nodeIds.length > 0)
        .map((deskMap) => ({ value: deskMap.id, label: deskMap.name })),
    [deskMaps]
  );

  return (
    <div className="flex h-full min-h-0 bg-parchment text-ink">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-ledger-line bg-parchment-light px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[19px] font-bold leading-tight text-ink">Documents</h2>
              <div className="mt-px truncate text-[11px] text-ink-light">
                {projectName} ·{' '}
                <span className="font-mono text-[10.5px]">
                  {rows.length} docs · {registryData.attachments.length} links ·{' '}
                  {formatBytes(rows.reduce((sum, row) => sum + row.document.byteLength, 0))}
                </span>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <UndoRedoControls variant="secondary" />
              <div
                className="inline-flex gap-0.5 rounded-[9px] bg-[#f1e8d5] p-[3px]"
                title="Which documents the attorney packet builds from"
              >
                {(['filter', 'selected', 'runsheet'] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setPacketSource(source)}
                    aria-pressed={packetSource === source}
                    className={`rounded-[7px] px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                      packetSource === source
                        ? 'bg-parchment-light text-ink shadow-[0_1px_3px_rgba(45,33,20,0.14)]'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    Packet: {source}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-ledger-line bg-parchment-light px-5 pb-3 pt-2.5">
          <div className="scrollbar-hidden flex gap-1.5 overflow-x-auto">
            {DOCUMENT_REGISTRY_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setViewFilter(view.id)}
                aria-pressed={viewFilter === view.id}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                  viewFilter === view.id
                    ? 'border-leather bg-leather text-[#fff6ec]'
                    : 'border-ledger-line text-ink-light hover:bg-parchment-dark hover:text-ink'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2 md:grid-cols-[minmax(12rem,1fr)_9rem_11rem_10rem_9rem_9rem]">
            <label className="block">
              <span className="sr-only">Search documents</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, grantor, grantee, instrument no.…"
                className="w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leather"
              />
            </label>
            <SelectField
              label="Kind"
              value={kindFilter}
              onChange={setKindFilter}
              options={[
                { value: 'all', label: 'All kinds' },
                ...DOCUMENT_KIND_OPTIONS.map((kind) => ({
                  value: kind,
                  label: DOCUMENT_KIND_LABELS[kind],
                })),
              ]}
            />
            <SelectField
              label="Tract"
              value={tractFilter}
              onChange={setTractFilter}
              options={[
                { value: 'all', label: 'All tracts' },
                ...tractOptions,
              ]}
            />
            <SelectField
              label="Link"
              value={linkedState}
              onChange={setLinkedState}
              options={[
                { value: 'all', label: 'All links' },
                { value: 'linked', label: 'Linked' },
                { value: 'unlinked', label: 'Unlinked' },
              ]}
            />
            <TextField label="From" type="date" value={dateFrom} onChange={setDateFrom} />
            <TextField label="To" type="date" value={dateTo} onChange={setDateTo} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-ledger shadow-[0_1px_0_var(--color-ledger-line)]">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Document
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Area
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Metadata
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Links
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Status
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-light">
                    Loading documents...
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-light">
                    No documents match the current view.
                  </td>
                </tr>
              )}
              {!loading && filteredRows.map((row) => {
                const selected = selectedDocIdSet.has(row.document.docId);
                const active = activeDocId === row.document.docId;
                return (
                  <tr
                    key={row.document.docId}
                    onClick={() => setActiveDocId(row.document.docId)}
                    className={`cursor-pointer border-b border-[#f1eada] transition-colors ${
                      active
                        ? 'bg-[#f7efdf] shadow-[inset_2px_0_0_var(--color-leather)]'
                        : 'hover:bg-ledger/60'
                    }`}
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(row.document.docId)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${row.displayTitle}`}
                        className="h-4 w-4 accent-leather"
                      />
                    </td>
                    <td className="max-w-[18rem] px-3 py-2 align-top">
                      <div className="truncate font-semibold text-ink" title={row.displayTitle}>
                        {row.displayTitle}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-ink-light">
                        {row.document.fileName}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-light">
                        {formatBytes(row.document.byteLength)} | {displayDate(row.document)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded bg-ledger px-2 py-1 text-[11px] font-semibold text-ink-light">
                        {DOCUMENT_AREA_LABELS[row.resolvedArea]}
                      </span>
                      <div className="mt-1 text-[11px] text-ink-light">
                        {DOCUMENT_KIND_LABELS[row.document.kind]}
                      </div>
                    </td>
                    <td className="max-w-[18rem] px-3 py-2 align-top text-xs">
                      <div className="truncate">
                        {row.document.instrumentType || DOCUMENT_KIND_LABELS[row.document.kind]}
                      </div>
                      <div className="truncate text-ink-light">
                        {[row.document.county, row.document.instrumentNumber].filter(Boolean).join(' | ') || 'No county/reference'}
                      </div>
                      <div className="truncate text-ink-light">
                        {[row.document.grantor, row.document.grantee].filter(Boolean).join(' to ') || 'No parties'}
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 align-top text-xs">
                      {row.linkedEntities.length > 0 ? (
                        <>
                          <div className="font-semibold text-ink">
                            {row.linkedEntities.length} linked
                          </div>
                          <div className="truncate text-ink-light">
                            {row.linkedEntities[0].label}
                          </div>
                        </>
                      ) : (
                        <span className="text-amber-800">Unlinked</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div className="flex flex-wrap gap-1">
                        {row.missingMetadata.length > 0 && (
                          <span className="rounded-md bg-[#efebe2] px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-ink-light">
                            Missing metadata
                          </span>
                        )}
                        {row.duplicateDocIds.length > 0 && (
                          <span className="rounded-md bg-[#f7e5e3] px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-seal">
                            Duplicate
                          </span>
                        )}
                        {row.needsOcr && (
                          <span className="rounded-md bg-tint-amber px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-tint-amber-ink">
                            Needs OCR
                          </span>
                        )}
                        {row.missingMetadata.length === 0
                          && row.duplicateDocIds.length === 0
                          && !row.needsOcr && (
                            <span className="rounded-md bg-[#e4efe1] px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] text-tint-green-ink">
                              Verified
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPdfViewDocId(row.document.docId);
                        }}
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="flex w-[26rem] shrink-0 flex-col border-l border-ledger-line bg-parchment-light">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section className="border-b border-ledger-line pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-display font-bold text-ink">
                  {activeRow?.displayTitle ?? 'No document selected'}
                </h3>
                {activeRow && (
                  <p className="mt-1 break-all font-mono text-[11px] text-ink-light">
                    {activeRow.document.contentHash || 'No hash'}
                  </p>
                )}
              </div>
              {activeRow && (
                <button
                  type="button"
                  onClick={() => setPdfViewDocId(activeRow.document.docId)}
                  className="shrink-0 rounded-md border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10"
                >
                  PDF
                </button>
              )}
            </div>

            {activeRow && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Size</div>
                  <div className="font-mono">{formatBytes(activeRow.document.byteLength)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-light">Updated</div>
                  <div className="font-mono">{activeRow.document.updatedAt.slice(0, 10)}</div>
                </div>
              </div>
            )}
          </section>

          {activeRow && draft && (
            <section className="border-b border-ledger-line py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-ink">Metadata</h4>
                <Button
                  size="sm"
                  onClick={handleSaveMetadata}
                  disabled={readOnly || saving}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <div className="space-y-3">
                <TextField
                  label="Display title"
                  value={draft.displayTitle}
                  onChange={(value) => updateDraft('displayTitle', value)}
                  disabled={readOnly}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label="Area"
                    value={draft.documentArea}
                    onChange={(value) => updateDraft('documentArea', value)}
                    disabled={readOnly}
                    options={DOCUMENT_AREA_OPTIONS.map((area) => ({
                      value: area,
                      label: DOCUMENT_AREA_LABELS[area],
                    }))}
                  />
                  <SelectField
                    label="Kind"
                    value={draft.kind}
                    onChange={(value) => updateDraft('kind', value)}
                    disabled={readOnly}
                    options={DOCUMENT_KIND_OPTIONS.map((kind) => ({
                      value: kind,
                      label: DOCUMENT_KIND_LABELS[kind],
                    }))}
                  />
                </div>
                <TextField
                  label="Instrument type"
                  value={draft.instrumentType}
                  onChange={(value) => updateDraft('instrumentType', value)}
                  disabled={readOnly}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="County"
                    value={draft.county}
                    onChange={(value) => updateDraft('county', value)}
                    disabled={readOnly}
                  />
                  <TextField
                    label="Instrument no."
                    value={draft.instrumentNumber}
                    onChange={(value) => updateDraft('instrumentNumber', value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Volume"
                    value={draft.volume}
                    onChange={(value) => updateDraft('volume', value)}
                    disabled={readOnly}
                  />
                  <TextField
                    label="Page"
                    value={draft.page}
                    onChange={(value) => updateDraft('page', value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Effective"
                    type="date"
                    value={draft.effectiveDate}
                    onChange={(value) => updateDraft('effectiveDate', value)}
                    disabled={readOnly}
                  />
                  <TextField
                    label="Recorded"
                    type="date"
                    value={draft.recordingDate}
                    onChange={(value) => updateDraft('recordingDate', value)}
                    disabled={readOnly}
                  />
                </div>
                <TextField
                  label="Grantor"
                  value={draft.grantor}
                  onChange={(value) => updateDraft('grantor', value)}
                  disabled={readOnly}
                />
                <TextField
                  label="Grantee / lessor / lessee"
                  value={draft.grantee}
                  onChange={(value) => updateDraft('grantee', value)}
                  disabled={readOnly}
                />
                <TextField
                  label="Source reference"
                  value={draft.sourceReference}
                  onChange={(value) => updateDraft('sourceReference', value)}
                  disabled={readOnly}
                />
                <SelectField
                  label="OCR status"
                  value={draft.ocrStatus}
                  onChange={(value) => updateDraft('ocrStatus', value)}
                  disabled={readOnly}
                  options={DOCUMENT_OCR_STATUS_OPTIONS.map((status) => ({
                    value: status,
                    label: status.replace(/_/g, ' '),
                  }))}
                />
                <TextAreaField
                  label="Notes"
                  value={draft.notes}
                  onChange={(value) => updateDraft('notes', value)}
                  disabled={readOnly}
                />
              </div>
              {statusMessage && (
                <p className="mt-3 text-xs font-semibold text-ink-light">{statusMessage}</p>
              )}
            </section>
          )}

          {activeRow && (
            <section className="border-b border-ledger-line py-4">
              <h4 className="text-sm font-bold text-ink">Linked Entities</h4>
              <div className="mt-2 space-y-2">
                {activeRow.linkedEntities.length === 0 ? (
                  <p className="text-sm text-ink-light">Unlinked</p>
                ) : (
                  activeRow.linkedEntities.map((entity) => (
                    <div
                      key={entity.attachmentId}
                      className="rounded-md border border-ledger-line bg-parchment px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">
                            {entity.label}
                          </div>
                          <div className="mt-1 truncate text-xs text-ink-light">
                            {entity.detail || entity.entityId}
                          </div>
                        </div>
                        {entity.entityKind === 'node' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveNode(entity.entityId);
                              setView('chart');
                            }}
                            className="shrink-0 rounded border border-ledger-line px-2 py-1 text-[11px] font-semibold text-leather hover:bg-leather/10"
                          >
                            Desk Map
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeRow && (
            <section className="border-b border-ledger-line py-4">
              <h4 className="text-sm font-bold text-ink">Duplicate Status</h4>
              {activeRow.duplicateDocIds.length > 0 ? (
                <div className="mt-2 rounded-md border border-seal/30 bg-seal/5 px-3 py-2 text-sm text-seal">
                  Same content hash as {activeRow.duplicateDocIds.length} document
                  {activeRow.duplicateDocIds.length === 1 ? '' : 's'}.
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-light">No duplicate hash match.</p>
              )}
              {activeRow.missingMetadata.length > 0 && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Missing: {activeRow.missingMetadata.join(', ')}
                </div>
              )}
            </section>
          )}

          <section className="py-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-ink">Packet Preview</h4>
              <button
                type="button"
                onClick={downloadManifest}
                disabled={packetPreview.rows.length === 0}
                className="rounded-md border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10 disabled:opacity-50"
              >
                Manifest JSON
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Docs</div>
                <div className="text-lg font-bold">{packetPreview.rows.length}</div>
              </div>
              <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Size</div>
                <div className="text-lg font-bold">{formatBytes(packetPreview.totalBytes)}</div>
              </div>
              <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Missing</div>
                <div className="text-lg font-bold">{packetPreview.missingMetadataCount}</div>
              </div>
              <div className="rounded-md border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Duplicates</div>
                <div className="text-lg font-bold">{packetPreview.duplicateDocCount}</div>
              </div>
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-ledger-line bg-parchment">
              {packetPreview.rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-ink-light">No packet documents.</p>
              ) : (
                <ol className="divide-y divide-ledger-line text-sm">
                  {packetPreview.rows.slice(0, 25).map((row, index) => (
                    <li key={row.document.docId} className="px-3 py-2">
                      <span className="mr-2 font-mono text-xs text-ink-light">
                        {index + 1}.
                      </span>
                      {row.displayTitle}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      </aside>

      {pdfViewDocId && (
        <PdfViewerModal
          docId={pdfViewDocId}
          fileNameHint={rows.find((row) => row.document.docId === pdfViewDocId)?.displayTitle}
          onClose={() => setPdfViewDocId(null)}
        />
      )}
    </div>
  );
}
