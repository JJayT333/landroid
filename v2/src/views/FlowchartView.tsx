/**
 * Miro-style infinite-zoom flowchart canvas.
 *
 * ONE canvas. No pages, no sheets. Import the entire tree, zoom to fit.
 * Each box is independently draggable — edges follow dynamically.
 *
 * React Flow v12 handles:
 *   - Infinite pan/zoom (0.02x to 4x)
 *   - Node dragging with edge re-routing
 *   - Box/lasso selection for multi-drag
 *   - Minimap for navigation
 *   - fitView to auto-zoom the entire tree into viewport
 *
 * Page grid overlay lets the user visualize print boundaries
 * and position nodes so nothing lands where pages meet.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import OwnershipNodeComponent from '../components/canvas/OwnershipNode';
import ShapeNodeComponent from '../components/canvas/ShapeNode';
import CanvasToolbar from '../components/canvas/CanvasToolbar';
import PageGrid, {
  getPageDimensions,
  type PageOrientation,
} from '../components/canvas/PageGrid';
import PrintOverlay from '../components/canvas/PrintOverlay';
import { useWorkspaceStore } from '../store/workspace-store';
import { layoutOwnershipTree } from '../engine/tree-layout';
import type { FlowTool, OwnershipNodeData } from '../types/flowchart';

const NODE_WIDTH = 288;
const NODE_HEIGHT = 160;

const nodeTypes: NodeTypes = {
  ownership: OwnershipNodeComponent,
  shape: ShapeNodeComponent,
};

function FlowchartCanvas() {
  const getActiveDeskMapNodes = useWorkspaceStore((s) => s.getActiveDeskMapNodes);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [activeTool, setActiveTool] = useState<FlowTool>('select');
  const [nodeCount, setNodeCount] = useState(0);

  // Page grid state
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(2);
  const [orientation, setOrientation] = useState<PageOrientation>('landscape');

  const { fitView } = useReactFlow();

  // Import ownership tree from active desk map to canvas
  const handleImportTree = useCallback(() => {
    const deskMapNodes = getActiveDeskMapNodes();
    if (deskMapNodes.length === 0) return;
    const { flowNodes, flowEdges } = layoutOwnershipTree(deskMapNodes);
    setNodes(flowNodes as Node[]);
    setEdges(flowEdges as Edge[]);
    setNodeCount(flowNodes.length);
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
  }, [getActiveDeskMapNodes, setNodes, setEdges, fitView]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setNodeCount(0);
  }, [setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  // ── Fit to Grid ──────────────────────────────────────────
  // Scales and repositions all node positions so the tree fits
  // within the current page grid. Node sizes stay the same —
  // only the layout spacing changes.
  const handleFitToGrid = useCallback(() => {
    if (nodes.length === 0) return;

    // Bounding box of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.position.y + (n.measured?.height ?? NODE_HEIGHT));
    }

    const treeW = maxX - minX;
    const treeH = maxY - minY;
    if (treeW === 0 || treeH === 0) return;

    const { pw, ph } = getPageDimensions(orientation);
    const gridW = pw * gridCols;
    const gridH = ph * gridRows;

    const margin = 40;
    const targetW = gridW - 2 * margin;
    const targetH = gridH - 2 * margin;

    // Scale to fit (preserve aspect ratio)
    const scale = Math.min(targetW / treeW, targetH / treeH);

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: {
          x: (n.position.x - minX) * scale + margin,
          y: (n.position.y - minY) * scale + margin,
        },
      }))
    );
    setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 50);
  }, [nodes, setNodes, fitView, gridCols, gridRows, orientation]);

  // ── Select All (for group drag) ──────────────────────────
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setNodes]);

  // ── Print ────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    // Give React one frame to ensure the print overlay is fully rendered
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  // Auto-import if desk map has nodes but canvas is empty
  const deskMapNodes = getActiveDeskMapNodes();
  useEffect(() => {
    if (deskMapNodes.length > 0 && nodes.length === 0) {
      handleImportTree();
    }
  }, [deskMapNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Print data (reactive — derived from nodes/edges state) ─
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
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onImportTree={handleImportTree}
        onClear={handleClear}
        gridCols={gridCols}
        gridRows={gridRows}
        orientation={orientation}
        onGridColsChange={setGridCols}
        onGridRowsChange={setGridRows}
        onOrientationChange={setOrientation}
        onFitToGrid={handleFitToGrid}
        onSelectAll={handleSelectAll}
        onPrint={handlePrint}
      />

      {/* Node count indicator */}
      {nodeCount > 0 && (
        <div className="no-print absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-parchment/95 backdrop-blur border border-ledger-line shadow text-xs font-mono text-ink-light">
          {nodeCount} nodes on canvas
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        panOnDrag
        selectionOnDrag={activeTool === 'select'}
        nodesDraggable={true}
        nodesConnectable={activeTool === 'connect'}
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

      {/* Print overlay — portaled to document.body so it's outside
          all overflow-hidden / h-screen constraints. Page breaks work. */}
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

/**
 * Wrapper with ReactFlowProvider so useReactFlow() hook works.
 */
export default function FlowchartView() {
  return (
    <ReactFlowProvider>
      <FlowchartCanvas />
    </ReactFlowProvider>
  );
}
