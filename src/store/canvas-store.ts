/**
 * Canvas state store — nodes, edges, tool, page grid, undo/redo.
 *
 * Completely independent from workspace-store. This makes the canvas
 * reusable across projects and keeps domain data separate from
 * drawing/layout state.
 */
import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
} from '@xyflow/react';
import { DEFAULT_PAGE_SIZE } from '../engine/flowchart-pages';
import type { FlowTool, PageOrientation, PageSizeId } from '../types/flowchart';

// ── History ──────────────────────────────────────────────

const MAX_HISTORY = 50;

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
  gridCols: number;
  gridRows: number;
  orientation: PageOrientation;
  pageSize: PageSizeId;
  horizontalSpacingFactor: number;
  verticalSpacingFactor: number;
}

// ── Store interface ──────────────────────────────────────

interface CanvasState {
  // Core data
  nodes: Node[];
  edges: Edge[];

  // Tool
  activeTool: FlowTool;

  // Page grid
  gridCols: number;
  gridRows: number;
  orientation: PageOrientation;
  pageSize: PageSizeId;
  horizontalSpacingFactor: number;
  verticalSpacingFactor: number;

  // Snap
  snapToGrid: boolean;
  gridSize: number;

  // Viewport (for persistence)
  viewport: Viewport;

  // History
  _past: Snapshot[];
  _future: Snapshot[];

  // Lifecycle
  _hydrated: boolean;

  // ── React Flow integration ──
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // ── Bulk operations ──
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  importGraph: (nodes: Node[], edges: Edge[]) => void;
  clearCanvas: () => void;

  // ── Individual mutations ──
  addNodes: (nodes: Node[]) => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  selectAll: () => void;
  deselectAll: () => void;

  // ── Tool ──
  setActiveTool: (tool: FlowTool) => void;

  // ── Page grid ──
  setGridCols: (cols: number) => void;
  setGridRows: (rows: number) => void;
  setOrientation: (o: PageOrientation) => void;
  setPageSize: (pageSize: PageSizeId) => void;
  setHorizontalSpacingFactor: (factor: number) => void;
  setVerticalSpacingFactor: (factor: number) => void;

  // ── Snap ──
  setSnapToGrid: (snap: boolean) => void;

  // ── Viewport ──
  setViewport: (viewport: Viewport) => void;

  // ── History ──
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // ── Lifecycle ──
  setHydrated: () => void;
  loadCanvas: (data: CanvasSaveData) => void;
}

export interface CanvasSaveData {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
  gridCols?: number;
  gridRows?: number;
  orientation?: PageOrientation;
  pageSize?: PageSizeId;
  horizontalSpacingFactor?: number;
  verticalSpacingFactor?: number;
  snapToGrid?: boolean;
  gridSize?: number;
}

// ── Helper: push current state onto history ──────────────

function captureSnapshot(state: CanvasState): Snapshot {
  return {
    nodes: state.nodes,
    edges: state.edges,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    orientation: state.orientation,
    pageSize: state.pageSize,
    horizontalSpacingFactor: state.horizontalSpacingFactor,
    verticalSpacingFactor: state.verticalSpacingFactor,
  };
}

