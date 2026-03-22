/**
 * Miro-style infinite-zoom flowchart canvas.
 *
 * ONE canvas. No pages, no sheets. Import the entire tree, zoom to fit.
 * Each box is independently draggable — edges follow dynamically.
 *
 * State lives in canvas-store (Zustand) for undo/redo, persistence,
 * and keyboard shortcuts. React Flow is a controlled component.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import OwnershipNodeComponent from '../components/canvas/OwnershipNode';
import ShapeNodeComponent from '../components/canvas/ShapeNode';
import CanvasToolbar from '../components/canvas/CanvasToolbar';
import PageGrid, { getPageDimensions } from '../components/canvas/PageGrid';
import PrintOverlay from '../components/canvas/PrintOverlay';
import { useWorkspaceStore } from '../store/workspace-store';
import { useCanvasStore } from '../store/canvas-store';
import { layoutOwnershipTree } from '../engine/tree-layout';
import useCanvasKeyboardShortcuts from '../hooks/useCanvasKeyboardShortcuts';
import type { OwnershipNodeData } from '../types/flowchart';

const NODE_WIDTH = 288;
const NODE_HEIGHT = 160;

const nodeTypes: NodeTypes = {
  ownership: OwnershipNodeComponent,
  shape: ShapeNodeComponent,
};

// ── Resize overlay ────────────────────────────────────────
// Renders a bounding box with a corner drag handle over the canvas.
// Dragging the corner uniformly scales all node positions, sizes, and edge strokes.

function ResizeOverlay({
  originals,
  onDone,
}: {
  originals: {
    nodes: Node[];
    edges: Edge[];
    bbox: { minX: number; minY: number; w: number; h: number };
  };
  onDone: () => void;
}) {
  const viewport = useViewport();
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ startX: number; startScale: number } | null>(null);

  const { bbox } = originals;

  // Current bbox in screen coordinates (tracks viewport pan/zoom)
  const screenX = bbox.minX * viewport.zoom + viewport.x;
  const screenY = bbox.minY * viewport.zoom + viewport.y;
  const screenW = bbox.w * scale * viewport.zoom;
  const screenH = bbox.h * scale * viewport.zoom;

  const applyScale = useCallback(
    (newScale: number) => {
      setScale(newScale);
      setNodes(
        originals.nodes.map((n) => ({
          ...n,
          position: {
            x: (n.position.x - bbox.minX) * newScale + bbox.minX,
            y: (n.position.y - bbox.minY) * newScale + bbox.minY,
          },
          data:
            n.type === 'ownership'
              ? {
                  ...n.data,
                  nodeScale: Math.max(
                    0.2,
                    ((n.data as unknown as OwnershipNodeData).nodeScale ?? 1) * newScale
                  ),
                }
              : n.data,
        }))
      );
      setEdges(
        originals.edges.map((e) => ({
          ...e,
          style: {
            ...e.style,
            strokeWidth: Math.max(
              0.3,
              ((e.style?.strokeWidth as number) ?? 2) * newScale
            ),
          },
        }))
      );
    },
    [originals, bbox, setNodes, setEdges]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startScale: scale };
    },
    [scale]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const startScreenW = bbox.w * dragRef.current.startScale * viewport.zoom;
      const newScale = Math.max(
        0.2,
        Math.min(3, dragRef.current.startScale * ((startScreenW + dx) / startScreenW))
      );
      applyScale(newScale);
    },
    [bbox.w, viewport.zoom, applyScale]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Bounding box outline */}
      <div
        style={{
          position: 'absolute',
          left: screenX - 4,
          top: screenY - 4,
          width: screenW + 8,
          height: screenH + 8,
          border: '2px dashed var(--color-leather)',
          borderRadius: 8,
        }}
      />

      {/* Corner handles — all four corners for easier access */}
      {[
        { cx: screenX + screenW, cy: screenY + screenH, cursor: 'nwse-resize' },
        { cx: screenX, cy: screenY + screenH, cursor: 'nesw-resize' },
        { cx: screenX + screenW, cy: screenY, cursor: 'nesw-resize' },
        { cx: screenX, cy: screenY, cursor: 'nwse-resize' },
      ].map((h, i) => (
        <div
          key={i}
          className="pointer-events-auto"
          style={{
            position: 'absolute',
            left: h.cx - 6,
            top: h.cy - 6,
            width: 12,
            height: 12,
            background: 'var(--color-leather)',
            border: '2px solid var(--color-parchment)',
            borderRadius: 3,
            cursor: h.cursor,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ))}

      {/* Scale percentage label */}
      <div
        style={{
          position: 'absolute',
          left: screenX + screenW + 12,
          top: screenY + screenH - 10,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-leather)',
          fontWeight: 'bold',
          background: 'var(--color-parchment)',
          padding: '2px 6px',
          borderRadius: 4,
          border: '1px solid var(--color-ledger-line)',
        }}
      >
        {Math.round(scale * 100)}%
      </div>

      {/* Done button */}
      <button
        className="pointer-events-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-leather text-parchment hover:bg-leather-light shadow-lg transition-colors"
        style={{
          position: 'absolute',
          left: screenX + screenW / 2 - 40,
          top: screenY - 32,
        }}
        onClick={onDone}
      >
        Done Resizing
      </button>
    </div>
  );
}

