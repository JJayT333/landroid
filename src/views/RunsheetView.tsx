/**
 * Runsheet View — chronological instrument ledger (Ledger Refined handoff:
 * Westlaw-docket pattern). Command header, tract pills, kind facet chips with
 * live counts, a dense fraction-safe grid, and a right entry inspector whose
 * derivation panel runs the REAL formula machinery (ofWholeFractionFormula
 * rendered on ink, same content the Formula Tray pins).
 *
 * All original wiring preserved: tract filtering, column sorts, CSV export,
 * and the shared node editor modals. Kind chips, search, and row selection
 * are presentation-only state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/shared/Button';
import Pill from '../components/shared/Pill';
import UndoRedoControls from '../components/shell/UndoRedoControls';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import { ofWholeFractionFormula } from '../components/deskmap/deskmap-formulas';
import {
  FormulaContentBody,
  FormulaTooltip,
} from '../components/leasehold/FormulaTooltip';
import OwnershipNodeEditorModals from '../components/shared/OwnershipNodeEditorModals';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../store/write-lease-store';
import { formatAsFraction } from '../engine/fraction-display';
import { d } from '../engine/decimal';
import { downloadRunsheetCsv } from '../storage/runsheet-export';
import { isNpriNode, type OwnershipNode } from '../types/node';
import type { NodeEditorRoute } from '../utils/node-editor-route';
import { resolveNodeEditorRoute } from '../utils/node-editor-route';

type SortField = 'date' | 'fileDate' | 'instrument' | 'grantor' | 'grantee';
type SortDir = 'asc' | 'desc';
type TractFilter = 'all' | string;
type KindFilter = 'all' | 'deed' | 'lease' | 'probate' | 'doto' | 'npri' | 'support';

function parseDate(s: string): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function sortNodes(nodes: OwnershipNode[], field: SortField, dir: SortDir): OwnershipNode[] {
  const sorted = [...nodes].sort((a, b) => {
    let cmp = 0;
    if (field === 'date' || field === 'fileDate') {
      cmp = parseDate(a[field]) - parseDate(b[field]);
    } else {
      cmp = (a[field] || '').localeCompare(b[field] || '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function formatVolPage(node: OwnershipNode) {
  return node.vol || node.page ? `${node.vol || ''}/${node.page || ''}` : '—';
}

/**
 * Display-only instrument classification for the facet chips (keyword match
 * on the instrument label — never touches math or storage).
 */
function classifyKind(node: OwnershipNode): Exclude<KindFilter, 'all'> {
  if (isLeaseNode(node)) return 'lease';
  if (isNpriNode(node)) return 'npri';
  if (node.type === 'related') return 'support';
  const label = (node.instrument || '').toLowerCase();
  if (label.includes('doto') || label.includes('designation')) return 'doto';
  if (
    label.includes('probate')
    || label.includes('lwt')
    || label.includes('will')
    || label.includes('heirship')
    || label.includes('order')
  ) {
    return 'probate';
  }
  return 'deed';
}

const KIND_CHIPS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deed', label: 'Deeds' },
  { id: 'lease', label: 'Leases' },
  { id: 'probate', label: 'Probate' },
  { id: 'doto', label: 'DOTO' },
  { id: 'npri', label: 'NPRI' },
  { id: 'support', label: 'Support' },
];

const STATUS_TONES: Record<string, string> = {
  'In chain': 'bg-[#e4efe1] text-tint-green-ink',
  Support: 'bg-[#efebe2] text-ink-light',
};

function nodeStatus(node: OwnershipNode): 'In chain' | 'Support' {
  return node.type === 'related' && !isLeaseNode(node) ? 'Support' : 'In chain';
}

function yearOf(node: OwnershipNode): number | null {
  const t = parseDate(node.date || node.fileDate);
  return t ? new Date(t).getFullYear() : null;
}

