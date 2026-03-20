/**
 * Desk Map View — the primary working area for building title chains.
 *
 * Renders the ownership tree as a hierarchy of cards with CSS connectors.
 * Pan/zoom via mouse drag and scroll wheel.
 * Click a card to edit, hover for action buttons (convey, precede, delete).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import DeskMapCard from '../components/deskmap/DeskMapCard';
import DeskMapTabs from '../components/deskmap/DeskMapTabs';
import NodeEditModal from '../components/modals/NodeEditModal';
import ConveyModal from '../components/modals/ConveyModal';
import PredecessorModal from '../components/modals/PredecessorModal';
import AttachDocModal from '../components/modals/AttachDocModal';
import PdfViewerModal from '../components/modals/PdfViewerModal';
import type { OwnershipNode } from '../types/node';
import { createBlankNode } from '../types/node';

// ── Tree building ───────────────────────────────────────

interface TreeNode {
  node: OwnershipNode;
  children: TreeNode[];
  relatedDocs: TreeNode[];
}

function buildTree(nodes: OwnershipNode[]): TreeNode[] {
  const childrenOf = new Map<string, OwnershipNode[]>();
  const relatedOf = new Map<string, OwnershipNode[]>();

  for (const n of nodes) {
    if (!n.parentId || n.parentId === 'unlinked') continue;
    if (n.type === 'related') {
      if (!relatedOf.has(n.parentId)) relatedOf.set(n.parentId, []);
      relatedOf.get(n.parentId)!.push(n);
    } else {
      if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
      childrenOf.get(n.parentId)!.push(n);
    }
  }

  function build(node: OwnershipNode): TreeNode {
    return {
      node,
      children: (childrenOf.get(node.id) ?? []).map(build),
      relatedDocs: (relatedOf.get(node.id) ?? []).map((r) => ({
        node: r,
        children: [],
        relatedDocs: [],
      })),
    };
  }

  const roots = nodes.filter(
    (n) => n.parentId == null && n.type !== 'related'
  );
  const unlinked = nodes.filter((n) => n.parentId === 'unlinked');
  return [...roots, ...unlinked].map(build);
}

// ── Tree branch renderer ────────────────────────────────

function TreeBranch({
  tree,
  parentInitialFraction,
  activeNodeId,
  onEdit,
  onConvey,
  onPrecede,
  onAttachDoc,
  onDelete,
}: {
  tree: TreeNode;
  parentInitialFraction: string | null;
  activeNodeId: string | null;
  onEdit: (id: string) => void;
  onConvey: (id: string) => void;
  onPrecede: (id: string) => void;
  onAttachDoc: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="tree-branch">
      <DeskMapCard
        node={tree.node}
        parentInitialFraction={parentInitialFraction}
        relatedDocs={tree.relatedDocs.map((r) => r.node)}
        onEdit={onEdit}
        onConvey={onConvey}
        onPrecede={onPrecede}
        onAttachDoc={onAttachDoc}
        onDelete={onDelete}
        isActive={activeNodeId === tree.node.id}
      />

      {tree.children.length > 0 && (
        <div className="tree-children">
          {tree.children.map((child) => (
            <TreeBranch
              key={child.node.id}
              tree={child}
              parentInitialFraction={tree.node.initialFraction}
              activeNodeId={activeNodeId}
              onEdit={onEdit}
              onConvey={onConvey}
              onPrecede={onPrecede}
              onAttachDoc={onAttachDoc}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pan/zoom container ──────────────────────────────────

function PanZoomContainer({ children }: { children: React.ReactNode }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  // Native event listeners — mousemove/mouseup on window so drag
  // continues reliably even when the cursor leaves the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      isPanning.current = true;
      hasDragged.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
      }
      setPan((p) => ({
        x: p.x + e.clientX - lastPos.current.x,
        y: p.y + e.clientY - lastPos.current.y,
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isPanning.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const oldZoom = zoomRef.current;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(0.1, Math.min(3, oldZoom * factor));
      const p = panRef.current;

      const newPanX = mouseX - ((mouseX - p.x) / oldZoom) * newZoom;
      const newPanY = mouseY - ((mouseY - p.y) / oldZoom) * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // After a drag, suppress the click so card onClick handlers don't fire
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-canvas-bg cursor-grab active:cursor-grabbing select-none"
      onClickCapture={handleClickCapture}
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

// ── Main view ───────────────────────────────────────────

export default function DeskMapView() {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeNodeId = useWorkspaceStore((s) => s.activeNodeId);
  const setActiveNode = useWorkspaceStore((s) => s.setActiveNode);
  const removeNode = useWorkspaceStore((s) => s.removeNode);
  const addNode = useWorkspaceStore((s) => s.addNode);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);
  const getActiveDeskMapNodes = useWorkspaceStore((s) => s.getActiveDeskMapNodes);

  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [conveyParentId, setConveyParentId] = useState<string | null>(null);
  const [precedeNodeId, setPrecedeNodeId] = useState<string | null>(null);
  const [attachDocParentId, setAttachDocParentId] = useState<string | null>(null);
  const [pdfViewNodeId, setPdfViewNodeId] = useState<string | null>(null);

  // Auto-create a desk map if none exist (assigning any existing nodes to it)
  useEffect(() => {
    if (deskMaps.length === 0) {
      const currentNodes = useWorkspaceStore.getState().nodes;
      const nodeIds = currentNodes.map((n) => n.id);
      createDeskMap('Tract 1', 'T1', nodeIds.length > 0 ? nodeIds : undefined);
    }
  }, [deskMaps.length, createDeskMap]);

  // Show nodes for active desk map (or all if none selected)
  const visibleNodes = getActiveDeskMapNodes();
  const trees = buildTree(visibleNodes);
  const editNode = editNodeId ? nodes.find((n) => n.id === editNodeId) : null;
  const conveyParent = conveyParentId ? nodes.find((n) => n.id === conveyParentId) : null;
  const precedeNode = precedeNodeId ? nodes.find((n) => n.id === precedeNodeId) : null;

  const handleEdit = useCallback((id: string) => {
    setActiveNode(id);
    setEditNodeId(id);
  }, [setActiveNode]);

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
    if (confirm(`Delete this node? Any children will become orphaned.`)) {
      removeNode(id);
    }
  }, [removeNode]);

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

      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-parchment/95 backdrop-blur border border-ledger-line shadow-lg px-3 py-2">
          <button
            onClick={handleAddRoot}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
          >
            + Add Root
          </button>
          <span className="text-[10px] text-ink-light font-mono">
            {visibleNodes.length} nodes
          </span>
        </div>

        {visibleNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
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
                  activeNodeId={activeNodeId}
                  onEdit={handleEdit}
                  onConvey={handleConvey}
                  onPrecede={handlePrecede}
                  onAttachDoc={handleAttachDoc}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </PanZoomContainer>
        )}

        {/* Edit modal */}
        {editNode && (
          <NodeEditModal
            node={editNode}
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

        {/* PDF viewer modal */}
        {pdfViewNodeId && (
          <PdfViewerModal
            nodeId={pdfViewNodeId}
            onClose={() => setPdfViewNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
