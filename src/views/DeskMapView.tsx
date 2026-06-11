/**
 * Desk Map View — the primary working area for building title chains.
 *
 * Renders the ownership tree as a hierarchy of cards with CSS connectors.
 * Pan/zoom via mouse drag and scroll wheel.
 * Click a card to edit, hover for action buttons (convey, precede, delete).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../components/shared/Button';
import { useUIStore } from '../store/ui-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../store/write-lease-store';
import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import {
  findNpriBranchDiscrepancies,
  type NpriBranchDiscrepancy,
} from '../engine/math-engine';
import DeskMapCard from '../components/deskmap/DeskMapCard';
import DeskMapLeaseCard from '../components/deskmap/DeskMapLeaseCard';
import DeskMapNpriCard from '../components/deskmap/DeskMapNpriCard';
import {
  FormulaContentBody,
  FormulaPinProvider,
  FormulaTooltip,
  type FormulaContent,
} from '../components/leasehold/FormulaTooltip';
import {
  coverageFoundInChainFormula,
  coverageLeasedFormula,
  coverageLinkedOwnersFormula,
  leaseOverlapClippedFormula,
} from '../components/deskmap/deskmap-formulas';
import { planDeskMapLeaseDeletion } from '../components/deskmap/deskmap-lease-delete';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import {
  buildDeskMapTree,
  visibleDeskMapNodes,
  type DeskMapTreeNode,
} from '../components/deskmap/deskmap-tree';
import DeskMapTabs from '../components/deskmap/DeskMapTabs';
import {
  buildLeaseScopeIndex,
  canOwnerNodeHoldLease,
  getActiveLeases,
  calculateDeskMapCoverageSummary,
  getLeasesForOwnerNode,
  pickPrimaryLease,
  toDeskMapPrimaryLeaseSummary,
  type DeskMapPrimaryLeaseSummary,
} from '../components/deskmap/deskmap-coverage';
import ConveyModal from '../components/modals/ConveyModal';
import PredecessorModal from '../components/modals/PredecessorModal';
import AttachDocModal from '../components/modals/AttachDocModal';
import { useConfirmation } from '../components/shared/ConfirmationProvider';
import OwnershipNodeEditorModals from '../components/shared/OwnershipNodeEditorModals';
import {
  createBlankNode,
  isNpriNode,
  type DeskMap,
  type OwnershipNode,
} from '../types/node';
import type { NodeEditorRoute } from '../utils/node-editor-route';
import { resolveNodeEditorRoute } from '../utils/node-editor-route';
import {
  filterDeskMapsByUnitCode,
  findUnitOption,
  makeUnitOptionLabel,
  resolveActiveUnitCode,
} from '../utils/desk-map-units';
import type { MapAssetMeta, MapRegion } from '../types/map';
import { getMapAssetBlob } from '../storage/map-persistence';

// ── Tree branch renderer ────────────────────────────────

interface TreeBranchProps {
  tree: DeskMapTreeNode;
  parentInitialFraction: string | null;
  leaseSummaryByNodeId: Map<string, DeskMapPrimaryLeaseSummary>;
  npriDiscrepancyNodeIds: Set<string>;
  npriDiscrepancyByNpriNodeId: Map<string, NpriBranchDiscrepancy>;
  npriDiscrepancyCountByBranchNodeId: Map<string, number>;
  onEdit: (id: string) => void;
  onConvey: (id: string) => void;
  onPrecede: (id: string) => void;
  onLease: (id: string) => void;
  onAttachDoc: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDoc: (id: string) => void;
  readOnly: boolean;
}

function TreeBranchComponent({
  tree,
  parentInitialFraction,
  leaseSummaryByNodeId,
  npriDiscrepancyNodeIds,
  npriDiscrepancyByNpriNodeId,
  npriDiscrepancyCountByBranchNodeId,
  onEdit,
  onConvey,
  onPrecede,
  onLease,
  onAttachDoc,
  onDelete,
  onViewDoc,
  readOnly,
}: TreeBranchProps) {
  const leaseNode = isLeaseNode(tree.node);
  const npriNode = isNpriNode(tree.node);

  return (
    <div className="tree-branch">
      {leaseNode ? (
        <DeskMapLeaseCard
          node={tree.node}
          onEdit={onEdit}
          onAttachDoc={onAttachDoc}
          onDelete={onDelete}
          onViewDoc={onViewDoc}
          readOnly={readOnly}
        />
      ) : npriNode ? (
        <DeskMapNpriCard
          node={tree.node}
          relatedDocs={tree.relatedDocs}
          discrepancy={npriDiscrepancyByNpriNodeId.get(tree.node.id) ?? null}
          onEdit={onEdit}
          onConvey={onConvey}
          onPrecede={onPrecede}
          onAttachDoc={onAttachDoc}
          onDelete={onDelete}
          onViewDoc={onViewDoc}
          readOnly={readOnly}
        />
      ) : (
        <DeskMapCard
          node={tree.node}
          parentInitialFraction={parentInitialFraction}
          relatedDocs={tree.relatedDocs}
          leaseSummary={leaseSummaryByNodeId.get(tree.node.id) ?? null}
          npriDiscrepancyActive={npriDiscrepancyNodeIds.has(tree.node.id)}
          npriDiscrepancyCount={
            npriDiscrepancyCountByBranchNodeId.get(tree.node.id) ?? 0
          }
          onEdit={onEdit}
          onConvey={onConvey}
          onPrecede={onPrecede}
          onLease={onLease}
          onAttachDoc={onAttachDoc}
          onDelete={onDelete}
          onViewDoc={onViewDoc}
          readOnly={readOnly}
        />
      )}

      {tree.children.length > 0 && (
        <div className="tree-children">
          {tree.children.map((child) => (
            <TreeBranch
              key={child.node.id}
              tree={child}
              parentInitialFraction={tree.node.initialFraction}
              leaseSummaryByNodeId={leaseSummaryByNodeId}
              npriDiscrepancyNodeIds={npriDiscrepancyNodeIds}
              npriDiscrepancyByNpriNodeId={npriDiscrepancyByNpriNodeId}
              npriDiscrepancyCountByBranchNodeId={npriDiscrepancyCountByBranchNodeId}
              onEdit={onEdit}
              onConvey={onConvey}
              onPrecede={onPrecede}
              onLease={onLease}
              onAttachDoc={onAttachDoc}
              onDelete={onDelete}
              onViewDoc={onViewDoc}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function treeBranchPropsAreEqual(
  previous: TreeBranchProps,
  next: TreeBranchProps
): boolean {
  return (
    previous.tree === next.tree &&
    previous.parentInitialFraction === next.parentInitialFraction &&
    previous.leaseSummaryByNodeId === next.leaseSummaryByNodeId &&
    previous.npriDiscrepancyNodeIds === next.npriDiscrepancyNodeIds &&
    previous.npriDiscrepancyByNpriNodeId === next.npriDiscrepancyByNpriNodeId &&
    previous.npriDiscrepancyCountByBranchNodeId ===
      next.npriDiscrepancyCountByBranchNodeId &&
    previous.onEdit === next.onEdit &&
    previous.onConvey === next.onConvey &&
    previous.onPrecede === next.onPrecede &&
    previous.onLease === next.onLease &&
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewDoc === next.onViewDoc &&
    previous.readOnly === next.readOnly
  );
}

const TreeBranch = memo(TreeBranchComponent, treeBranchPropsAreEqual);

export function computeDeskMapFitViewport({
  containerWidth,
  containerHeight,
  contentWidth,
  contentHeight,
  contentX = 0,
  contentY = 0,
  padding = 96,
}: {
  containerWidth: number;
  containerHeight: number;
  contentWidth: number;
  contentHeight: number;
  contentX?: number;
  contentY?: number;
  padding?: number;
}): { x: number; y: number; zoom: number } | null {
  if (
    containerWidth <= 0
    || containerHeight <= 0
    || contentWidth <= 0
    || contentHeight <= 0
  ) {
    return null;
  }
  const fitZoom = Math.min(
    1.15,
    Math.max(
      0.25,
      Math.min(
        (containerWidth - padding) / contentWidth,
        (containerHeight - padding) / contentHeight
      )
    )
  );
  return {
    x: Math.max(24, (containerWidth - contentWidth * fitZoom) / 2 - contentX * fitZoom),
    y: Math.max(24, (containerHeight - contentHeight * fitZoom) / 2 - contentY * fitZoom),
    zoom: fitZoom,
  };
}

function measureDeskMapFitContent(content: HTMLElement): {
  contentWidth: number;
  contentHeight: number;
  contentX: number;
  contentY: number;
} {
  const visibleTree = content.querySelector<HTMLElement>('[data-desk-map-fit-content]');
  if (!visibleTree) {
    return {
      contentWidth: content.scrollWidth,
      contentHeight: content.scrollHeight,
      contentX: 0,
      contentY: 0,
    };
  }

  return {
    contentWidth: visibleTree.offsetWidth,
    contentHeight: visibleTree.offsetHeight,
    contentX: visibleTree.offsetLeft,
    contentY: visibleTree.offsetTop,
  };
}

// ── Pan/zoom container ──────────────────────────────────
// Uses Pointer Events with setPointerCapture for reliable drag tracking.
// setPointerCapture routes ALL subsequent pointer events to the capturing
// element, even if the pointer leaves the window. No window-level listeners needed.

function PanZoomContainer({
  children,
  resetKey,
}: {
  children: React.ReactNode;
  resetKey: string;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const pendingPointerId = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Do NOT call setPointerCapture here — it redirects ALL compatibility
    // mouse events (mousedown, mouseup, click) to the capturing element per
    // the Pointer Events spec, which prevents onClick on child elements
    // (cards, buttons) from ever firing. Instead, defer capture until a drag
    // is detected in handlePointerMove.
    dragging.current = true;
    hasDragged.current = false;
    pendingPointerId.current = e.pointerId;
    startPos.current = { x: e.clientX, y: e.clientY };
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (!hasDragged.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      hasDragged.current = true;
      // Now that a real drag is confirmed, capture the pointer for smooth
      // panning even if the cursor leaves the container/window.
      if (pendingPointerId.current !== null) {
        const el = containerRef.current;
        if (el) el.setPointerCapture(pendingPointerId.current);
        pendingPointerId.current = null;
      }
    }
    if (!hasDragged.current) return;
    const moveX = e.clientX - lastPos.current.x;
    const moveY = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + moveX, y: p.y + moveY }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    pendingPointerId.current = null;
  }, []);

  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerRect = container.getBoundingClientRect();
    const {
      contentWidth,
      contentHeight,
      contentX,
      contentY,
    } = measureDeskMapFitContent(content);
    if (containerRect.width <= 0 || containerRect.height <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      return;
    }

    const viewport = computeDeskMapFitViewport({
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      contentWidth,
      contentHeight,
      contentX,
      contentY,
    });
    if (!viewport) return;
    setZoom(viewport.zoom);
    setPan({ x: viewport.x, y: viewport.y });
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(fitToContent);
    return () => window.cancelAnimationFrame(id);
  }, [fitToContent, resetKey]);

  // Wheel zoom toward cursor position — needs native listener for { passive: false }
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom((oldZoom) => {
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.max(0.1, Math.min(3, oldZoom * factor));

        setPan((p) => ({
          x: mouseX - ((mouseX - p.x) / oldZoom) * newZoom,
          y: mouseY - ((mouseY - p.y) / oldZoom) * newZoom,
        }));

        return newZoom;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Suppress click after drag so card onClick doesn't fire
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged.current = false;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-10 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={fitToContent}
        className="absolute right-3 top-3 z-20 rounded-md border border-ledger-line bg-parchment/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-parchment-dark/80"
      >
        Fit
      </button>
      <div
        ref={contentRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="inline-block p-12"
      >
        {children}
      </div>
    </div>
  );
}

function formatCoveragePercent(value: string) {
  return `${d(value).times(100).toFixed(2)}%`;
}

// Per-browser display preference for the NPRI card toggle. Deliberately plain
// localStorage: this never touches the workspace store, autosave, or the
// .landroid format.
const DESK_MAP_HIDE_NPRIS_KEY = 'landroid:deskMapHideNpris';

function readStoredHideNpris(): boolean {
  try {
    return window.localStorage.getItem(DESK_MAP_HIDE_NPRIS_KEY) === '1';
  } catch {
    return false;
  }
}

export interface DeskMapOwnerSearchMatch {
  deskMapId: string;
  deskMapName: string;
  nodeId: string;
  ownerName: string;
}

function isSearchableDeskMapOwnerNode(node: OwnershipNode): boolean {
  return node.type === 'conveyance' && node.interestClass === 'mineral';
}

export function buildDeskMapOwnerSearchMatches({
  deskMaps,
  nodes,
  query,
}: {
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  query: string;
}): DeskMapOwnerSearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const matches: DeskMapOwnerSearchMatch[] = [];

  for (const deskMap of deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node || !isSearchableDeskMapOwnerNode(node)) {
        continue;
      }

      const ownerName = node.grantee.trim();
      if (!ownerName || !ownerName.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      matches.push({
        deskMapId: deskMap.id,
        deskMapName: deskMap.name,
        nodeId: node.id,
        ownerName,
      });
    }
  }

  return matches;
}

interface NpriBranchDiscrepancyHighlightState {
  discrepancies: NpriBranchDiscrepancy[];
  affectedNodeIds: Set<string>;
  discrepancyByNpriNodeId: Map<string, NpriBranchDiscrepancy>;
  discrepancyCountByBranchNodeId: Map<string, number>;
}

function buildNpriBranchDiscrepancyHighlightState(
  nodes: OwnershipNode[]
): NpriBranchDiscrepancyHighlightState {
  const discrepancies = findNpriBranchDiscrepancies(nodes);
  const childrenByParentId = new Map<string, OwnershipNode[]>();

  nodes.forEach((node) => {
    if (!node.parentId || node.parentId === 'unlinked') {
      return;
    }
    const children = childrenByParentId.get(node.parentId) ?? [];
    children.push(node);
    childrenByParentId.set(node.parentId, children);
  });

  const affectedNodeIds = new Set<string>();
  const discrepancyByNpriNodeId = new Map<string, NpriBranchDiscrepancy>();
  const discrepancyCountByBranchNodeId = new Map<string, number>();

  const markBranch = (rootNodeId: string) => {
    const stack = [rootNodeId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (affectedNodeIds.has(nodeId)) {
        continue;
      }
      affectedNodeIds.add(nodeId);
      stack.push(...(childrenByParentId.get(nodeId) ?? []).map((child) => child.id));
    }
  };

  discrepancies.forEach((discrepancy) => {
    markBranch(discrepancy.burdenedBranchNodeId);
    discrepancyCountByBranchNodeId.set(
      discrepancy.burdenedBranchNodeId,
      (discrepancyCountByBranchNodeId.get(discrepancy.burdenedBranchNodeId) ?? 0) + 1
    );
    discrepancy.npriNodeIds.forEach((nodeId) => {
      affectedNodeIds.add(nodeId);
      discrepancyByNpriNodeId.set(nodeId, discrepancy);
    });
  });

  return {
    discrepancies,
    affectedNodeIds,
    discrepancyByNpriNodeId,
    discrepancyCountByBranchNodeId,
  };
}

function describeCoverageDelta(
  value: string,
  {
    positiveLabel,
    negativeLabel,
    balancedLabel,
  }: {
    positiveLabel: string;
    negativeLabel: string;
    balancedLabel: string;
  }
) {
  const delta = d(value);
  if (delta.greaterThan(0)) {
    return `${positiveLabel} ${formatAsFraction(delta)}`;
  }
  if (delta.lessThan(0)) {
    return `${negativeLabel} ${formatAsFraction(delta.abs())}`;
  }
  return balancedLabel;
}

function coverageTone(value: string) {
  const delta = d(value);
  if (delta.isZero()) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

function CoverageCard({
  label,
  fraction,
  detail,
  toneClassName,
  formula,
}: {
  label: string;
  fraction: string;
  detail: string;
  toneClassName: string;
  formula?: import('../components/leasehold/FormulaTooltip').FormulaContent;
}) {
  const value = formatAsFraction(d(fraction));
  const pct = formatCoveragePercent(fraction);
  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneClassName}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider leading-tight">
        {label}
      </div>
      {/* min-w-0 + break-all so reconciliation-scale fractions
          (1000000001/1000000000) wrap inside the card instead of bleeding
          across siblings; title carries the full value for hover. */}
      <div
        className="mt-1 min-w-0 break-all text-xs font-semibold font-mono tabular-nums"
        title={value}
      >
        {formula ? <FormulaTooltip content={formula}>{value}</FormulaTooltip> : value}
      </div>
      <div className="text-[9px] mt-0.5 opacity-80 font-mono tabular-nums">
        {formula ? <FormulaTooltip content={formula}>{pct}</FormulaTooltip> : pct}
      </div>
      <div className="text-[9px] mt-1 opacity-80 leading-tight">
        {detail}
      </div>
    </div>
  );
}

