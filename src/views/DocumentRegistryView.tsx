/**
 * Document Registry — flat document database for the workspace.
 *
 * Runsheet is a saved view (Mineral Title) over this same registry.
 * Project support, GIS/map support, federal reference, leasehold,
 * curative, and research documents live alongside it under their own
 * filing areas with saved-view filters.
 *
 * Out of scope for Phase 7A: OCR, AI document query, Dropbox API auth,
 * ArcGIS attachment import, federal/private math, automatic title
 * updates. The Title-Opinion Packet preview exports a manifest JSON
 * only; ZIP export is a future addition.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import PdfViewerModal from '../components/modals/PdfViewerModal';
import {
  buildPacketManifest,
  buildPacketPreview,
  buildRegistryRows,
  DOCUMENT_KIND_LABELS,
  MISSING_METADATA_LABELS,
  SAVED_VIEWS,
  filterRegistryRows,
  getSavedView,
  type EntityLinkSummary,
  type RegistryDocument,
  type RegistryRow,
  type SavedViewId,
} from '../documents/registry';
import {
  listWorkspaceDocuments,
  updateDocMetadata,
  type DocumentAttachment,
  type DocumentMetadataPatch,
} from '../storage/document-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  DOCUMENT_AREA_LABELS,
  DOCUMENT_AREA_OPTIONS,
  DOCUMENT_KIND_OPTIONS,
  type DocumentArea,
  type DocumentKind,
  type DocumentParties,
} from '../types/document';

type LinkFilter = 'all' | 'linked' | 'unlinked';
type PacketSource = 'filter' | 'selected';

interface MetadataDraft {
  kind: DocumentKind;
  area: DocumentArea;
  displayTitle: string;
  instrumentType: string;
  county: string;
  state: string;
  instrumentDate: string;
  recordingDate: string;
  volume: string;
  page: string;
  instrumentNumber: string;
  grantor: string;
  grantee: string;
  lessor: string;
  lessee: string;
  notes: string;
  sourceRef: string;
}

interface RegistryData {
  documents: RegistryDocument[];
  attachments: DocumentAttachment[];
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

function rowDate(doc: RegistryDocument): string {
  return doc.instrumentDate || doc.recordingDate || doc.createdAt.slice(0, 10);
}

function draftFromRow(row: RegistryRow): MetadataDraft {
  const doc = row.document;
  return {
    kind: doc.kind,
    area: row.area,
    displayTitle: doc.displayTitle ?? '',
    instrumentType: doc.instrumentType ?? '',
    county: doc.county ?? '',
    state: doc.state ?? '',
    instrumentDate: doc.instrumentDate ?? '',
    recordingDate: doc.recordingDate ?? '',
    volume: doc.volume ?? '',
    page: doc.page ?? '',
    instrumentNumber: doc.instrumentNumber ?? '',
    grantor: doc.parties?.grantor ?? '',
    grantee: doc.parties?.grantee ?? '',
    lessor: doc.parties?.lessor ?? '',
    lessee: doc.parties?.lessee ?? '',
    notes: doc.notes ?? '',
    sourceRef: doc.sourceRef ?? '',
  };
}

function patchFromDraft(draft: MetadataDraft): DocumentMetadataPatch {
  const parties: DocumentParties = {};
  if (draft.grantor.trim()) parties.grantor = draft.grantor.trim();
  if (draft.grantee.trim()) parties.grantee = draft.grantee.trim();
  if (draft.lessor.trim()) parties.lessor = draft.lessor.trim();
  if (draft.lessee.trim()) parties.lessee = draft.lessee.trim();
  return {
    kind: draft.kind,
    area: draft.area,
    displayTitle: draft.displayTitle,
    instrumentType: draft.instrumentType,
    county: draft.county,
    state: draft.state,
    instrumentDate: draft.instrumentDate,
    recordingDate: draft.recordingDate,
    volume: draft.volume,
    page: draft.page,
    instrumentNumber: draft.instrumentNumber,
    parties,
    notes: draft.notes,
    sourceRef: draft.sourceRef,
  };
}

function manifestFileName(projectName: string): string {
  const safeName = (projectName || 'workspace').replace(/[^A-Za-z0-9_-]+/g, '-');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safeName}-title-opinion-packet-${stamp}.json`;
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  type?: 'text' | 'date';
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function DocumentRegistryView() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const setView = useUIStore((s) => s.setView);

  const [registryData, setRegistryData] = useState<RegistryData>({
    documents: [],
    attachments: [],
  });
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [savedView, setSavedView] = useState<SavedViewId>('all');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'all'>('all');
  const [tractFilter, setTractFilter] = useState<string | 'all'>('all');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<MetadataDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfViewDocId, setPdfViewDocId] = useState<string | null>(null);
  const [packetSource, setPacketSource] = useState<PacketSource>('filter');

  // Re-fetch when node attachments change so chip writes propagate here.
  const attachmentSignature = useMemo(
    () => nodes.flatMap((n) => n.attachments.map((a) => a.attachmentId)).sort().join('|'),
    [nodes]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listWorkspaceDocuments(workspaceId)
      .then((rows) => {
        if (!alive) return;
        const documents = rows.map((row) => row.document);
        const attachments = rows.flatMap((row) => row.attachments);
        setRegistryData({ documents, attachments });
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(err instanceof Error ? `Load failed: ${err.message}` : 'Load failed.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId, reloadToken, attachmentSignature]);

  const rows = useMemo(
    () =>
      buildRegistryRows({
        documents: registryData.documents,
        attachments: registryData.attachments,
        nodes,
        deskMaps,
      }),
    [registryData, nodes, deskMaps]
  );

  const filteredRows = useMemo(
    () =>
      filterRegistryRows(rows, {
        view: savedView,
        query,
        kind: kindFilter,
        tractId: tractFilter,
        link: linkFilter,
        dateFrom,
        dateTo,
      }),
    [rows, savedView, query, kindFilter, tractFilter, linkFilter, dateFrom, dateTo]
  );

  const activeRow = useMemo(
    () => rows.find((row) => row.document.docId === activeDocId) ?? null,
    [activeDocId, rows]
  );
  const selectedSet = useMemo(() => new Set(selectedDocIds), [selectedDocIds]);

  // Pin selection to a visible filtered row whenever filters change.
  useEffect(() => {
    if (filteredRows.length === 0) return;
    if (!activeDocId || !filteredRows.some((row) => row.document.docId === activeDocId)) {
      setActiveDocId(filteredRows[0].document.docId);
    }
  }, [filteredRows, activeDocId]);

  // Drop selected IDs that are no longer in the registry.
  useEffect(() => {
    setSelectedDocIds((current) =>
      current.filter((docId) => rows.some((row) => row.document.docId === docId))
    );
  }, [rows]);

  // Refresh the inspector draft whenever the active row changes.
  useEffect(() => {
    setDraft(activeRow ? draftFromRow(activeRow) : null);
  }, [activeRow]);

  const tractOptions = useMemo(
    () =>
      deskMaps
        .filter((deskMap) => deskMap.nodeIds.length > 0)
        .map((deskMap) => ({ value: deskMap.id, label: deskMap.name })),
    [deskMaps]
  );

  const packetRows = useMemo(() => {
    if (packetSource === 'selected') {
      const picked = rows.filter((row) => selectedSet.has(row.document.docId));
      return picked.length > 0 ? picked : activeRow ? [activeRow] : [];
    }
    return filteredRows;
  }, [packetSource, rows, selectedSet, filteredRows, activeRow]);

  const packet = useMemo(() => buildPacketPreview(packetRows), [packetRows]);

  const updateDraft = useCallback(
    <K extends keyof MetadataDraft>(key: K, value: MetadataDraft[K]) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    },
    []
  );

  const toggleSelected = useCallback((docId: string) => {
    setSelectedDocIds((current) =>
      current.includes(docId)
        ? current.filter((id) => id !== docId)
        : [...current, docId]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeRow || !draft) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateDocMetadata(activeRow.document.docId, patchFromDraft(draft));
      setStatus('Metadata saved.');
      setReloadToken((t) => t + 1);
    } catch (err) {
      setStatus(err instanceof Error ? `Save failed: ${err.message}` : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [activeRow, draft]);

  const handleManifestDownload = useCallback(() => {
    const manifest = buildPacketManifest(packetRows);
    const payload = {
      project: projectName,
      builtAt: new Date().toISOString(),
      packetSource,
      totalDocs: packet.rows.length,
      totalBytes: packet.totalBytes,
      uniqueHashCount: packet.uniqueHashCount,
      warnings: {
        unlinkedCount: packet.unlinkedCount,
        duplicateCount: packet.duplicateCount,
        missingMetadataCount: packet.missingMetadataCount,
      },
      entries: manifest,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = manifestFileName(projectName);
    a.click();
    URL.revokeObjectURL(url);
  }, [packet, packetRows, packetSource, projectName]);

  const openLinkedNode = useCallback(
    (link: EntityLinkSummary) => {
      if (link.entityKind !== 'node') return;
      setActiveNode(link.entityId);
      setView('chart');
    },
    [setActiveNode, setView]
  );

  const totalSize = useMemo(
    () => rows.reduce((sum, row) => sum + (row.document.byteLength || 0), 0),
    [rows]
  );

  return (
    <div className="flex h-full min-h-0 bg-parchment text-ink">
      {/* Left rail — saved views */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-ledger-line bg-ledger lg:flex">
        <div className="border-b border-ledger-line px-4 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-light">
            Saved Views
          </h3>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2 text-sm" aria-label="Document saved views">
          {SAVED_VIEWS.map((view) => {
            const active = view.id === savedView;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setSavedView(view.id)}
                aria-pressed={active}
                title={view.help}
                className={`mb-1 block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  active
                    ? 'bg-leather text-parchment'
                    : 'text-ink-light hover:bg-parchment-dark hover:text-ink'
                }`}
              >
                <div className="text-sm font-semibold">{view.label}</div>
                <div className={`mt-0.5 truncate text-[11px] ${active ? 'text-parchment/70' : 'text-ink-light'}`}>
                  {view.help}
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Center — header, filters, table */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-ledger-line bg-ledger px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-display font-bold text-ink">Document Registry</h2>
                <span className="rounded-full bg-parchment-dark px-2 py-0.5 text-[11px] font-semibold text-ink-light">
                  {getSavedView(savedView).label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-ink-light">
                <span>{projectName}</span>
                <span>{rows.length} docs · {filteredRows.length} shown</span>
                <span>{registryData.attachments.length} links</span>
                <span>{formatBytes(totalSize)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-light">Packet source:</span>
              <button
                type="button"
                onClick={() => setPacketSource('filter')}
                aria-pressed={packetSource === 'filter'}
                className={`rounded-lg border px-3 py-1.5 font-semibold ${
                  packetSource === 'filter'
                    ? 'border-leather bg-leather text-parchment'
                    : 'border-ledger-line text-leather hover:bg-leather/10'
                }`}
              >
                Current filter
              </button>
              <button
                type="button"
                onClick={() => setPacketSource('selected')}
                aria-pressed={packetSource === 'selected'}
                className={`rounded-lg border px-3 py-1.5 font-semibold ${
                  packetSource === 'selected'
                    ? 'border-leather bg-leather text-parchment'
                    : 'border-ledger-line text-leather hover:bg-leather/10'
                }`}
              >
                Highlighted ({selectedDocIds.length})
              </button>
            </div>
          </div>
        </header>

        {/* Filter row */}
        <div className="border-b border-ledger-line bg-parchment px-4 py-3">
          <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_9rem_11rem_9rem_9rem_9rem]">
            <Field label="Search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, party, vol/page, hash…"
                className="w-full rounded-lg border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
              />
            </Field>
            <Field label="Kind">
              <Select
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
            </Field>
            <Field label="Tract">
              <Select
                value={tractFilter}
                onChange={setTractFilter}
                options={[{ value: 'all', label: 'All tracts' }, ...tractOptions]}
              />
            </Field>
            <Field label="Link">
              <Select<LinkFilter>
                value={linkFilter}
                onChange={setLinkFilter}
                options={[
                  { value: 'all', label: 'All links' },
                  { value: 'linked', label: 'Linked' },
                  { value: 'unlinked', label: 'Unlinked' },
                ]}
              />
            </Field>
            <Field label="From">
              <TextInput type="date" value={dateFrom} onChange={setDateFrom} />
            </Field>
            <Field label="To">
              <TextInput type="date" value={dateTo} onChange={setDateTo} />
            </Field>
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-parchment-dark shadow-sm">
              <tr className="border-b border-ledger-line">
                <th className="w-10 px-3 py-2 text-left">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Document
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Area · Kind
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
                  PDF
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-light">
                    Loading documents…
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-light">
                    {rows.length === 0
                      ? 'No documents yet. Attach a PDF from Desk Map to start the registry.'
                      : 'No documents match this saved view and filter set.'}
                  </td>
                </tr>
              )}
              {!loading && filteredRows.map((row) => {
                const selected = selectedSet.has(row.document.docId);
                const active = activeDocId === row.document.docId;
                return (
                  <tr
                    key={row.document.docId}
                    onClick={() => setActiveDocId(row.document.docId)}
                    className={`cursor-pointer border-b border-ledger-line transition-colors ${
                      active ? 'bg-gold/15' : 'hover:bg-parchment-dark/50'
                    }`}
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(row.document.docId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Highlight ${row.displayTitle}`}
                        className="h-4 w-4 rounded border-ledger-line text-leather focus:ring-leather"
                      />
                    </td>
                    <td className="max-w-[20rem] px-3 py-2 align-top">
                      <div className="truncate font-semibold text-ink" title={row.displayTitle}>
                        {row.displayTitle}
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-ink-light">
                        {row.document.fileName}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-light">
                        {formatBytes(row.document.byteLength)} · {rowDate(row.document)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded bg-ledger px-2 py-1 text-[11px] font-semibold text-ink-light">
                        {DOCUMENT_AREA_LABELS[row.area]}
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
                        {[row.document.county, row.document.instrumentNumber || (row.document.volume && row.document.page ? `${row.document.volume}/${row.document.page}` : '')].filter(Boolean).join(' · ') || 'No county / ref'}
                      </div>
                      <div className="truncate text-ink-light">
                        {[row.document.parties?.grantor, row.document.parties?.grantee].filter(Boolean).join(' → ')
                          || [row.document.parties?.lessor, row.document.parties?.lessee].filter(Boolean).join(' → ')
                          || 'No parties'}
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 align-top text-xs">
                      {row.links.length === 0 ? (
                        <span className="text-amber-800">Unlinked</span>
                      ) : (
                        <>
                          <div className="font-semibold text-ink">
                            {row.links.length} linked
                          </div>
                          <div className="truncate text-ink-light" title={row.links[0].label}>
                            {row.links[0].label}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div className="flex flex-wrap gap-1">
                        {row.missingMetadata.length > 0 && (
                          <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
                            Missing
                          </span>
                        )}
                        {row.duplicateDocIds.length > 0 && (
                          <span className="rounded bg-seal/10 px-2 py-1 text-seal">
                            Duplicate
                          </span>
                        )}
                        {row.missingMetadata.length === 0 && row.duplicateDocIds.length === 0 && (
                          <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">
                            Ready
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfViewDocId(row.document.docId);
                        }}
                        className="rounded-lg border border-ledger-line px-3 py-1.5 text-[11px] font-semibold text-leather hover:bg-leather/10"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Right rail — inspector + packet preview */}
      <aside className="flex w-[27rem] shrink-0 flex-col border-l border-ledger-line bg-ledger">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section className="border-b border-ledger-line pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-display font-bold text-ink">
                  {activeRow?.displayTitle ?? 'No document selected'}
                </h3>
                {activeRow && (
                  <p className="mt-1 break-all font-mono text-[10px] text-ink-light">
                    sha-256 {activeRow.document.contentHash.slice(0, 16)}…
                  </p>
                )}
              </div>
              {activeRow && (
                <button
                  type="button"
                  onClick={() => setPdfViewDocId(activeRow.document.docId)}
                  className="shrink-0 rounded-lg border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10"
                >
                  Open PDF
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
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-leather px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-leather-light disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="space-y-3">
                <Field label="Display title">
                  <TextInput
                    value={draft.displayTitle}
                    onChange={(v) => updateDraft('displayTitle', v)}
                    placeholder={activeRow.document.fileName}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Area">
                    <Select
                      value={draft.area}
                      onChange={(v) => updateDraft('area', v)}
                      options={DOCUMENT_AREA_OPTIONS.map((area) => ({
                        value: area,
                        label: DOCUMENT_AREA_LABELS[area],
                      }))}
                    />
                  </Field>
                  <Field label="Kind">
                    <Select
                      value={draft.kind}
                      onChange={(v) => updateDraft('kind', v)}
                      options={DOCUMENT_KIND_OPTIONS.map((kind) => ({
                        value: kind,
                        label: DOCUMENT_KIND_LABELS[kind],
                      }))}
                    />
                  </Field>
                </div>
                <Field label="Instrument type">
                  <TextInput
                    value={draft.instrumentType}
                    onChange={(v) => updateDraft('instrumentType', v)}
                    placeholder="e.g. Mineral Deed"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="County">
                    <TextInput value={draft.county} onChange={(v) => updateDraft('county', v)} />
                  </Field>
                  <Field label="State">
                    <TextInput value={draft.state} onChange={(v) => updateDraft('state', v)} placeholder="TX" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Volume">
                    <TextInput value={draft.volume} onChange={(v) => updateDraft('volume', v)} />
                  </Field>
                  <Field label="Page">
                    <TextInput value={draft.page} onChange={(v) => updateDraft('page', v)} />
                  </Field>
                  <Field label="Inst. no.">
                    <TextInput
                      value={draft.instrumentNumber}
                      onChange={(v) => updateDraft('instrumentNumber', v)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Instrument date">
                    <TextInput type="date" value={draft.instrumentDate} onChange={(v) => updateDraft('instrumentDate', v)} />
                  </Field>
                  <Field label="Recording date">
                    <TextInput type="date" value={draft.recordingDate} onChange={(v) => updateDraft('recordingDate', v)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Grantor">
                    <TextInput value={draft.grantor} onChange={(v) => updateDraft('grantor', v)} />
                  </Field>
                  <Field label="Grantee">
                    <TextInput value={draft.grantee} onChange={(v) => updateDraft('grantee', v)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Lessor">
                    <TextInput value={draft.lessor} onChange={(v) => updateDraft('lessor', v)} />
                  </Field>
                  <Field label="Lessee">
                    <TextInput value={draft.lessee} onChange={(v) => updateDraft('lessee', v)} />
                  </Field>
                </div>
                <Field label="Source reference">
                  <TextInput
                    value={draft.sourceRef}
                    onChange={(v) => updateDraft('sourceRef', v)}
                    placeholder="Dropbox path, packet label, URL…"
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    value={draft.notes}
                    onChange={(e) => updateDraft('notes', e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-ledger-line bg-parchment px-2 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
                  />
                </Field>
              </div>
              {status && (
                <p className="mt-3 text-xs font-semibold text-ink-light">{status}</p>
              )}
            </section>
          )}

          {activeRow && (
            <section className="border-b border-ledger-line py-4">
              <h4 className="text-sm font-bold text-ink">Linked Entities</h4>
              <div className="mt-2 space-y-2">
                {activeRow.links.length === 0 ? (
                  <p className="text-sm text-ink-light">
                    No attachments yet. Attach this document from a Desk Map card to link it.
                  </p>
                ) : (
                  activeRow.links.map((link) => (
                    <div
                      key={link.attachmentId}
                      className="rounded-lg border border-ledger-line bg-parchment px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{link.label}</div>
                          <div className="mt-1 truncate text-xs text-ink-light">
                            {link.detail || `${link.entityKind} ${link.entityId.slice(0, 8)}…`}
                          </div>
                        </div>
                        {link.entityKind === 'node' && (
                          <button
                            type="button"
                            onClick={() => openLinkedNode(link)}
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

          {activeRow && (activeRow.duplicateDocIds.length > 0 || activeRow.missingMetadata.length > 0) && (
            <section className="border-b border-ledger-line py-4">
              <h4 className="text-sm font-bold text-ink">Warnings</h4>
              {activeRow.duplicateDocIds.length > 0 && (
                <div className="mt-2 rounded-lg border border-seal/30 bg-seal/5 px-3 py-2 text-sm text-seal">
                  Same content hash as {activeRow.duplicateDocIds.length} document
                  {activeRow.duplicateDocIds.length === 1 ? '' : 's'}.
                </div>
              )}
              {activeRow.missingMetadata.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Missing: {activeRow.missingMetadata.map((field) => MISSING_METADATA_LABELS[field]).join(', ')}.
                </div>
              )}
            </section>
          )}

          <section className="py-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-ink">Title-Opinion Packet</h4>
              <button
                type="button"
                onClick={handleManifestDownload}
                disabled={packet.rows.length === 0}
                className="rounded-lg border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10 disabled:opacity-50"
              >
                Manifest JSON
              </button>
            </div>
            <p className="mt-1 text-[11px] text-ink-light">
              Preview only — bundles the {packetSource === 'selected' ? 'highlighted rows' : 'current filter'} into a cover-sheet manifest.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Docs</div>
                <div className="text-lg font-bold">{packet.rows.length}</div>
              </div>
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Total bytes</div>
                <div className="text-lg font-bold">{formatBytes(packet.totalBytes)}</div>
              </div>
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Unique hashes</div>
                <div className="text-lg font-bold">{packet.uniqueHashCount}</div>
              </div>
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Unlinked</div>
                <div className="text-lg font-bold">{packet.unlinkedCount}</div>
              </div>
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Duplicates</div>
                <div className="text-lg font-bold">{packet.duplicateCount}</div>
              </div>
              <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-light">Missing meta</div>
                <div className="text-lg font-bold">{packet.missingMetadataCount}</div>
              </div>
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-ledger-line bg-parchment">
              {packet.rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-ink-light">No documents in this packet.</p>
              ) : (
                <ol className="divide-y divide-ledger-line text-sm">
                  {packet.rows.slice(0, 50).map((row, index) => (
                    <li key={row.document.docId} className="px-3 py-2">
                      <span className="mr-2 font-mono text-xs text-ink-light">
                        {String(index + 1).padStart(2, '0')}.
                      </span>
                      <span className="font-semibold">{row.displayTitle}</span>
                      <span className="ml-2 text-[11px] text-ink-light">
                        {DOCUMENT_AREA_LABELS[row.area]}
                      </span>
                    </li>
                  ))}
                  {packet.rows.length > 50 && (
                    <li className="px-3 py-2 text-[11px] text-ink-light">
                      …and {packet.rows.length - 50} more.
                    </li>
                  )}
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
