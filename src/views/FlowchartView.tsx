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
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Button from '../components/shared/Button';
import OwnershipNodeComponent from '../components/canvas/OwnershipNode';
import OwnershipEdgeComponent from '../components/canvas/OwnershipEdge';
import ShapeNodeComponent from '../components/canvas/ShapeNode';
import FrameNodeComponent from '../components/canvas/FrameNode';
import ImageNodeComponent from '../components/canvas/ImageNode';
import {
  isImageFile,
  prepareImageForCanvas,
  initialImageDisplaySize,
} from '../components/canvas/image-import';
import { saveCanvasAsset } from '../storage/canvas-assets';
import CanvasToolbar from '../components/canvas/CanvasToolbar';
import PageGrid from '../components/canvas/PageGrid';
import PrintOverlay from '../components/canvas/PrintOverlay';
import { getPageDimensions } from '../engine/flowchart-pages';
import { useWorkspaceStore } from '../store/workspace-store';
import { useCanvasStore } from '../store/canvas-store';
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  clampNodeScale,
  clampTreeSpacingFactor,
  getOwnershipNodeDimensions,
  MIN_NODE_SCALE,
} from '../engine/flowchart-metrics';
import { layoutOwnershipTreeWithElk } from '../engine/tree-layout';
import useCanvasKeyboardShortcuts from '../hooks/useCanvasKeyboardShortcuts';
import { exportCanvasToPng } from '../components/canvas/canvas-export';
import { DRAW_TOOL_SHAPE } from '../types/flowchart';
import type { FlowEdgeData, OwnershipNodeData } from '../types/flowchart';
import type { OwnershipNode } from '../types/node';

const nodeTypes: NodeTypes = {
  ownership: OwnershipNodeComponent,
  shape: ShapeNodeComponent,
  frame: FrameNodeComponent,
  image: ImageNodeComponent,
};

const edgeTypes: EdgeTypes = {
  ownership: OwnershipEdgeComponent,
};

function getOwnershipScale(data: unknown): number {
  return clampNodeScale((data as OwnershipNodeData | undefined)?.nodeScale ?? 1);
}

function getNodeDimensions(node: Node) {
  if (node.type === 'ownership') {
    const scale = getOwnershipScale(node.data);
    const dims = getOwnershipNodeDimensions(scale);
    return {
      width: node.measured?.width ?? dims.width,
      height: node.measured?.height ?? dims.height,
      scale,
    };
  }

  const data = node.data as Record<string, unknown>;
  return {
    width: node.measured?.width ?? (typeof data?.width === 'number' ? data.width : BASE_NODE_WIDTH),
    height: node.measured?.height ?? (typeof data?.height === 'number' ? data.height : BASE_NODE_HEIGHT),
    scale: 1,
  };
}

function scaleNode(
  node: Node,
  factor: number,
  origin: { minX: number; minY: number },
  offset: { x: number; y: number }
) {
  const position = {
    x: (node.position.x - origin.minX) * factor + offset.x,
    y: (node.position.y - origin.minY) * factor + offset.y,
  };

  if (node.type === 'ownership') {
    return {
      ...node,
      position,
      data: {
        ...node.data,
        nodeScale: clampNodeScale(getOwnershipScale(node.data) * factor),
      },
    };
  }

  const data = node.data as Record<string, unknown>;
  return {
    ...node,
    position,
    data: {
      ...data,
      width: typeof data.width === 'number' ? data.width * factor : data.width,
      height: typeof data.height === 'number' ? data.height * factor : data.height,
      fontSize: typeof data.fontSize === 'number' ? data.fontSize * factor : data.fontSize,
    },
  };
}

function getTreeRootIds(ownershipNodes: OwnershipNode[]): Set<string> {
  const nodeIds = new Set(ownershipNodes.map((node) => node.id));
  return new Set(
    ownershipNodes
      .filter(
        (node) =>
          node.type !== 'related' &&
          (!node.parentId || node.parentId === 'unlinked' || !nodeIds.has(node.parentId))
      )
      .map((node) => node.id)
  );
}

function getChartAnchor(nodes: Node[], rootIds: Set<string>) {
  const rootNodes = nodes.filter((node) => rootIds.has(node.id));
  if (rootNodes.length > 0) {
    const rootCenters = rootNodes.map((node) => {
      const { width } = getNodeDimensions(node);
      return node.position.x + width / 2;
    });

    return {
      x: rootCenters.reduce((sum, centerX) => sum + centerX, 0) / rootCenters.length,
      y: Math.min(...rootNodes.map((node) => node.position.y)),
    };
  }

  const bounds = getNodeBounds(nodes);
  return {
    x: bounds.minX + bounds.w / 2,
    y: bounds.minY,
  };
}