interface PinnedFormula {
  id: string;
  content: FormulaContent;
}

function formulaPinId(content: FormulaContent): string {
  return JSON.stringify({
    title: content.title,
    result: content.result,
    steps: content.steps.map((step) => [
      step.label,
      step.expression,
      step.value,
    ]),
  });
}

function FormulaTray({
  formulas,
  onRemove,
  onClear,
}: {
  formulas: PinnedFormula[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (formulas.length === 0) return null;

  return (
    <aside className="absolute bottom-3 right-3 top-14 z-30 flex w-[22rem] max-w-[calc(100%-1.5rem)] flex-col rounded-md border border-ledger-line bg-parchment/96 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-ledger-line px-3 py-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink">
            Formula Tray
          </div>
          <div className="text-[10px] text-ink-light">
            {formulas.length} pinned for comparison
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-ledger-line px-2 py-1 text-[10px] font-semibold text-ink-light hover:bg-parchment-dark/70"
        >
          Clear
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {formulas.map((formula) => (
          <section
            key={formula.id}
            className="rounded-md border border-leather/50 bg-ink p-3 text-xs text-parchment shadow-sm"
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => onRemove(formula.id)}
                className="rounded px-2 py-0.5 text-[10px] font-semibold text-parchment/70 hover:bg-parchment/10 hover:text-parchment"
              >
                Remove
              </button>
            </div>
            <FormulaContentBody content={formula.content} pinned pinHint="Pinned in tray." />
          </section>
        ))}
      </div>
    </aside>
  );
}

function isImageMapAsset(asset: MapAssetMeta): boolean {
  return asset.mimeType.toLowerCase().startsWith('image/');
}

function isPdfMapAsset(asset: MapAssetMeta): boolean {
  return asset.mimeType.toLowerCase().includes('pdf');
}

function UnitMapReferencePanel({
  asset,
  regions,
  unitLabel,
  linkedTractCount,
  selectionLabel,
  collapsed,
  onToggle,
}: {
  asset: MapAssetMeta;
  regions: MapRegion[];
  unitLabel: string;
  linkedTractCount: number;
  selectionLabel: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  // Blob bytes are fetched on demand: the map store holds metadata only.
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    getMapAssetBlob(asset.id).then((next) => {
      if (!cancelled) setBlob(next ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  const objectUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob]
  );

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-3 z-20 rounded-md border border-ledger-line bg-parchment/95 px-3 py-2 text-xs font-semibold text-ink shadow-md backdrop-blur transition-colors hover:bg-parchment"
        title="Open Unit Map Reference"
      >
        Map Ref
      </button>
    );
  }

  return (
    <aside className="absolute right-3 top-3 z-20 flex max-h-[min(34rem,calc(100%-1.5rem))] w-[21rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-ledger-line bg-parchment/96 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-ledger-line bg-ledger px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
            Unit Map Reference
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-ink">
            {asset.title || asset.fileName}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-light">
            {unitLabel} • {linkedTractCount} tract{linkedTractCount === 1 ? '' : 's'}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-ledger-line px-2 py-1 text-[10px] font-semibold text-ink-light transition-colors hover:bg-parchment"
          title="Collapse Unit Map Reference"
        >
          Hide
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {(isImageMapAsset(asset) || isPdfMapAsset(asset)) && !objectUrl ? (
          <div className="rounded-md border border-dashed border-ledger-line bg-parchment-dark/40 px-3 py-4 text-sm text-ink-light">
            Loading map…
          </div>
        ) : isImageMapAsset(asset) ? (
          <img
            src={objectUrl ?? undefined}
            alt={asset.title || asset.fileName}
            className="max-h-80 w-full rounded-md border border-ledger-line bg-white object-contain"
          />
        ) : isPdfMapAsset(asset) ? (
          <iframe
            src={objectUrl ?? undefined}
            sandbox="allow-downloads"
            className="h-80 w-full rounded-md border border-ledger-line bg-white"
            title={asset.fileName}
          />
        ) : (
          <div className="rounded-md border border-dashed border-ledger-line bg-parchment-dark/40 px-3 py-4 text-sm text-ink-light">
            This map asset is saved as {asset.kind}. Use Maps for the full preview.
          </div>
        )}

        <div className="mt-3 space-y-2 text-xs text-ink-light">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5">
              {asset.kind}
            </span>
            {asset.isFeatured && (
              <span className="rounded-full border border-leather/30 bg-leather/10 px-2 py-0.5 text-leather">
                Featured
              </span>
            )}
            <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5">
              {selectionLabel}
            </span>
            {regions.length > 0 && (
              <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5">
                {regions.length} region{regions.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="break-all">{asset.fileName}</div>
          {(asset.presentationSummary || asset.notes) && (
            <div className="rounded-md border border-ledger-line bg-parchment-dark/35 p-2 leading-5 text-ink">
              {asset.presentationSummary || asset.notes}
            </div>
          )}
          <div>
            Reference-only panel. Title cards stay on the Desk Map canvas; open Maps
            to edit assets, regions, and source links.
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Main view ───────────────────────────────────────────

export default function DeskMapView() {
  const readOnly = useWorkspaceReadOnly();
  const pendingNodeEditorRoute = useUIStore((state) => state.pendingNodeEditorRoute);
  const setPendingNodeEditorRoute = useUIStore((state) => state.setPendingNodeEditorRoute);
  const leases = useOwnerStore((state) => state.leases);
  const removeLeaseRecord = useOwnerStore((state) => state.removeLease);
  const { confirm: requestConfirmation, alert: showAlert } = useConfirmation();
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeUnitCode = useWorkspaceStore((s) => s.activeUnitCode);
  const mapAssets = useMapStore((s) => s.mapAssets);
  const mapRegions = useMapStore((s) => s.mapRegions);
  const activeNodeId = useWorkspaceStore((s) => s.activeNodeId);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const removeNode = useWorkspaceStore((s) => s.removeNode);
  const addNode = useWorkspaceStore((s) => s.addNode);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const clearDeskMapNodes = useWorkspaceStore((s) => s.clearDeskMapNodes);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);

  const [editorRoute, setEditorRoute] = useState<NodeEditorRoute | null>(null);
  const [conveyParentId, setConveyParentId] = useState<string | null>(null);
  const [precedeNodeId, setPrecedeNodeId] = useState<string | null>(null);
  const [attachDocParentId, setAttachDocParentId] = useState<string | null>(null);
  const [npriParentId, setNpriParentId] = useState<string | null>(null);
  const [pdfViewDocId, setPdfViewDocId] = useState<string | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchMatchIndex, setOwnerSearchMatchIndex] = useState(0);
  // Phase 7 polish: collapsible toolbar so the canvas stays unobstructed once
  // the landman knows the controls.
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  // Display-only NPRI card visibility. Read once per mount; default shown.
  const [hideNpris, setHideNpris] = useState(readStoredHideNpris);
  const [pinnedFormulas, setPinnedFormulas] = useState<PinnedFormula[]>([]);
  const [mapReferenceCollapsed, setMapReferenceCollapsed] = useState(false);

  const hydrated = useWorkspaceStore((s) => s._hydrated);

  // Auto-create a desk map if none exist — only after persistence has loaded
  useEffect(() => {
    if (!hydrated) return;
    if (readOnly) return;
    if (deskMaps.length === 0) {
      // Create an empty desk map — do NOT auto-assign existing nodes,
      // so the user can start with a blank canvas after deleting all desk maps
      createDeskMap('Tract 1', 'T1');
    }
  }, [hydrated, readOnly, deskMaps.length, createDeskMap]);

  useEffect(() => {
    if (!pendingNodeEditorRoute) return;
    if (readOnly) {
      setPendingNodeEditorRoute(null);
      return;
    }
    setEditorRoute(pendingNodeEditorRoute);
    setPendingNodeEditorRoute(null);
  }, [pendingNodeEditorRoute, readOnly, setPendingNodeEditorRoute]);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const activeLeasesByOwnerId = useMemo(() => {
    const groupedLeases = new Map<string, typeof leases>();

    leases.forEach((lease) => {
      const existing = groupedLeases.get(lease.ownerId) ?? [];
      existing.push(lease);
      groupedLeases.set(lease.ownerId, existing);
    });

    return new Map(
      [...groupedLeases.entries()]
        .map(([ownerId, ownerLeases]) => [ownerId, getActiveLeases(ownerLeases)] as const)
        .filter((entry) => entry[1].length > 0)
    );
  }, [leases]);
  const leaseScopeIndex = useMemo(() => buildLeaseScopeIndex(nodes), [nodes]);
  const activeDeskMap = useMemo(
    () => deskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null,
    [activeDeskMapId, deskMaps]
  );
  const effectiveUnitCode = useMemo(
    () => resolveActiveUnitCode(deskMaps, activeUnitCode, activeDeskMapId),
    [activeDeskMapId, activeUnitCode, deskMaps]
  );
  const activeUnitOption = useMemo(
    () => findUnitOption(deskMaps, effectiveUnitCode),
    [deskMaps, effectiveUnitCode]
  );
  const activeUnitDeskMaps = useMemo(
    () => filterDeskMapsByUnitCode(deskMaps, effectiveUnitCode),
    [deskMaps, effectiveUnitCode]
  );
  const activeUnitDeskMapIds = useMemo(
    () => new Set(activeUnitDeskMaps.map((deskMap) => deskMap.id)),
    [activeUnitDeskMaps]
  );
  const unitMapReferenceSelection = useMemo(() => {
    if (mapAssets.length === 0) {
      return null;
    }

    const unitLinkedAsset = mapAssets.find(
      (asset) => asset.deskMapId !== null && activeUnitDeskMapIds.has(asset.deskMapId)
    );
    if (unitLinkedAsset) {
      return {
        asset: unitLinkedAsset,
        label: 'Unit-linked',
      };
    }

    const featuredAsset = mapAssets.find((asset) => asset.isFeatured);
    if (featuredAsset) {
      return {
        asset: featuredAsset,
        label: 'Featured fallback',
      };
    }

    const firstAsset = mapAssets[0];
    return firstAsset
      ? {
          asset: firstAsset,
          label: 'First map asset',
        }
      : null;
  }, [activeUnitDeskMapIds, mapAssets]);
  const unitMapReferenceAsset = unitMapReferenceSelection?.asset ?? null;
  const unitMapReferenceRegions = useMemo(
    () =>
      unitMapReferenceAsset
        ? mapRegions.filter((region) => region.assetId === unitMapReferenceAsset.id)
        : [],
    [mapRegions, unitMapReferenceAsset]
  );
  const unitMapReferenceLabel = activeUnitOption
    ? makeUnitOptionLabel(activeUnitOption)
    : activeDeskMap?.unitName || activeDeskMap?.name || 'Active Desk Map';
  const visibleNodes = useMemo(() => {
    if (!activeDeskMap || activeDeskMap.nodeIds.length === 0) {
      return [];
    }
    const idSet = new Set(activeDeskMap.nodeIds);
    return nodes.filter((node) => idSet.has(node.id));
  }, [activeDeskMap, nodes]);
  const visibleCardCount = useMemo(
    () =>
      visibleNodes.reduce(
        (count, node) => count + (node.type === 'related' && !isLeaseNode(node) ? 0 : 1),
        0
      ),
    [visibleNodes]
  );
  const leaseSummaryByNodeId = useMemo(
    () =>
      new Map(
        visibleNodes.flatMap((node) => {
          // Mineral-only lease gate (canOwnerNodeHoldLease): related,
          // unlinked, NPRI, and any future non-mineral interest class cannot
          // carry a lease summary on the Desk Map.
          if (!canOwnerNodeHoldLease(node)) {
            return [];
          }
          const ownerLeases = getLeasesForOwnerNode(
            activeLeasesByOwnerId.get(node.linkedOwnerId) ?? [],
            node,
            leaseScopeIndex
          );
          const leaseSummary = toDeskMapPrimaryLeaseSummary(pickPrimaryLease(ownerLeases));
          return leaseSummary ? ([[node.id, leaseSummary]] as Array<[string, DeskMapPrimaryLeaseSummary]>) : [];
        })
      ),
    [activeLeasesByOwnerId, leaseScopeIndex, visibleNodes]
  );
  const coverageSummary = useMemo(
    () => calculateDeskMapCoverageSummary(visibleNodes, activeLeasesByOwnerId, nodes),
    [activeLeasesByOwnerId, nodes, visibleNodes]
  );
  const npriDiscrepancyState = useMemo(
    () => buildNpriBranchDiscrepancyHighlightState(nodes),
    [nodes]
  );
  const visibleNpriDiscrepancies = useMemo(() => {
    if (!activeDeskMap) {
      return [];
    }
    const visibleNodeIds = new Set(activeDeskMap.nodeIds);
    return npriDiscrepancyState.discrepancies.filter(
      (discrepancy) =>
        visibleNodeIds.has(discrepancy.burdenedBranchNodeId)
        || discrepancy.npriNodeIds.some((nodeId) => visibleNodeIds.has(nodeId))
    );
  }, [activeDeskMap, npriDiscrepancyState]);
  const npriCardCount = useMemo(
    () => visibleNodes.filter((node) => isNpriNode(node)).length,
    [visibleNodes]
  );
  // Render-time filter only. Coverage math, warning dots, NPRI-discrepancy
  // checks, and owner search above all keep reading the unfiltered nodes.
  const renderedNodes = useMemo(
    () => visibleDeskMapNodes(visibleNodes, { hideNpris }),
    [hideNpris, visibleNodes]
  );
  const trees = useMemo(() => buildDeskMapTree(renderedNodes), [renderedNodes]);
  const ownerSearchMatches = useMemo(
    () => buildDeskMapOwnerSearchMatches({ deskMaps, nodes, query: ownerSearchQuery }),
    [deskMaps, nodes, ownerSearchQuery]
  );
  const activeOwnerSearchMatch =
    ownerSearchMatches.length > 0
      ? ownerSearchMatches[
          Math.min(ownerSearchMatchIndex, ownerSearchMatches.length - 1)
        ] ?? ownerSearchMatches[0]
      : null;
  const conveyParent = conveyParentId ? nodeById.get(conveyParentId) ?? null : null;
  const precedeNode = precedeNodeId ? nodeById.get(precedeNodeId) ?? null : null;

  useEffect(() => {
    setOwnerSearchMatchIndex(0);
  }, [ownerSearchQuery]);

  useEffect(() => {
    if (ownerSearchMatchIndex < ownerSearchMatches.length || ownerSearchMatches.length === 0) {
      return;
    }
    setOwnerSearchMatchIndex(0);
  }, [ownerSearchMatchIndex, ownerSearchMatches.length]);

  useEffect(() => {
    if (!activeOwnerSearchMatch) {
      return;
    }
    if (activeDeskMapId !== activeOwnerSearchMatch.deskMapId) {
      setActiveDeskMap(activeOwnerSearchMatch.deskMapId);
    }
    if (activeNodeId !== activeOwnerSearchMatch.nodeId) {
      setActiveNode(activeOwnerSearchMatch.nodeId);
    }
  }, [
    activeDeskMapId,
    activeNodeId,
    activeOwnerSearchMatch,
    setActiveDeskMap,
    setActiveNode,
  ]);

  const handleEdit = useCallback((id: string) => {
    if (readOnly) return;
    const node = nodeById.get(id) ?? null;
    const route = resolveNodeEditorRoute(node);

    if (!route) {
      return;
    }

    setActiveNode(id);
    setEditorRoute(route);
  }, [nodeById, readOnly, setActiveNode]);

  const handleConvey = useCallback((id: string) => {
    if (readOnly) return;
    setConveyParentId(id);
  }, [readOnly]);

  const handlePrecede = useCallback((id: string) => {
    if (readOnly) return;
    setPrecedeNodeId(id);
  }, [readOnly]);

  const handleLease = useCallback((id: string) => {
    if (readOnly) return;
    setActiveNode(id);
    setEditorRoute({ kind: 'lease', parentNodeId: id });
  }, [readOnly, setActiveNode]);

  const handleAttachDoc = useCallback((id: string) => {
    if (readOnly) return;
    setAttachDocParentId(id);
  }, [readOnly]);

  const handleDelete = useCallback(async (id: string) => {
    if (readOnly) return;
    const node = nodeById.get(id) ?? null;
    const leaseDeletionPlan = planDeskMapLeaseDeletion(nodes, id);
    const title = leaseDeletionPlan.leaseId
      ? 'Delete Lessee Card?'
      : node?.type === 'related'
      ? 'Delete Related Node?'
      : 'Delete Node?';
    const confirmLabel = leaseDeletionPlan.leaseId
      ? 'Delete Lessee Card'
      : node?.type === 'related'
      ? 'Delete Related Node'
      : 'Delete Node';
    const message = leaseDeletionPlan.leaseId
      ? leaseDeletionPlan.removeOwnerLeaseRecord
        ? 'Delete this lessee card and remove the linked lease from the owner record?'
        : 'Delete this lessee card? The linked owner lease record is also used by another Desk Map card and will stay in owner info.'
      : node?.type === 'related'
      ? 'Delete this related node? Any attached related records beneath it will also be removed.'
      : 'Delete this node? Its branch will be removed, and any conveyed amount will be restored to the grantor.';

    const confirmed = await requestConfirmation({
      title,
      message,
      confirmLabel,
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      if (leaseDeletionPlan.leaseId && leaseDeletionPlan.removeOwnerLeaseRecord) {
        await removeLeaseRecord(leaseDeletionPlan.leaseId);
      }
      // Snapshot pre-delete state so we can detect a silent failure
      // (the store sets `lastError` instead of throwing for math/graph
      // rejections). If the node is still present afterwards, surface
      // the actual error to the user instead of leaving them puzzled.
      const beforeIds = new Set(
        useWorkspaceStore.getState().nodes.map((n) => n.id)
      );
      removeNode(id);
      const after = useWorkspaceStore.getState();
      const stillPresent = after.nodes.some((n) => n.id === id);
      if (stillPresent && beforeIds.has(id)) {
        const reason = after.lastError ?? 'Delete was rejected by the ownership-graph validator.';
        console.error('[DeskMap delete] failed:', reason);
        await showAlert({
          title: 'Could Not Delete Node',
          message: `Could not delete this node.\n\n${reason}`,
        });
      }
    } catch (deleteError) {
      console.error(deleteError);
      await showAlert({
        title: 'Delete Failed',
        message: 'Delete failed. The card was left in place so owner data stays consistent.',
      });
    }
  }, [nodeById, nodes, readOnly, removeLeaseRecord, removeNode, requestConfirmation, showAlert]);

  const handleViewDoc = useCallback((id: string) => {
    setPdfViewDocId(id);
  }, []);

  const handlePinFormula = useCallback((content: FormulaContent) => {
    const id = formulaPinId(content);
    setPinnedFormulas((current) => {
      const existing = current.filter((formula) => formula.id !== id);
      return [{ id, content }, ...existing].slice(0, 8);
    });
  }, []);

  const handleRemovePinnedFormula = useCallback((id: string) => {
    setPinnedFormulas((current) => current.filter((formula) => formula.id !== id));
  }, []);

  const handleAddRoot = useCallback(() => {
    if (readOnly) return;
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const root = {
      ...createBlankNode(id, null),
      grantee: 'New Owner',
      instrument: 'Patent',
      initialFraction: '1',
      fraction: '1',
    };
    addNode(root);
    if (deskMaps.length === 0) {
      createDeskMap('Tract 1', 'T1', [id]);
    } else {
      addNodeToActiveDeskMap(id);
    }
    setActiveNode(id);
    setEditorRoute({ kind: 'node', nodeId: id });
  }, [addNode, addNodeToActiveDeskMap, createDeskMap, deskMaps.length, readOnly, setActiveNode]);

  const handleClearDeskMap = useCallback(async () => {
    if (readOnly) return;
    if (!activeDeskMap) return;
    if (visibleCardCount === 0) {
      await showAlert({
        title: 'Desk Map Already Clear',
        message: `${activeDeskMap.name} is already clear.`,
      });
      return;
    }

    const confirmed = await requestConfirmation({
      title: `Clear ${activeDeskMap.name}?`,
      message: `This removes the ${visibleCardCount} visible card${visibleCardCount === 1 ? '' : 's'} from this Desk Map. Other tracts and owner records stay in the workspace.`,
      confirmLabel: 'Clear Desk Map',
      tone: 'danger',
    });
    if (!confirmed) return;

    clearDeskMapNodes(activeDeskMap.id);
  }, [activeDeskMap, clearDeskMapNodes, readOnly, requestConfirmation, showAlert, visibleCardCount]);

  const handleToggleNpris = useCallback(() => {
    setHideNpris((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(DESK_MAP_HIDE_NPRIS_KEY, next ? '1' : '0');
      } catch {
        // Persistence is best-effort; the in-session toggle still applies.
      }
      return next;
    });
  }, []);

  const cycleOwnerSearchMatch = useCallback((direction: 1 | -1) => {
    setOwnerSearchMatchIndex((currentIndex) => {
      if (ownerSearchMatches.length === 0) {
        return 0;
      }
      return (
        (currentIndex + direction + ownerSearchMatches.length) % ownerSearchMatches.length
      );
    });
  }, [ownerSearchMatches.length]);

  return (
    <FormulaPinProvider onPin={handlePinFormula}>
    <div className="w-full h-full relative flex flex-col">
      {/* Desk map tabs */}
      <DeskMapTabs />

      <div className="flex-1 relative overflow-hidden bg-canvas-bg">
        {/* Toolbar */}
        <div
          className={`absolute top-3 left-3 z-20 max-w-[calc(100%-1.5rem)] rounded-md bg-parchment/92 backdrop-blur border border-ledger-line shadow-md ${
            toolbarCollapsed ? 'w-auto p-2' : 'w-[19.5rem] p-2.5 space-y-2.5'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setToolbarCollapsed((prev) => !prev)}
              className="rounded-md border border-ledger-line bg-parchment px-1.5 py-1 text-[10px] font-semibold text-ink-light hover:bg-parchment-dark/70 transition-colors"
              title={
                toolbarCollapsed
                  ? 'Expand Desk Map toolbar'
                  : 'Collapse Desk Map toolbar to free canvas space'
              }
              aria-label={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {toolbarCollapsed ? '▸' : '▾'}
            </button>
            {!toolbarCollapsed && (
              <button
                type="button"
                disabled={readOnly}
                onClick={handleAddRoot}
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Root
              </button>
            )}
            {!toolbarCollapsed && (
              <button
                type="button"
                onClick={handleClearDeskMap}
                disabled={readOnly || !activeDeskMap || visibleCardCount === 0}
                className="rounded-md border border-seal/30 px-3 py-1.5 text-xs font-semibold text-seal transition-colors hover:bg-seal/10 disabled:cursor-not-allowed disabled:opacity-40"
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Clear all cards from the active Desk Map'}
              >
                Clear Map
              </button>
            )}
            <span className="text-[10px] text-ink-light font-mono">
              {visibleCardCount} cards
            </span>
            {!toolbarCollapsed && (
              <span
                className="ml-auto text-[12px] text-ink-light cursor-help"
                title="Toolbar — add roots, search owners, and review tract coverage. Click ▾ to collapse."
              >
                ℹ
              </span>
            )}
          </div>
          {!toolbarCollapsed && (
          <>
          {npriCardCount > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleNpris}
                aria-pressed={hideNpris}
                className="rounded-md border border-ledger-line px-3 py-1.5 text-xs font-semibold text-ink-light transition-colors hover:bg-parchment-dark/70"
                title={
                  hideNpris
                    ? 'Show NPRI cards on the canvas'
                    : 'Hide NPRI cards from the canvas. Display only — coverage, totals, and warnings are unchanged.'
                }
              >
                {hideNpris ? 'Show' : 'Hide'} NPRIs ({npriCardCount})
              </button>
              {hideNpris && (
                <span className="text-[9px] leading-tight text-ink-light">
                  Hidden from canvas only — totals and warnings unchanged.
                </span>
              )}
            </div>
          )}
          <div className="text-[9px] leading-tight text-ink-light">
            Add more than one root when title starts from separate families. Temporary
            coverage over 100% is okay until you reconcile farther back in title.
          </div>

          <div className="space-y-1.5">
            <label className="block">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-light">
                Find Mineral Owner
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  value={ownerSearchQuery}
                  onChange={(event) => setOwnerSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }
                    event.preventDefault();
                    cycleOwnerSearchMatch(event.shiftKey ? -1 : 1);
                  }}
                  placeholder="Type owner name..."
                  className="min-w-0 flex-1 rounded-md border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
                />
                {ownerSearchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOwnerSearchQuery('')}
                    className="rounded-md border border-ledger-line px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-light transition-colors hover:bg-parchment-dark/70"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>

            {ownerSearchQuery.trim().length > 0 && (
              <div className="rounded-md border border-ledger-line bg-parchment-dark/35 px-2.5 py-2">
                {activeOwnerSearchMatch ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold text-ink">
                        {ownerSearchMatchIndex + 1} of {ownerSearchMatches.length}
                      </div>
                      {ownerSearchMatches.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => cycleOwnerSearchMatch(-1)}
                            className="rounded-md border border-ledger-line px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-ink-light transition-colors hover:bg-parchment-dark/70"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() => cycleOwnerSearchMatch(1)}
                            className="rounded-md border border-ledger-line px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-ink-light transition-colors hover:bg-parchment-dark/70"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-ink">
                      {activeOwnerSearchMatch.ownerName}
                    </div>
                    <div className="text-[9px] text-ink-light">
                      Jumping to {activeOwnerSearchMatch.deskMapName}
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
                      {ownerSearchMatches.map((match, index) => {
                        const isSelected = index === ownerSearchMatchIndex;

                        return (
                          <button
                            key={`${match.deskMapId}-${match.nodeId}`}
                            type="button"
                            onClick={() => setOwnerSearchMatchIndex(index)}
                            className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                              isSelected
                                ? 'border-leather bg-leather/10'
                                : 'border-ledger-line bg-parchment/70 hover:bg-parchment-dark/60'
                            }`}
                          >
                            <div className="text-[10px] font-semibold text-ink">
                              {match.ownerName}
                            </div>
                            <div className="text-[9px] text-ink-light">
                              {match.deskMapName}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-ink-light">
                    No mineral owners matched that search.
                  </div>
                )}
              </div>
            )}
          </div>

          {visibleNpriDiscrepancies.length > 0 && (
            <div className="rounded-md border border-seal/30 bg-seal/10 px-2.5 py-2 text-[10px] leading-4 text-seal">
              <div className="font-semibold uppercase tracking-wider">
                NPRI title discrepancy
              </div>
              <div className="mt-1">
                {visibleNpriDiscrepancies.length} branch issue
                {visibleNpriDiscrepancies.length === 1 ? '' : 's'} on this tract.
                Affected branch cards and NPRI cards are highlighted red so the
                discrepancy can be fixed later without blocking title entry.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-light">
              Mineral Coverage
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <CoverageCard
                label="Found In Chain"
                fraction={coverageSummary.currentOwnership}
                detail={describeCoverageDelta(coverageSummary.missingOwnership, {
                  positiveLabel: 'Missing',
                  negativeLabel: 'Over by',
                  balancedLabel: 'Balanced at 100%',
                })}
                toneClassName={coverageTone(coverageSummary.missingOwnership)}
                formula={coverageFoundInChainFormula(coverageSummary)}
              />
              <CoverageCard
                label="Linked Owners"
                fraction={coverageSummary.linkedOwnership}
                detail={describeCoverageDelta(coverageSummary.unlinkedOwnership, {
                  positiveLabel: 'Unlinked',
                  negativeLabel: 'Over by',
                  balancedLabel: 'All current owners linked',
                })}
                toneClassName={coverageTone(coverageSummary.unlinkedOwnership)}
                formula={coverageLinkedOwnersFormula(coverageSummary)}
              />
              <CoverageCard
                label="Leased"
                fraction={coverageSummary.leasedOwnership}
                detail={describeCoverageDelta(coverageSummary.unleasedOwnership, {
                  positiveLabel: 'Open to lease',
                  negativeLabel: 'Over by',
                  balancedLabel: 'Fully leased',
                })}
                toneClassName={coverageTone(coverageSummary.unleasedOwnership)}
                formula={coverageLeasedFormula(coverageSummary)}
              />
            </div>
            {d(coverageSummary.currentOwnership).greaterThan(1) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-950">
                <div className="font-semibold uppercase tracking-wider">
                  Over 100% mineral coverage
                </div>
                <div className="mt-1">
                  Current cards contributing to the tract total:{' '}
                  {coverageSummary.currentOwnershipContributors
                    .slice(0, 6)
                    .map((contributor) =>
                      `${contributor.grantee} (${formatAsFraction(d(contributor.fraction))})`
                    )
                    .join(', ')}
                  {coverageSummary.currentOwnershipContributors.length > 6
                    ? `, +${coverageSummary.currentOwnershipContributors.length - 6} more`
                    : ''}
                  . This is warning-only while title is being reconciled.
                </div>
              </div>
            )}
            {coverageSummary.leaseOverlaps.length > 0 && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-950"
                title="Audit M5: overlapping active leases on the same owner. Later leases are clipped by earlier ones until reconciled."
              >
                <div className="font-semibold uppercase tracking-wider">
                  Lease overlap ({coverageSummary.leaseOverlaps.length})
                </div>
                <div className="mt-1">
                  {coverageSummary.leaseOverlaps
                    .slice(0, 3)
                    .map(({ ownerGrantee, overlap }, i, arr) => (
                      <span key={overlap.leaseId}>
                        {ownerGrantee}: {overlap.leaseName || overlap.lessee} clipped{' '}
                        <FormulaTooltip
                          content={leaseOverlapClippedFormula(ownerGrantee, overlap)}
                        >
                          {overlap.clippedFraction}
                        </FormulaTooltip>
                        {i < arr.length - 1 ? '; ' : ''}
                      </span>
                    ))}
                  {coverageSummary.leaseOverlaps.length > 3
                    ? `, +${coverageSummary.leaseOverlaps.length - 3} more`
                    : ''}
                  . Review the leasehold deck to reconcile.
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-ink-light font-mono">
              <span>{coverageSummary.currentOwnerCount} present owners</span>
              <span>{coverageSummary.linkedOwnerCount} linked</span>
              <span>{coverageSummary.leasedOwnerCount} leased</span>
            </div>
          </div>
          </>
          )}
        </div>

        {visibleNodes.length === 0 ? (
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <h2 className="text-xl font-display font-bold text-ink">
                No title chain yet
              </h2>
              <p className="text-ink-light text-sm">
                Add a root node to start building, or load a .landroid / CSV file.
              </p>
              <Button
                onClick={handleAddRoot}
                disabled={readOnly}
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
              >
                + Add Root Node
              </Button>
            </div>
          </div>
        ) : (
          <PanZoomContainer
            resetKey={`${activeDeskMapId ?? 'none'}:${renderedNodes.map((node) => node.id).join('|')}`}
          >
            <div className="flex gap-16" data-desk-map-fit-content>
              {trees.map((tree) => (
                <TreeBranch
                  key={tree.node.id}
                  tree={tree}
                  parentInitialFraction={null}
                  leaseSummaryByNodeId={leaseSummaryByNodeId}
                  npriDiscrepancyNodeIds={npriDiscrepancyState.affectedNodeIds}
                  npriDiscrepancyByNpriNodeId={
                    npriDiscrepancyState.discrepancyByNpriNodeId
                  }
                  npriDiscrepancyCountByBranchNodeId={
                    npriDiscrepancyState.discrepancyCountByBranchNodeId
                  }
                  onEdit={handleEdit}
                  onConvey={handleConvey}
                  onPrecede={handlePrecede}
                  onLease={handleLease}
                  onAttachDoc={handleAttachDoc}
                  onDelete={handleDelete}
                  onViewDoc={handleViewDoc}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </PanZoomContainer>
        )}

        <FormulaTray
          formulas={pinnedFormulas}
          onRemove={handleRemovePinnedFormula}
          onClear={() => setPinnedFormulas([])}
        />

        {unitMapReferenceSelection && (
          <UnitMapReferencePanel
            asset={unitMapReferenceSelection.asset}
            regions={unitMapReferenceRegions}
            unitLabel={unitMapReferenceLabel}
            linkedTractCount={activeUnitDeskMaps.length}
            selectionLabel={unitMapReferenceSelection.label}
            collapsed={mapReferenceCollapsed}
            onToggle={() => setMapReferenceCollapsed((current) => !current)}
          />
        )}

        <OwnershipNodeEditorModals
          route={editorRoute}
          onSetRoute={setEditorRoute}
          npriParentId={npriParentId}
          onSetNpriParentId={setNpriParentId}
          pdfViewDocId={pdfViewDocId}
          onSetPdfViewDocId={setPdfViewDocId}
        />

        {/* Convey modal */}
        {conveyParent && (
          <ConveyModal
            parentNode={conveyParent}
            onClose={() => setConveyParentId(null)}
          />
        )}

        {/* Predecessor modal */}
        {precedeNode && (
          <PredecessorModal
            node={precedeNode}
            onClose={() => setPrecedeNodeId(null)}
          />
        )}

        {/* Attach doc modal */}
        {attachDocParentId && (
          <AttachDocModal
            parentNodeId={attachDocParentId}
            onClose={() => setAttachDocParentId(null)}
          />
        )}
      </div>
    </div>
    </FormulaPinProvider>
  );
}
