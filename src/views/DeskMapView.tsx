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
import DeskMapCard from '../components/deskmap/DeskMapCard';
import DeskMapLeaseCard from '../components/deskmap/DeskMapLeaseCard';
import DeskMapNpriCard from '../components/deskmap/DeskMapNpriCard';
import { isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import {
  buildDeskMapTree,
  type DeskMapTreeNode,
} from '../components/deskmap/deskmap-tree';
import DeskMapTabs from '../components/deskmap/DeskMapTabs';
import {
  calculateDeskMapCoverageSummary,
  pickPrimaryLease,
  toDeskMapPrimaryLeaseSummary,
  type DeskMapPrimaryLeaseSummary,
} from '../components/deskmap/deskmap-coverage';
import NodeEditModal from '../components/modals/NodeEditModal';
import ConveyModal from '../components/modals/ConveyModal';
import CreateNpriModal from '../components/modals/CreateNpriModal';
import PredecessorModal from '../components/modals/PredecessorModal';
import AttachDocModal from '../components/modals/AttachDocModal';
import AttachLeaseModal from '../components/modals/AttachLeaseModal';
import PdfViewerModal from '../components/modals/PdfViewerModal';
import { createBlankNode, isNpriNode } from '../types/node';
import { createBlankOwner } from '../types/owner';

// ── Tree branch renderer ────────────────────────────────

interface TreeBranchProps {
  tree: DeskMapTreeNode;
  parentInitialFraction: string | null;
  leaseSummaryByNodeId: Map<string, DeskMapPrimaryLeaseSummary>;
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

function deriveCounty(landDesc: string) {
  const match = landDesc.match(/([A-Za-z .'-]+?)\s+County\b/i);
  return match?.[1]?.trim() ?? '';
}

function formatCoveragePercent(value: string) {
  return `${d(value).times(100).toFixed(2)}%`;
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
  const setView = useUIStore((state) => state.setView);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const ownerWorkspaceId = useOwnerStore((state) => state.workspaceId);
  const addOwnerRecord = useOwnerStore((state) => state.addOwner);
  const selectOwner = useOwnerStore((state) => state.selectOwner);
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const removeNode = useWorkspaceStore((s) => s.removeNode);
  const addNode = useWorkspaceStore((s) => s.addNode);
  const updateNode = useWorkspaceStore((s) => s.updateNode);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);

  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [conveyParentId, setConveyParentId] = useState<string | null>(null);
  const [precedeNodeId, setPrecedeNodeId] = useState<string | null>(null);
  const [attachDocParentId, setAttachDocParentId] = useState<string | null>(null);
  const [leaseParentId, setLeaseParentId] = useState<string | null>(null);
  const [npriParentId, setNpriParentId] = useState<string | null>(null);
  const [pdfViewNodeId, setPdfViewNodeId] = useState<string | null>(null);

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

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const ownerById = useMemo(
    () => new Map(owners.map((owner) => [owner.id, owner])),
    [owners]
  );
  const primaryLeaseByOwnerId = useMemo(() => {
    const groupedLeases = new Map<string, typeof leases>();
    leases.forEach((lease) => {
      const existing = groupedLeases.get(lease.ownerId) ?? [];
      existing.push(lease);
      groupedLeases.set(lease.ownerId, existing);
    });

    return new Map(
      [...groupedLeases.entries()]
        .map(([ownerId, ownerLeases]) => [
          ownerId,
          toDeskMapPrimaryLeaseSummary(pickPrimaryLease(ownerLeases)),
        ] as const)
        .filter((entry): entry is [string, DeskMapPrimaryLeaseSummary] => entry[1] !== null)
    );
  }, [leases]);
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
          if (node.type === 'related' || !node.linkedOwnerId || isNpriNode(node)) {
            return [];
          }
          const leaseSummary = primaryLeaseByOwnerId.get(node.linkedOwnerId);
          return leaseSummary ? ([[node.id, leaseSummary]] as Array<[string, DeskMapPrimaryLeaseSummary]>) : [];
        })
      ),
    [primaryLeaseByOwnerId, visibleNodes]
  );
  const coverageSummary = useMemo(
    () => calculateDeskMapCoverageSummary(visibleNodes, primaryLeaseByOwnerId),
    [primaryLeaseByOwnerId, visibleNodes]
  );
  const trees = useMemo(() => buildDeskMapTree(visibleNodes), [visibleNodes]);
  const editNode = editNodeId ? nodeById.get(editNodeId) ?? null : null;
  const conveyParent = conveyParentId ? nodeById.get(conveyParentId) ?? null : null;
  const precedeNode = precedeNodeId ? nodeById.get(precedeNodeId) ?? null : null;
  const leaseParent = leaseParentId ? nodeById.get(leaseParentId) ?? null : null;
  const npriParent = npriParentId ? nodeById.get(npriParentId) ?? null : null;
  const pdfViewNode = pdfViewNodeId ? nodeById.get(pdfViewNodeId) ?? null : null;

  const handleEdit = useCallback((id: string) => {
    const node = nodeById.get(id) ?? null;
    if (node && isLeaseNode(node) && node.parentId) {
      setActiveNode(node.id);
      setLeaseParentId(node.parentId);
      return;
    }

    setActiveNode(id);
    setEditNodeId(id);
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
    const message = node?.type === 'related'
      ? 'Delete this related node? Any attached related records beneath it will also be removed.'
      : 'Delete this node? Its branch will be removed, and any conveyed amount will be restored to the grantor.';

    if (confirm(message)) {
      removeNode(id);
    }
  }, [nodeById, removeNode]);

  const handleViewPdf = useCallback((id: string) => {
    setPdfViewNodeId(id);
  }, []);

  const handleManageLease = useCallback(
    (nodeId: string) => {
      setEditNodeId(null);
      setLeaseParentId(nodeId);
    },
    []
  );

  const handleManageNpri = useCallback(
    (nodeId: string) => {
      setEditNodeId(null);
      setNpriParentId(nodeId);
    },
    []
  );

  const handleManageOwner = useCallback(
    async (nodeId: string) => {
      const node = nodeById.get(nodeId) ?? null;
      if (!node) return;
      if (node.type === 'related' && !node.linkedOwnerId) return;

      const linkedOwner = node.linkedOwnerId
        ? ownerById.get(node.linkedOwnerId) ?? null
        : null;

      if (linkedOwner) {
        selectOwner(linkedOwner.id);
        setView('owners');
        setEditNodeId(null);
        return;
      }

      const nextOwner = createBlankOwner(ownerWorkspaceId ?? workspaceId, {
        name: node.grantee || 'New Owner',
        county: deriveCounty(node.landDesc),
        prospect: activeDeskMap?.name ?? '',
        notes: [
          node.instrument ? `Source Instrument: ${node.instrument}` : '',
          node.docNo ? `Doc #: ${node.docNo}` : '',
          node.landDesc ? `Land: ${node.landDesc}` : '',
          node.remarks ? `Remarks: ${node.remarks}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });

      await addOwnerRecord(nextOwner);
      updateNode(node.id, { linkedOwnerId: nextOwner.id });
      selectOwner(nextOwner.id);
      setView('owners');
      setEditNodeId(null);
    },
    [
      activeDeskMap?.name,
      addOwnerRecord,
      nodeById,
      ownerWorkspaceId,
      ownerById,
      selectOwner,
      setView,
      updateNode,
      workspaceId,
    ]
  );

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
    addNodeToActiveDeskMap(id);
    setEditNodeId(id);
  }, [addNode, addNodeToActiveDeskMap]);

  return (
    <div className="w-full h-full relative flex flex-col">
      {/* Desk map tabs */}
      <DeskMapTabs />

      <div className="flex-1 relative overflow-hidden bg-canvas-bg">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 w-[19.5rem] max-w-[calc(100%-1.5rem)] space-y-2.5 rounded-xl bg-parchment/92 backdrop-blur border border-ledger-line shadow-md p-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRoot}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
            >
              + Add Root
            </button>
            <span className="text-[10px] text-ink-light font-mono">
              {visibleCardCount} cards
            </span>
          </div>
          <div className="text-[9px] leading-tight text-ink-light">
            Add more than one root when title starts from separate families. Temporary
            coverage over 100% is okay until you reconcile farther back in title.
          </div>

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

        {/* Edit modal */}
        {editNode && (
          <NodeEditModal
            node={editNode}
            linkedOwnerName={
              editNode.linkedOwnerId
                ? ownerById.get(editNode.linkedOwnerId)?.name ?? null
                : null
            }
            leaseStatusText={
              editNode.type !== 'related'
                ? (() => {
                    const leaseSummary = leaseSummaryByNodeId.get(editNode.id) ?? null;
                    if (!leaseSummary) return null;
                    return leaseSummary.lessee
                      ? `Leased to ${leaseSummary.lessee}`
                      : 'Lease node on file';
                  })()
                : null
            }
            onManageOwner={handleManageOwner}
            onManageLease={handleManageLease}
            onManageNpri={handleManageNpri}
            onClose={() => setEditNodeId(null)}
            onViewPdf={(id) => {
              setEditNodeId(null);
              setPdfViewNodeId(id);
            }}
          />
        )}

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

        {leaseParent && (
          <AttachLeaseModal
            parentNode={leaseParent}
            onClose={() => setLeaseParentId(null)}
            onSaved={(nodeId) => {
              setLeaseParentId(null);
              setActiveNode(nodeId);
            }}
          />
        )}

        {npriParent && (
          <CreateNpriModal
            parentNode={npriParent}
            onClose={() => setNpriParentId(null)}
          />
        )}

        {/* PDF viewer modal */}
        {pdfViewNodeId && (
          <PdfViewerModal
            nodeId={pdfViewNodeId}
            fileNameHint={pdfViewNode?.docNo ? `${pdfViewNode.docNo}.pdf` : null}
            onClose={() => setPdfViewNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