function FlowchartCanvas() {
  const getActiveDeskMapNodes = useWorkspaceStore((s) => s.getActiveDeskMapNodes);

  // ── Canvas store ───────────────────────────────────────
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const gridCols = useCanvasStore((s) => s.gridCols);
  const gridRows = useCanvasStore((s) => s.gridRows);
  const orientation = useCanvasStore((s) => s.orientation);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const importGraph = useCanvasStore((s) => s.importGraph);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const { fitView } = useReactFlow();

  // ── Keyboard shortcuts ─────────────────────────────────
  useCanvasKeyboardShortcuts();

  // ── Import ownership tree from active desk map ─────────
  const handleImportTree = useCallback(() => {
    const deskMapNodes = getActiveDeskMapNodes();
    if (deskMapNodes.length === 0) return;
    const { flowNodes, flowEdges } = layoutOwnershipTree(deskMapNodes);
    importGraph(flowNodes as Node[], flowEdges);
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
  }, [getActiveDeskMapNodes, importGraph, fitView]);

  // ── Fit to Grid ────────────────────────────────────────
  // Scales both node positions AND node sizes uniformly so the tree
  // maintains its shape at a smaller size. Minimum scale 0.35 keeps
  // text legible; if the tree is still too large, the grid auto-expands.
  const handleFitToGrid = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();

    // 1. Bounding box of all nodes at their current (unscaled) size
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const nw = n.type === 'ownership' ? NODE_WIDTH : ((n.data as Record<string, unknown>)?.width as number ?? NODE_WIDTH);
      const nh = n.measured?.height ?? (n.type === 'ownership' ? NODE_HEIGHT : ((n.data as Record<string, unknown>)?.height as number ?? NODE_HEIGHT));
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + nw);
      maxY = Math.max(maxY, n.position.y + nh);
    }

    const treeW = maxX - minX;
    const treeH = maxY - minY;
    if (treeW === 0 || treeH === 0) return;

    const { pw, ph } = getPageDimensions(orientation);
    const margin = 40;

    // 2. Uniform scale to fit tree into grid
    const MIN_NODE_SCALE = 0.35;
    const gridW = pw * gridCols;
    const gridH = ph * gridRows;
    const rawScale = Math.min(
      (gridW - 2 * margin) / treeW,
      (gridH - 2 * margin) / treeH
    );

    // Clamp: never enlarge nodes (cap at 1), never shrink below 0.35
    const nodeScale = Math.min(Math.max(rawScale, MIN_NODE_SCALE), 1);

    // 3. If tree doesn't fit even at minimum scale, expand the grid
    if (rawScale < MIN_NODE_SCALE) {
      const neededW = treeW * MIN_NODE_SCALE + 2 * margin;
      const neededH = treeH * MIN_NODE_SCALE + 2 * margin;
      const newCols = Math.max(gridCols, Math.ceil(neededW / pw));
      const newRows = Math.max(gridRows, Math.ceil(neededH / ph));
      useCanvasStore.getState().setGridCols(newCols);
      useCanvasStore.getState().setGridRows(newRows);
    }

    // 4. Scale positions uniformly and set nodeScale on ownership nodes
    const store = useCanvasStore.getState();
    store.setNodes(
      nodes.map((n) => ({
        ...n,
        position: {
          x: (n.position.x - minX) * nodeScale + margin,
          y: (n.position.y - minY) * nodeScale + margin,
        },
        data: n.type === 'ownership'
          ? { ...n.data, nodeScale }
          : n.data,
      }))
    );

    // 5. Scale edge stroke widths to match node scale
    const currentEdges = store.edges;
    store.setEdges(
      currentEdges.map((e) => {
        const baseStroke = (e.style?.stroke === '#a0522d') ? 1 : 2;
        return {
          ...e,
          style: { ...e.style, strokeWidth: Math.max(0.5, baseStroke * nodeScale) },
        };
      })
    );

    setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 50);
  }, [nodes, pushHistory, fitView, gridCols, gridRows, orientation]);

  // ── Print ──────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    requestAnimationFrame(() => window.print());
  }, []);

  // ── Push history before drag starts ────────────────────
  const handleNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  // ── Persist viewport on move ───────────────────────────
  const handleMoveEnd = useCallback(
    (_event: unknown, vp: { x: number; y: number; zoom: number }) => {
      setViewport(vp);
    },
    [setViewport]
  );

  // ── Auto-import if desk map has nodes but canvas is empty
  const deskMapNodes = getActiveDeskMapNodes();
  useEffect(() => {
    if (deskMapNodes.length > 0 && nodes.length === 0) {
      handleImportTree();
    }
  }, [deskMapNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize mode ──────────────────────────────────────────
  const [resizeMode, setResizeMode] = useState(false);
  const resizeOriginals = useRef<{
    nodes: Node[];
    edges: Edge[];
    bbox: { minX: number; minY: number; w: number; h: number };
  } | null>(null);

  const handleEnterResize = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const ns = n.type === 'ownership' ? ((n.data as unknown as OwnershipNodeData).nodeScale ?? 1) : 1;
      const nw = n.type === 'ownership' ? NODE_WIDTH * ns : ((n.data as Record<string, unknown>)?.width as number ?? NODE_WIDTH);
      const nh = n.measured?.height ?? (n.type === 'ownership' ? NODE_HEIGHT * ns : ((n.data as Record<string, unknown>)?.height as number ?? NODE_HEIGHT));
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + nw);
      maxY = Math.max(maxY, n.position.y + nh);
    }

    resizeOriginals.current = {
      nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
      edges: edges.map((e) => ({ ...e, style: { ...e.style } })),
      bbox: { minX, minY, w: maxX - minX, h: maxY - minY },
    };
    setResizeMode(true);
  }, [nodes, edges, pushHistory]);

  const handleExitResize = useCallback(() => {
    setResizeMode(false);
    resizeOriginals.current = null;
  }, []);

  // Escape key exits resize mode
  useEffect(() => {
    if (!resizeMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExitResize();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [resizeMode, handleExitResize]);

  // ── Print data ─────────────────────────────────────────
  const printNodes = nodes.map((n) => ({
    id: n.id,
    position: n.position,
    data: n.data as unknown as OwnershipNodeData,
    measured: n.measured,
  }));
  const printEdges = edges.map((e) => ({
    source: e.source,
    target: e.target,
  }));

  return (
    <div className="w-full h-full relative">
      <CanvasToolbar
        onImportTree={handleImportTree}
        onFitToGrid={handleFitToGrid}
        onResize={handleEnterResize}
        resizeMode={resizeMode}
        onPrint={handlePrint}
      />

      {nodes.length > 0 && (
        <div className="no-print absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-parchment/95 backdrop-blur border border-ledger-line shadow text-xs font-mono text-ink-light">
          {nodes.length} nodes on canvas
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        panOnDrag={!resizeMode}
        selectionOnDrag={!resizeMode && activeTool === 'select'}
        nodesDraggable={!resizeMode}
        nodesConnectable={activeTool === 'connect'}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        deleteKeyCode={null}
        minZoom={0.02}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <PageGrid cols={gridCols} rows={gridRows} orientation={orientation} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="var(--color-canvas-dot)"
        />
        <Controls
          className="!bg-parchment !border-ledger-line !rounded-xl !shadow-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeStrokeColor="#8b4513"
          nodeColor="#faf3e8"
          maskColor="rgba(250, 243, 232, 0.7)"
          className="!rounded-xl"
          pannable
          zoomable
        />
      </ReactFlow>

      {resizeMode && resizeOriginals.current && (
        <ResizeOverlay
          originals={resizeOriginals.current}
          onDone={handleExitResize}
        />
      )}

      {createPortal(
        <PrintOverlay
          nodes={printNodes}
          edges={printEdges}
          cols={gridCols}
          rows={gridRows}
          orientation={orientation}
        />,
        document.body
      )}
    </div>
  );
}

export default function FlowchartView() {
  return (
    <ReactFlowProvider>
      <FlowchartCanvas />
    </ReactFlowProvider>
  );
}
