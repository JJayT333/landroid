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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useWorkspaceStore } from '../store/workspace-store';
import { layoutOwnershipTree } from '../engine/tree-layout';
import { importCSV } from '../storage/csv-io';
import type { FlowTool } from '../types/flowchart';

const nodeTypes: NodeTypes = {
  ownership: OwnershipNodeComponent,
  shape: ShapeNodeComponent,
};

function FlowchartCanvas() {
  const ownershipNodes = useWorkspaceStore((s) => s.nodes);
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [activeTool, setActiveTool] = useState<FlowTool>('select');
  const [nodeCount, setNodeCount] = useState(0);

  const { fitView } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import ownership tree to canvas — single canvas, no pages
  const handleImportTree = useCallback(() => {
    if (ownershipNodes.length === 0) return;
    const { flowNodes, flowEdges } = layoutOwnershipTree(ownershipNodes);
    setNodes(flowNodes as Node[]);
    setEdges(flowEdges as Edge[]);
    setNodeCount(flowNodes.length);
    // Fit entire tree into view after a tick for React Flow to measure
    setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
  }, [ownershipNodes, setNodes, setEdges, fitView]);

  // CSV file import
  const handleFileImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const csvText = evt.target?.result as string;
        const result = importCSV(csvText);

        // Load into workspace store
        loadWorkspace({
          projectName: result.projectName,
          nodes: result.nodes,
          deskMaps: result.deskMaps,
          activeDeskMapId: result.activeDeskMapId,
        });

        // Layout and display on canvas
        const { flowNodes, flowEdges } = layoutOwnershipTree(result.nodes);
        setNodes(flowNodes as Node[]);
        setEdges(flowEdges as Edge[]);
        setNodeCount(flowNodes.length);
        setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
      } catch (err) {
        console.error('CSV import failed:', err);
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = '';
  }, [loadWorkspace, setNodes, setEdges, fitView]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setNodeCount(0);
  }, [setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(connection, eds)
      ),
    [setEdges]
  );

  // Auto-import if workspace has nodes but canvas is empty
  useEffect(() => {
    if (ownershipNodes.length > 0 && nodes.length === 0) {
      handleImportTree();
    }
  }, [ownershipNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full h-full relative">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onImportTree={handleImportTree}
        onImportCSV={handleFileImport}
        onClear={handleClear}
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
