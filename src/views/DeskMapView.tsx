/**
 * Desk Map View — the primary working area for building title chains.
 *
 * Renders the ownership tree as a hierarchy of cards with CSS connectors.
 * Pan/zoom via mouse drag and scroll wheel.
 * Click a card to edit, hover for action buttons (convey, precede, delete).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '../store/ui-store';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import {
  findNpriBranchDiscrepancies,
  type NpriBranchDiscrepancy,
} from '../engine/math-engine';
import DeskMapCard from '../components/deskmap/DeskMapCard';
import DeskMapLeaseCard from '../components/deskmap/DeskMapLeaseCard';
import DeskMapNpriCard from '../components/deskmap/DeskMapNpriCard';
import { planDeskMapLeaseDeletion } from '../components/deskmap/deskmap-lease-delete';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import {
  buildDeskMapTree,
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
import OwnershipNodeEditorModals from '../components/shared/OwnershipNodeEditorModals';
import {
  createBlankNode,
  isNpriNode,
  type DeskMap,
  type OwnershipNode,
} from '../types/node';
import type { NodeEditorRoute } from '../utils/node-editor-route';
import { resolveNodeEditorRoute } from '../utils/node-editor-route';

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
  onAttachDoc: (id: string) => void;
  onDelete: (id: string) => void;
  onViewPdf: (id: string) => void;
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
  onAttachDoc,
  onDelete,
  onViewPdf,
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
          onViewPdf={onViewPdf}
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
          onViewPdf={onViewPdf}
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
          onAttachDoc={onAttachDoc}
          onDelete={onDelete}
          onViewPdf={onViewPdf}
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
              onAttachDoc={onAttachDoc}
              onDelete={onDelete}
              onViewPdf={onViewPdf}
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
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewPdf === next.onViewPdf
  );
}

const TreeBranch = memo(TreeBranchComponent, treeBranchPropsAreEqual);

// ── Pan/zoom container ──────────────────────────────────
// Uses Pointer Events with setPointerCapture for reliable drag tracking.
// setPointerCapture routes ALL subsequent pointer events to the capturing
// element, even if the pointer leaves the window. No window-level listeners needed.

function PanZoomContainer({ children }: { children: React.ReactNode }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
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
      <div
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
}: {
  label: string;
  fraction: string;
  detail: string;
  toneClassName: string;
}) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneClassName}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider leading-tight">
        {label}
      </div>
      <div className="mt-1 text-xs font-semibold font-mono">
        {formatAsFraction(d(fraction))}
      </div>
      <div className="text-[9px] mt-0.5 opacity-80">
        {formatCoveragePercent(fraction)}
      </div>
      <div className="text-[9px] mt-1 opacity-80 leading-tight">
        {detail}
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────

export default function DeskMapView() {
  const pendingNodeEditorRoute = useUIStore((state) => state.pendingNodeEditorRoute);
  const setPendingNodeEditorRoute = useUIStore((state) => state.setPendingNodeEditorRoute);
  const leases = useOwnerStore((state) => state.leases);
  const removeLeaseRecord = useOwnerStore((state) => state.removeLease);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeNodeId = useWorkspaceStore((s) => s.activeNodeId);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const setActiveDeskMap = useWorkspaceStore((s) => s.setActiveDeskMap);
  const removeNode = useWorkspaceStore((s) => s.removeNode);
  const addNode = useWorkspaceStore((s) => s.addNode);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);

  const [editorRoute, setEditorRoute] = useState<NodeEditorRoute | null>(null);
  const [conveyParentId, setConveyParentId] = useState<string | null>(null);
  const [precedeNodeId, setPrecedeNodeId] = useState<string | null>(null);
  const [attachDocParentId, setAttachDocParentId] = useState<string | null>(null);
  const [npriParentId, setNpriParentId] = useState<string | null>(null);
  const [pdfViewNodeId, setPdfViewNodeId] = useState<string | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchMatchIndex, setOwnerSearchMatchIndex] = useState(0);
  // Phase 7 polish: collapsible toolbar so the canvas stays unobstructed once
  // the landman knows the controls.
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  const hydrated = useWorkspaceStore((s) => s._hydrated);

  // Auto-create a desk map if none exist — only after persistence has loaded
  useEffect(() => {
    if (!hydrated) return;
    if (deskMaps.length === 0) {
      // Create an empty desk map — do NOT auto-assign existing nodes,
      // so the user can start with a blank canvas after deleting all desk maps
      createDeskMap('Tract 1', 'T1');
    }
  }, [hydrated, deskMaps.length, createDeskMap]);

  useEffect(() => {
    if (!pendingNodeEditorRoute) return;
    setEditorRoute(pendingNodeEditorRoute);
    setPendingNodeEditorRoute(null);
  }, [pendingNodeEditorRoute, setPendingNodeEditorRoute]);

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
  const trees = useMemo(() => buildDeskMapTree(visibleNodes), [visibleNodes]);
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
    const node = nodeById.get(id) ?? null;
    const route = resolveNodeEditorRoute(node);

    if (!route) {
      return;
    }

    setActiveNode(id);
    setEditorRoute(route);
  }, [nodeById, setActiveNode]);

  const handleConvey = useCallback((id: string) => {
    setConveyParentId(id);
  }, []);

  const handlePrecede = useCallback((id: string) => {
    setPrecedeNodeId(id);
  }, []);

  const handleAttachDoc = useCallback((id: string) => {
    setAttachDocParentId(id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const node = nodeById.get(id) ?? null;
    const leaseDeletionPlan = planDeskMapLeaseDeletion(nodes, id);
    const message = leaseDeletionPlan.leaseId
      ? leaseDeletionPlan.removeOwnerLeaseRecord
        ? 'Delete this lessee card and remove the linked lease from the owner record?'
        : 'Delete this lessee card? The linked owner lease record is also used by another Desk Map card and will stay in owner info.'
      : node?.type === 'related'
      ? 'Delete this related node? Any attached related records beneath it will also be removed.'
      : 'Delete this node? Its branch will be removed, and any conveyed amount will be restored to the grantor.';

    if (confirm(message)) {
      void (async () => {
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
            alert(`Could not delete this node.\n\n${reason}`);
          }
        } catch (deleteError) {
          console.error(deleteError);
          alert('Delete failed. The card was left in place so owner data stays consistent.');
        }
      })();
    }
  }, [nodeById, nodes, removeLeaseRecord, removeNode]);

  const handleViewPdf = useCallback((id: string) => {
    setPdfViewNodeId(id);
  }, []);

  const handleAddRoot = useCallback(() => {
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
  }, [addNode, addNodeToActiveDeskMap, createDeskMap, deskMaps.length, setActiveNode]);

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
    <div className="w-full h-full relative flex flex-col">
      {/* Desk map tabs */}
      <DeskMapTabs />

      <div className="flex-1 relative overflow-hidden bg-canvas-bg">
        {/* Toolbar */}
        <div
          className={`absolute top-3 left-3 z-20 max-w-[calc(100%-1.5rem)] rounded-xl bg-parchment/92 backdrop-blur border border-ledger-line shadow-md ${
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
                onClick={handleAddRoot}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
              >
                + Add Root
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
                  className="min-w-0 flex-1 rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
                />
                {ownerSearchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOwnerSearchQuery('')}
                    className="rounded-lg border border-ledger-line px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-light transition-colors hover:bg-parchment-dark/70"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>

            {ownerSearchQuery.trim().length > 0 && (
              <div className="rounded-lg border border-ledger-line bg-parchment-dark/35 px-2.5 py-2">
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
            <div className="rounded-lg border border-seal/30 bg-seal/10 px-2.5 py-2 text-[10px] leading-4 text-seal">
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
              />
            </div>
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
              <button
                onClick={handleAddRoot}
                className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors"
              >
                + Add Root Node
              </button>
            </div>
          </div>
        ) : (
          <PanZoomContainer>
            <div className="flex gap-16">
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
                  onAttachDoc={handleAttachDoc}
                  onDelete={handleDelete}
                  onViewPdf={handleViewPdf}
                />
              ))}
            </div>
          </PanZoomContainer>
        )}

        <OwnershipNodeEditorModals
          route={editorRoute}
          onSetRoute={setEditorRoute}
          npriParentId={npriParentId}
          onSetNpriParentId={setNpriParentId}
          pdfViewNodeId={pdfViewNodeId}
          onSetPdfViewNodeId={setPdfViewNodeId}
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
  );
}