function pushToPast(past: Snapshot[], snapshot: Snapshot): Snapshot[] {
  const next = [...past, snapshot];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

// ── Store ────────────────────────────────────────────────

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  edges: [],
  activeTool: 'select',
  gridCols: 4,
  gridRows: 2,
  orientation: 'landscape',
  pageSize: DEFAULT_PAGE_SIZE,
  horizontalSpacingFactor: 1,
  verticalSpacingFactor: 1,
  snapToGrid: false,
  gridSize: 20,
  viewport: { x: 0, y: 0, zoom: 1 },
  _past: [],
  _future: [],
  _hydrated: false,

  // ── React Flow change handlers ─────────────────────────
  // These fire on every drag frame, selection toggle, etc.
  // Do NOT push history here — the view calls pushHistory()
  // at the right moments (e.g., onNodeDragStart).

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) => {
    const s = get();
    set({
      edges: addEdge(connection, s.edges),
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  // ── Bulk operations ────────────────────────────────────

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  importGraph: (nodes, edges) => {
    const s = get();
    set({
      nodes,
      edges,
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  clearCanvas: () => {
    const s = get();
    if (s.nodes.length === 0 && s.edges.length === 0) return;
    set({
      nodes: [],
      edges: [],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  // ── Individual mutations ───────────────────────────────

  addNodes: (newNodes) =>
    set((s) => ({ nodes: [...s.nodes, ...newNodes] })),

  removeElements: (nodeIds, edgeIds) => {
    const nodeSet = new Set(nodeIds);
    const edgeSet = new Set(edgeIds);
    set((s) => ({
      nodes: s.nodes.filter((n) => !nodeSet.has(n.id)),
      // Also remove edges connected to removed nodes
      edges: s.edges.filter(
        (e) =>
          !edgeSet.has(e.id) &&
          !nodeSet.has(e.source) &&
          !nodeSet.has(e.target)
      ),
    }));
  },

  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  selectAll: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: true })),
      edges: s.edges.map((e) => ({ ...e, selected: true })),
    })),

  deselectAll: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({ ...n, selected: false })),
      edges: s.edges.map((e) => ({ ...e, selected: false })),
    })),

  // ── Tool ───────────────────────────────────────────────

  setActiveTool: (tool) => set({ activeTool: tool }),

  // ── Page grid ──────────────────────────────────────────

  setGridCols: (gridCols) => set({ gridCols }),
  setGridRows: (gridRows) => set({ gridRows }),
  setOrientation: (orientation) => set({ orientation }),
  setPageSize: (pageSize) => set({ pageSize }),
  setHorizontalSpacingFactor: (horizontalSpacingFactor) => set({ horizontalSpacingFactor }),
  setVerticalSpacingFactor: (verticalSpacingFactor) => set({ verticalSpacingFactor }),

  // ── Snap ───────────────────────────────────────────────

  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

  // ── Viewport ───────────────────────────────────────────

  setViewport: (viewport) => set({ viewport }),

  // ── History ────────────────────────────────────────────

  pushHistory: () => {
    const s = get();
    set({
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  undo: () => {
    const s = get();
    if (s._past.length === 0) return;
    const prev = s._past[s._past.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      gridCols: prev.gridCols,
      gridRows: prev.gridRows,
      orientation: prev.orientation,
      pageSize: prev.pageSize,
      horizontalSpacingFactor: prev.horizontalSpacingFactor,
      verticalSpacingFactor: prev.verticalSpacingFactor,
      _past: s._past.slice(0, -1),
      _future: [captureSnapshot(s), ...s._future],
    });
  },

  redo: () => {
    const s = get();
    if (s._future.length === 0) return;
    const next = s._future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      gridCols: next.gridCols,
      gridRows: next.gridRows,
      orientation: next.orientation,
      pageSize: next.pageSize,
      horizontalSpacingFactor: next.horizontalSpacingFactor,
      verticalSpacingFactor: next.verticalSpacingFactor,
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: s._future.slice(1),
    });
  },

  // ── Lifecycle ──────────────────────────────────────────

  setHydrated: () => set({ _hydrated: true }),

  loadCanvas: (data) =>
    set({
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      viewport: data.viewport ?? { x: 0, y: 0, zoom: 1 },
      gridCols: data.gridCols ?? 4,
      gridRows: data.gridRows ?? 2,
      orientation: data.orientation ?? 'landscape',
      pageSize: data.pageSize ?? DEFAULT_PAGE_SIZE,
      horizontalSpacingFactor: data.horizontalSpacingFactor ?? 1,
      verticalSpacingFactor: data.verticalSpacingFactor ?? 1,
      snapToGrid: data.snapToGrid ?? false,
      gridSize: data.gridSize ?? 20,
      _past: [],
      _future: [],
      _hydrated: true,
    }),
}));