function getNodeBounds(nodes: Node[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

function translateNodesToAnchor(nodes: Node[], rootIds: Set<string>, targetAnchor: { x: number; y: number }) {
  if (nodes.length === 0) return nodes;

  const sourceAnchor = getChartAnchor(nodes, rootIds);
  const dx = targetAnchor.x - sourceAnchor.x;
  const dy = targetAnchor.y - sourceAnchor.y;

  if (dx === 0 && dy === 0) return nodes;

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + dx,
      y: node.position.y + dy,
    },
  }));
}

function getCurrentOwnershipScale(nodes: Node[]) {
  const ownershipNode = nodes.find((node) => node.type === 'ownership');
  return ownershipNode ? getOwnershipScale(ownershipNode.data) : 1;
}

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
                  nodeScale: clampNodeScale(
                    getOwnershipScale(n.data) * newScale
                  ),
                }
              : {
                  ...(n.data as Record<string, unknown>),
                  width:
                    typeof (n.data as Record<string, unknown>)?.width === 'number'
                      ? ((n.data as Record<string, unknown>).width as number) * newScale
                      : (n.data as Record<string, unknown>)?.width,
                  height:
                    typeof (n.data as Record<string, unknown>)?.height === 'number'
                      ? ((n.data as Record<string, unknown>).height as number) * newScale
                      : (n.data as Record<string, unknown>)?.height,
                  fontSize:
                    typeof (n.data as Record<string, unknown>)?.fontSize === 'number'
                      ? ((n.data as Record<string, unknown>).fontSize as number) * newScale
                      : (n.data as Record<string, unknown>)?.fontSize,
                },
        }))
      );
      setEdges(
        originals.edges.map((e) => ({
          ...e,
          data: {
            ...(e.data as FlowEdgeData | undefined),
            edgeScale: clampNodeScale(((e.data as FlowEdgeData | undefined)?.edgeScale ?? 1) * newScale),
          },
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
        MIN_NODE_SCALE,
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
      <Button
        size="sm"
        className="pointer-events-auto shadow-lg"
        style={{
          position: 'absolute',
          left: screenX + screenW / 2 - 40,
          top: screenY - 32,
        }}
        onClick={onDone}
      >
        Done Resizing
      </Button>
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
  const pageSize = useCanvasStore((s) => s.pageSize);
  const horizontalSpacingFactor = useCanvasStore((s) => s.horizontalSpacingFactor);
  const verticalSpacingFactor = useCanvasStore((s) => s.verticalSpacingFactor);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const virtualize = useCanvasStore((s) => s.virtualize);
  const viewport = useCanvasStore((s) => s.viewport);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const mergeImportGraph = useCanvasStore((s) => s.mergeImportGraph);
  const addShapeNode = useCanvasStore((s) => s.addShapeNode);
  const addFrameNode = useCanvasStore((s) => s.addFrameNode);
  const addImageNode = useCanvasStore((s) => s.addImageNode);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const setHorizontalSpacingFactor = useCanvasStore((s) => s.setHorizontalSpacingFactor);
  const setVerticalSpacingFactor = useCanvasStore((s) => s.setVerticalSpacingFactor);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const { fitView, screenToFlowPosition, getNodes } = useReactFlow();
  const spacingRequestIdRef = useRef(0);
  // First render restores the saved viewport via defaultViewport; only the
  // very first import (no saved viewport, empty canvas) should auto-fit.
  const hasSavedViewport = useRef(
    viewport.x !== 0 || viewport.y !== 0 || viewport.zoom !== 1
  );

  // ── Keyboard shortcuts ─────────────────────────────────
  useCanvasKeyboardShortcuts();

  const getFlowchartDeskMapNodes = useCallback(
    () => getActiveDeskMapNodes().filter((node) => node.type !== 'related'),
    [getActiveDeskMapNodes]
  );

  const getRelatedDeskMapNodeIds = useCallback(
    () =>
      new Set(
        getActiveDeskMapNodes()
          .filter((node) => node.type === 'related')
          .map((node) => node.id)
      ),
    [getActiveDeskMapNodes]
  );

  // ── Import ownership tree from active desk map ─────────
  const handleImportTree = useCallback(() => {
    void (async () => {
      const deskMapNodes = getFlowchartDeskMapNodes();
      if (deskMapNodes.length === 0) return;
      const rootIds = getTreeRootIds(deskMapNodes);
      const { pw } = getPageDimensions(pageSize, orientation);
      const gridCenterX = (pw * gridCols) / 2;
      const importScale = getCurrentOwnershipScale(useCanvasStore.getState().nodes);

      const { flowNodes, flowEdges } = await layoutOwnershipTreeWithElk(deskMapNodes, {
        horizontalSpacingFactor,
        verticalSpacingFactor,
        nodeScale: importScale,
      });
      const centeredFlowNodes = translateNodesToAnchor(
        flowNodes as Node[],
        rootIds,
        { x: gridCenterX, y: 40 }
      );
      // Merge so user drawings/annotations survive a re-import (DA2-F3).
      mergeImportGraph(centeredFlowNodes, flowEdges);
      setTimeout(() => fitView({ padding: 0.1, duration: 300 }), 50);
    })();
  }, [
    getFlowchartDeskMapNodes,
    gridCols,
    horizontalSpacingFactor,
    mergeImportGraph,
    fitView,
    orientation,
    pageSize,
    verticalSpacingFactor,
  ]);

  const applySpacingFactors = useCallback(
    (nextHorizontalSpacingFactor: number, nextVerticalSpacingFactor: number) => {
      const safeHorizontalSpacingFactor = clampTreeSpacingFactor(nextHorizontalSpacingFactor);
      const safeVerticalSpacingFactor = clampTreeSpacingFactor(nextVerticalSpacingFactor);
      if (
        safeHorizontalSpacingFactor === horizontalSpacingFactor &&
        safeVerticalSpacingFactor === verticalSpacingFactor
      ) {
        return;
      }

      const store = useCanvasStore.getState();
      const layoutNodes = getFlowchartDeskMapNodes();
      const relatedNodeIds = getRelatedDeskMapNodeIds();
      const rootIds = getTreeRootIds(layoutNodes);
      const hasCanvasChanges = store.nodes.some((node) => node.type === 'ownership');
      const currentOwnershipNodes = store.nodes.filter(
        (node) => node.type === 'ownership' && !relatedNodeIds.has(node.id)
      );
      const currentScale = getCurrentOwnershipScale(currentOwnershipNodes);
      const { pw } = getPageDimensions(pageSize, orientation);
      const currentAnchor =
        currentOwnershipNodes.length > 0
          ? getChartAnchor(currentOwnershipNodes, rootIds)
          : { x: (pw * gridCols) / 2, y: 40 };

      if (hasCanvasChanges) {
        pushHistory();
      }

      setHorizontalSpacingFactor(safeHorizontalSpacingFactor);
      setVerticalSpacingFactor(safeVerticalSpacingFactor);

      if (layoutNodes.length === 0) {
        if (relatedNodeIds.size === 0) return;

        store.setNodes(store.nodes.filter((node) => !relatedNodeIds.has(node.id)));
        store.setEdges(
          store.edges.filter(
            (edge) => !relatedNodeIds.has(edge.source) && !relatedNodeIds.has(edge.target)
          )
        );
        return;
      }

      const requestId = ++spacingRequestIdRef.current;
      void (async () => {
        const { flowNodes } = await layoutOwnershipTreeWithElk(layoutNodes, {
          horizontalSpacingFactor: safeHorizontalSpacingFactor,
          verticalSpacingFactor: safeVerticalSpacingFactor,
          nodeScale: currentScale,
        });
        if (requestId !== spacingRequestIdRef.current) return;

        const anchoredFlowNodes = translateNodesToAnchor(
          flowNodes as Node[],
          rootIds,
          currentAnchor
        );
        const positions = new Map(anchoredFlowNodes.map((node) => [node.id, node.position]));
        const latestStore = useCanvasStore.getState();
        latestStore.setNodes(
          latestStore.nodes
            .filter((node) => !relatedNodeIds.has(node.id))
            .map((node) => {
              if (node.type !== 'ownership') return node;
              const position = positions.get(node.id);
              return position ? { ...node, position } : node;
            })
        );
        latestStore.setEdges(
          latestStore.edges.filter(
            (edge) => !relatedNodeIds.has(edge.source) && !relatedNodeIds.has(edge.target)
          )
        );
      })();
    },
    [
      getFlowchartDeskMapNodes,
      getRelatedDeskMapNodeIds,
      horizontalSpacingFactor,
      gridCols,
      orientation,
      pageSize,
      pushHistory,
      setHorizontalSpacingFactor,
      setVerticalSpacingFactor,
      verticalSpacingFactor,
    ]
  );

  const handleHorizontalSpacingChange = useCallback(
    (nextHorizontalSpacingFactor: number) => {
      applySpacingFactors(nextHorizontalSpacingFactor, verticalSpacingFactor);
    },
    [applySpacingFactors, verticalSpacingFactor]
  );

  const handleVerticalSpacingChange = useCallback(
    (nextVerticalSpacingFactor: number) => {
      applySpacingFactors(horizontalSpacingFactor, nextVerticalSpacingFactor);
    },
    [applySpacingFactors, horizontalSpacingFactor]
  );

  // ── Fit to Grid ────────────────────────────────────────
  // Scales both node positions AND node sizes uniformly so the tree
  // maintains its shape at a smaller size. It no longer auto-expands the
  // grid; paper size and grid counts stay under explicit user control.
  const handleFitToGrid = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();

    // 1. Bounding box of all nodes using their actual rendered dimensions
    const bounds = getNodeBounds(nodes);
    const treeW = bounds.w;
    const treeH = bounds.h;
    if (treeW === 0 || treeH === 0) return;

    const { pw, ph } = getPageDimensions(pageSize, orientation);
    const margin = 40;

    // 2. Uniform factor to fit the current chart geometry into the page grid
    const gridW = pw * gridCols;
    const gridH = ph * gridRows;
    const rawFactor = Math.min(
      (gridW - 2 * margin) / treeW,
      (gridH - 2 * margin) / treeH
    );

    const ownershipNodes = nodes.filter((n) => n.type === 'ownership');
    const currentScale = ownershipNodes.length > 0 ? getOwnershipScale(ownershipNodes[0].data) : 1;
    const minFactor = MIN_NODE_SCALE / currentScale;
    const maxFactor = 1 / currentScale;
    const appliedFactor = Math.min(Math.max(rawFactor, minFactor), maxFactor);
    const centeredOffsetX = Math.max(margin, (gridW - treeW * appliedFactor) / 2);
    const centeredOffsetY = margin;

    // 4. Scale positions, card geometry, and shape dimensions together
    const store = useCanvasStore.getState();
    store.setNodes(
      nodes.map((n) => scaleNode(n, appliedFactor, { minX: bounds.minX, minY: bounds.minY }, {
        x: centeredOffsetX,
        y: centeredOffsetY,
      }))
    );

    // 5. Scale edge strokes by the same factor
    const currentEdges = store.edges;
    store.setEdges(
      currentEdges.map((e) => {
        const currentStroke = Number(e.style?.strokeWidth ?? ((e.style?.stroke === '#a0522d') ? 1 : 2));
        return {
          ...e,
          data: {
            ...(e.data as FlowEdgeData | undefined),
            edgeScale: clampNodeScale(((e.data as FlowEdgeData | undefined)?.edgeScale ?? 1) * appliedFactor),
          },
          style: { ...e.style, strokeWidth: Math.max(0.5, currentStroke * appliedFactor) },
        };
      })
    );

    setTimeout(() => fitView({ padding: 0.05, duration: 300 }), 50);
  }, [nodes, pushHistory, fitView, gridCols, gridRows, orientation, pageSize]);

  // ── Pane-click shape creation (DA2-F1) ─────────────────
  // When a draw-* tool is active, clicking empty canvas drops the shape at the
  // pointer (converted to flow space) and returns to the select tool.
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (activeTool === 'draw-frame') {
        addFrameNode(position);
        setActiveTool('select');
        return;
      }
      const shapeType = DRAW_TOOL_SHAPE[activeTool];
      if (!shapeType) return;
      addShapeNode(shapeType, position);
      setActiveTool('select');
    },
    [activeTool, screenToFlowPosition, addShapeNode, addFrameNode, setActiveTool]
  );

  // ── Print ──────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    requestAnimationFrame(() => window.print());
  }, []);

  // ── PNG export ─────────────────────────────────────────
  const handleExportPng = useCallback(() => {
    void exportCanvasToPng(getNodes());
  }, [getNodes]);

  // ── Image import (file picker / paste / drop) ──────────
  // Downscale, store the bytes in the content-addressed asset store, then drop
  // an image node referencing the hash at the given flow position.
  const importImageAt = useCallback(
    async (file: File | Blob, position: { x: number; y: number }) => {
      if (!isImageFile(file)) return;
      try {
        const prepared = await prepareImageForCanvas(file);
        const fileName = file instanceof File ? file.name : undefined;
        const { contentHash } = await saveCanvasAsset(prepared.blob, workspaceId, fileName);
        const size = initialImageDisplaySize(prepared.naturalWidth, prepared.naturalHeight);
        const aspectRatio = prepared.naturalWidth / prepared.naturalHeight;
        addImageNode(contentHash, size, aspectRatio, position);
      } catch (err) {
        console.warn('[landroid] image import failed:', err);
      }
    },
    [workspaceId, addImageNode]
  );

  const centerFlowPosition = useCallback(() => {
    const el = document.querySelector('.react-flow');
    const rect = el?.getBoundingClientRect();
    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
    });
  }, [screenToFlowPosition]);

  const handleAddImageFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const center = centerFlowPosition();
      Array.from(files).forEach((file, i) => {
        // Cascade multiple images slightly so they don't stack exactly.
        void importImageAt(file, { x: center.x + i * 24, y: center.y + i * 24 });
      });
    },
    [centerFlowPosition, importImageAt]
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
      if (files.length === 0) return;
      event.preventDefault();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      files.forEach((file, i) =>
        void importImageAt(file, { x: position.x + i * 24, y: position.y + i * 24 })
      );
    },
    [importImageAt, screenToFlowPosition]
  );

  // ── Paste an image from the clipboard anywhere on the canvas ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((it) =>
        it.type.startsWith('image/')
      );
      const file = item?.getAsFile();
      if (file) void importImageAt(file, centerFlowPosition());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importImageAt, centerFlowPosition]);

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
    if (deskMapNodes.some((node) => node.type !== 'related') && nodes.length === 0) {
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
      const { width: nw, height: nh } = getNodeDimensions(n);
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
    type: n.type,
    position: n.position,
    data: n.data,
    measured: n.measured,
    zIndex: n.zIndex,
  }));
  const printEdges = edges.map((e) => ({
    source: e.source,
    target: e.target,
    data: e.data as FlowEdgeData | undefined,
    style: {
      stroke: typeof e.style?.stroke === 'string' ? e.style.stroke : undefined,
      strokeWidth: typeof e.style?.strokeWidth === 'number' ? e.style.strokeWidth : undefined,
    },
  }));

  return (
    <div
      className="w-full h-full relative"
      onDrop={handleCanvasDrop}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer?.items ?? []).some((it) => it.kind === 'file')) {
          e.preventDefault();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleAddImageFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <CanvasToolbar
        onImportTree={handleImportTree}
        onFitToGrid={handleFitToGrid}
        onResize={handleEnterResize}
        onHorizontalSpacingChange={handleHorizontalSpacingChange}
        onVerticalSpacingChange={handleVerticalSpacingChange}
        resizeMode={resizeMode}
        onPrint={handlePrint}
        onExportPng={handleExportPng}
        onAddImage={() => fileInputRef.current?.click()}
      />

      {nodes.length > 0 && (
        <div className="no-print absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-md bg-parchment border border-ledger-line shadow text-xs font-mono text-ink-light">
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
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // Restore the persisted viewport (DA2-F7); only auto-fit when there is
        // none saved (first visit) — handled by the import effect.
        defaultViewport={viewport}
        fitView={!hasSavedViewport.current}
        fitViewOptions={{ padding: 0.1 }}
        defaultEdgeOptions={{
          type: 'ownership',
          data: { edgeScale: 1, variant: 'primary' },
          style: { stroke: '#8b4513', strokeWidth: 2 },
        }}
        // Miro-style (DA2-F2): with the select tool, left-drag lassos and
        // middle/right-drag pans. The explicit pan tool pans on left-drag.
        panOnDrag={resizeMode ? false : activeTool === 'pan' ? true : [1, 2]}
        selectionOnDrag={!resizeMode && activeTool === 'select'}
        nodesDraggable={!resizeMode}
        nodesConnectable={activeTool === 'connect'}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        onlyRenderVisibleElements={virtualize}
        deleteKeyCode={null}
        minZoom={0.02}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <PageGrid cols={gridCols} rows={gridRows} orientation={orientation} pageSize={pageSize} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="var(--color-canvas-dot)"
        />
        <Controls
          className="!bg-parchment !border-ledger-line !rounded-md !shadow-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeStrokeColor="#8b4513"
          nodeColor="#faf3e8"
          maskColor="rgba(250, 243, 232, 0.7)"
          className="!rounded-md"
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
          pageSize={pageSize}
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