export default function RunsheetView() {
  const readOnly = useWorkspaceReadOnly();
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const setView = useUIStore((s) => s.setView);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tractFilter, setTractFilter] = useState<TractFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editorRoute, setEditorRoute] = useState<NodeEditorRoute | null>(null);
  const [npriParentId, setNpriParentId] = useState<string | null>(null);
  const [pdfViewDocId, setPdfViewDocId] = useState<string | null>(null);

  const tractOptions = useMemo(
    () =>
      deskMaps
        .filter((deskMap) => deskMap.nodeIds.length > 0)
        .map((deskMap) => ({
          id: deskMap.id,
          label: deskMap.name,
          code: deskMap.code || deskMap.name,
          nodeIds: new Set(deskMap.nodeIds),
        })),
    [deskMaps]
  );

  const tractCodeByNodeId = useMemo(() => {
    const next = new Map<string, string>();
    for (const tract of tractOptions) {
      for (const nodeId of tract.nodeIds) {
        if (!next.has(nodeId)) next.set(nodeId, tract.code);
      }
    }
    return next;
  }, [tractOptions]);

  useEffect(() => {
    if (tractFilter === 'all') return;
    if (!tractOptions.some((option) => option.id === tractFilter)) {
      setTractFilter('all');
    }
  }, [tractFilter, tractOptions]);

  useEffect(() => {
    if (readOnly) {
      setEditorRoute(null);
    }
  }, [readOnly]);

  const tractNodes = useMemo(() => {
    if (tractFilter === 'all') return nodes;
    const tract = tractOptions.find((option) => option.id === tractFilter);
    if (!tract) return nodes;
    return nodes.filter((node) => tract.nodeIds.has(node.id));
  }, [nodes, tractFilter, tractOptions]);

  const kindCounts = useMemo(() => {
    const counts = new Map<KindFilter, number>([['all', tractNodes.length]]);
    for (const node of tractNodes) {
      const kind = classifyKind(node);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return counts;
  }, [tractNodes]);

  const filteredNodes = useMemo(() => {
    let next = tractNodes;
    if (kindFilter !== 'all') {
      next = next.filter((node) => classifyKind(node) === kindFilter);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      next = next.filter((node) =>
        [node.grantor, node.grantee, node.vol, node.page, node.docNo, node.instrument]
          .some((field) => (field || '').toLowerCase().includes(query))
      );
    }
    return next;
  }, [kindFilter, searchQuery, tractNodes]);

  const sorted = useMemo(
    () => sortNodes(filteredNodes, sortField, sortDir),
    [filteredNodes, sortField, sortDir]
  );

  const yearRange = useMemo(() => {
    const years = nodes.map(yearOf).filter((year): year is number => year !== null);
    if (years.length === 0) return null;
    return `${Math.min(...years)}–${Math.max(...years)}`;
  }, [nodes]);

  const selectedNode = useMemo(
    () => sorted.find((node) => node.id === selectedNodeId) ?? sorted[0] ?? null,
    [selectedNodeId, sorted]
  );

  const activeTractLabel =
    tractFilter === 'all'
      ? null
      : tractOptions.find((option) => option.id === tractFilter)?.label ?? null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const arrow = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ▴' : ' ▾') : '';

  const handleExport = () => {
    downloadRunsheetCsv(sorted, {
      projectName,
      tractLabel: activeTractLabel,
    });
  };

  const handleOpenEditor = useCallback(
    (node: OwnershipNode) => {
      if (readOnly) return;
      const route = resolveNodeEditorRoute(node);
      if (!route) {
        return;
      }

      setActiveNode(node.id);
      setEditorRoute(route);
    },
    [readOnly, setActiveNode]
  );

  const handleOpenOnDeskMap = useCallback(
    (node: OwnershipNode) => {
      const tract = deskMaps.find((deskMap) => deskMap.nodeIds.includes(node.id));
      if (tract) setActiveDeskMap(tract.id);
      setActiveNode(node.id);
      setView('chart');
    },
    [deskMaps, setActiveDeskMap, setActiveNode, setView]
  );

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-display font-bold text-ink">No instruments yet</h2>
          <p className="text-ink-light text-sm">Build a title chain in the Desk Map to see the runsheet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-parchment text-ink">
      {/* Command header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ledger-line bg-parchment-light px-5 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] font-bold leading-tight text-ink">Runsheet</h1>
          <div className="mt-px truncate text-[11px] text-ink-light">
            {projectName}
            {activeTractLabel ? ` · ${activeTractLabel}` : ''} ·{' '}
            <span className="font-mono text-[10.5px]">
              {tractNodes.length} instruments{yearRange ? ` · ${yearRange}` : ''}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <UndoRedoControls variant="secondary" />
          <Button variant="secondary" size="sm" onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </header>

      {/* Tract pills + kind chips + search */}
      <div className="shrink-0 border-b border-ledger-line bg-parchment-light px-5 pb-3 pt-2.5">
        <div className="scrollbar-hidden flex items-center gap-2 overflow-x-auto">
          <span className="mr-0.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-ink-light">
            Tract
          </span>
          <TractPill
            label="All"
            active={tractFilter === 'all'}
            onClick={() => setTractFilter('all')}
          />
          {tractOptions.map((tract) => (
            <TractPill
              key={tract.id}
              label={tract.label}
              active={tractFilter === tract.id}
              onClick={() => setTractFilter(tract.id)}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="scrollbar-hidden flex gap-1.5 overflow-x-auto">
            {KIND_CHIPS.map((chip) => {
              const count = kindCounts.get(chip.id) ?? 0;
              if (chip.id !== 'all' && count === 0) return null;
              const active = kindFilter === chip.id;
              return (
                <Pill
                  key={chip.id}
                  active={active}
                  onClick={() => setKindFilter(chip.id)}
                >
                  {chip.label}
                  <span className="font-mono text-[9.5px] opacity-75">{count}</span>
                </Pill>
              );
            })}
          </div>
          <label className="ml-auto block w-56 shrink-0">
            <span className="sr-only">Search instruments</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Party, vol/page, file no.…"
              className="w-full rounded-lg border border-ledger-line bg-white px-2.5 py-[5px] text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leather"
            />
          </label>
        </div>
      </div>

      {/* Ledger grid + inspector */}
      <div className="flex min-h-0 flex-1">
        <div className="scrollbar-hidden flex min-w-0 flex-1 flex-col overflow-x-auto bg-white">
          <div className="grid min-w-[880px] grid-cols-[34px_88px_minmax(170px,0.9fr)_minmax(240px,1.4fr)_140px_56px_84px] items-center gap-x-2.5 border-b border-ledger-line bg-ledger px-4 py-2">
            <HeaderCell label="#" />
            <SortHeader label="Date" field="date" current={sortField} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Instrument · Vol/Pg" field="instrument" current={sortField} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Grantor → Grantee" field="grantor" current={sortField} onClick={handleSort} arrow={arrow} />
            <HeaderCell label="Interest" />
            <HeaderCell label="Tract" />
            <HeaderCell label="Status" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-ink-light">
                No instruments match the current filters.
              </div>
            )}
            {sorted.map((node, index) => {
              const selected = selectedNode?.id === node.id;
              const status = nodeStatus(node);
              const interest = node.type === 'related' && !isLeaseNode(node)
                ? null
                : formatAsFraction(d(node.initialFraction));
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`grid min-w-[880px] cursor-pointer grid-cols-[34px_88px_minmax(170px,0.9fr)_minmax(240px,1.4fr)_140px_56px_84px] items-center gap-x-2.5 border-b border-[#f1eada] px-4 py-2 transition-colors ${
                    selected
                      ? 'bg-[#f7efdf] shadow-[inset_2px_0_0_var(--color-leather)]'
                      : 'hover:bg-ledger/60'
                  }`}
                >
                  <div className="font-mono text-[10px] text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="whitespace-nowrap font-mono text-[10.5px] text-ink">
                    {node.date || node.fileDate || '—'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-ink">
                      {node.instrument || 'Document'}
                    </div>
                    <div className="mt-px whitespace-nowrap font-mono text-[9.5px] text-ink-faint">
                      {formatVolPage(node)}
                      {node.docNo ? ` · ${node.docNo}` : ''}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs text-ink">{node.grantor || '—'}</div>
                    <div className="mt-px truncate text-[11px] text-ink-light">
                      → {node.grantee || '—'}
                    </div>
                  </div>
                  <div className="whitespace-nowrap font-mono text-[11px] font-semibold tabular-nums text-ink">
                    {interest ? (
                      <FormulaTooltip content={ofWholeFractionFormula(node)}>
                        {interest}
                      </FormulaTooltip>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-soft">
                    {tractCodeByNodeId.get(node.id) ?? '—'}
                  </div>
                  <div>
                    <span
                      className={`inline-block whitespace-nowrap rounded-md px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.04em] ${STATUS_TONES[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 border-t border-ledger-line bg-ledger px-4 py-2">
            <div className="text-[11px] text-ink-light">
              Showing <span className="font-mono">{sorted.length}</span> of{' '}
              <span className="font-mono">{tractNodes.length}</span> instruments
              {activeTractLabel ? ` · ${activeTractLabel}` : ''}
            </div>
          </div>
        </div>

        {/* Entry inspector */}
        <aside className="flex w-[296px] shrink-0 flex-col border-l border-ledger-line bg-parchment-light">
          {selectedNode ? (
            <>
              <div className="border-b border-ledger-line px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block rounded-md px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.04em] ${STATUS_TONES[nodeStatus(selectedNode)]}`}
                  >
                    {nodeStatus(selectedNode)}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {selectedNode.date || selectedNode.fileDate || '—'}
                  </span>
                </div>
                <div className="mt-1.5 font-display text-[15px] font-bold leading-[1.35] text-ink">
                  {selectedNode.instrument || 'Document'}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-light">
                  {formatVolPage(selectedNode)}
                  {selectedNode.docNo ? ` · ${selectedNode.docNo}` : ''}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="grid gap-2">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-light">Grantor</div>
                    <div className="mt-0.5 text-xs font-semibold text-ink">{selectedNode.grantor || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-light">Grantee</div>
                    <div className="mt-0.5 text-xs font-semibold text-ink">{selectedNode.grantee || '—'}</div>
                  </div>
                </div>
                <div className="my-3 h-px bg-ledger-line" />
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-light">
                  Interest Conveyed
                </div>
                {selectedNode.type !== 'related' || isLeaseNode(selectedNode) ? (
                  <div className="rounded-[11px] bg-ink px-3 py-2.5 text-[#efe6d4]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-semibold">Granted</span>
                      <span className="whitespace-nowrap font-mono text-xs font-semibold text-[#dcc372]">
                        {formatAsFraction(d(selectedNode.initialFraction))}
                      </span>
                    </div>
                    <div className="mt-2 text-[8px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                      Derivation
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed">
                      <FormulaContentBody content={ofWholeFractionFormula(selectedNode)} pinned />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[9px] border border-ledger-line bg-white px-2.5 py-2 text-[11px] text-ink-light">
                    No interest conveyed (support instrument).
                  </div>
                )}
                {selectedNode.attachments.length > 0 && (
                  <>
                    <div className="mb-1.5 mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-light">
                      Linked Document{selectedNode.attachments.length === 1 ? '' : 's'}
                    </div>
                    <div className="grid gap-1.5">
                      {selectedNode.attachments.slice(0, 4).map((attachment) => (
                        <button
                          key={attachment.attachmentId}
                          type="button"
                          onClick={() => setPdfViewDocId(attachment.docId)}
                          className="flex items-center gap-2 rounded-[9px] border border-ledger-line bg-white px-2.5 py-2 text-left transition-colors hover:bg-parchment-dark"
                        >
                          <span className="shrink-0 rounded-[5px] border border-line-strong bg-ledger px-1.5 py-0.5 font-mono text-[9px] font-semibold text-leather">
                            PDF
                          </span>
                          <span className="truncate font-mono text-[10px] text-ink-soft">
                            {attachment.fileName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {(selectedNode.remarks || selectedNode.landDesc) && (
                  <>
                    <div className="mb-1.5 mt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-light">
                      Abstractor Notes
                    </div>
                    <div className="rounded-[9px] border border-ledger-line bg-white px-2.5 py-2 text-[11.5px] leading-[1.55] text-ink-soft">
                      {selectedNode.remarks && <div>{selectedNode.remarks}</div>}
                      {selectedNode.landDesc && (
                        <div className={selectedNode.remarks ? 'mt-1.5' : ''}>
                          {selectedNode.landDesc}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 border-t border-ledger-line px-4 py-3">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenOnDeskMap(selectedNode)}
                >
                  Open on Desk Map
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={readOnly}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  onClick={() => handleOpenEditor(selectedNode)}
                >
                  {isLeaseNode(selectedNode) ? 'Edit Lease' : 'Edit Entry'}
                </Button>
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-ink-light">
              Select an instrument to inspect it.
            </div>
          )}
        </aside>
      </div>

      <OwnershipNodeEditorModals
        route={editorRoute}
        onSetRoute={setEditorRoute}
        npriParentId={npriParentId}
        onSetNpriParentId={setNpriParentId}
        pdfViewDocId={pdfViewDocId}
        onSetPdfViewDocId={setPdfViewDocId}
      />
    </div>
  );
}

function TractPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? 'bg-leather font-semibold text-[#fff6ec] shadow-[0_1px_3px_rgba(45,33,20,0.18)]'
          : 'font-medium text-ink-light hover:bg-parchment-dark hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function HeaderCell({ label }: { label: string }) {
  return (
    <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-light">
      {label}
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  onClick,
  arrow,
}: {
  label: string;
  field: SortField;
  current: SortField;
  onClick: (f: SortField) => void;
  arrow: (f: SortField) => string;
}) {
  return (
    <button
      type="button"
      className={`select-none text-left text-[9.5px] font-bold uppercase tracking-[0.08em] transition-colors hover:text-leather ${
        current === field ? 'text-leather' : 'text-ink-light'
      }`}
      onClick={() => onClick(field)}
    >
      {label}
      {arrow(field)}
    </button>
  );
}
