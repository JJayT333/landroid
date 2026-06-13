/**
 * Canvas state store — nodes, edges, tool, page grid, undo/redo.
 *
 * Completely independent from workspace-store. This makes the canvas
 * reusable across projects and keeps domain data separate from
 * drawing/layout state.
 */
import { create } from 'zustand';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Viewport,
} from '@xyflow/react';
import { DEFAULT_PAGE_SIZE } from '../engine/flowchart-pages';
import { FRAME_DEFAULTS, SHAPE_DEFAULTS } from '../engine/flowchart-metrics';
import type {
  FlowTool,
  FrameNodeData,
  ImageNodeData,
  PageOrientation,
  PageSizeId,
  ShapeNodeData,
  ShapeType,
} from '../types/flowchart';
import {
  addCanvasEdge,
  applyCanvasEdgeChanges,
  applyCanvasNodeChanges,
} from './canvas-change-utils';

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

  // Performance: only render on-screen nodes. Opt-in (default off) because it
  // omits off-screen nodes from the DOM, which a full-canvas PNG export needs.
  virtualize: boolean;

  // Viewport (for persistence)
  viewport: Viewport;

  // History
  _past: Snapshot[];
  _future: Snapshot[];

  // Clipboard (session-only; never persisted)
  _clipboard: { nodes: Node[]; edges: Edge[] } | null;

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
  mergeImportGraph: (ownershipNodes: Node[], ownershipEdges: Edge[]) => void;
  clearCanvas: () => void;

  // ── Shape creation ──
  addShapeNode: (shapeType: ShapeType, position: { x: number; y: number }) => string;
  addFrameNode: (position: { x: number; y: number }) => string;
  addImageNode: (
    assetHash: string,
    size: { width: number; height: number },
    aspectRatio: number,
    position: { x: number; y: number }
  ) => string;

  // ── Individual mutations ──
  addNodes: (nodes: Node[]) => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  selectAll: () => void;
  deselectAll: () => void;

  // ── Templates ──
  insertElements: (nodes: Node[], edges: Edge[]) => void;

  // ── Clipboard / duplication ──
  copySelection: () => void;
  paste: () => void;
  duplicateSelection: () => void;

  // ── Z-order ──
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;

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

  // ── Performance ──
  setVirtualize: (virtualize: boolean) => void;

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

// ── Clone helpers (copy/paste/duplicate) ─────────────────

const PASTE_OFFSET = 24;

let cloneCounter = 0;

/**
 * Deep-ish clone a set of nodes (and the edges among them) with fresh ids and a
 * position offset, remapping edge endpoints to the new node ids. The clones are
 * selected so the paste/duplicate result is immediately actionable.
 */
function cloneWithFreshIds(
  nodes: Node[],
  edges: Edge[],
  offset: number
): { nodes: Node[]; edges: Edge[] } {
  const stamp = `${Date.now()}-${cloneCounter++}`;
  const idMap = new Map<string, string>();

  const clonedNodes = nodes.map((n, i) => {
    const newId = `${n.id}-copy-${stamp}-${i}`;
    idMap.set(n.id, newId);
    return {
      ...n,
      id: newId,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      data: { ...n.data },
      selected: true,
      // Drop any parent link the original had unless its parent is also cloned;
      // resolved below once the full id map exists.
    } as Node;
  });

  // Re-point parentId for clones whose parent was also cloned.
  for (const node of clonedNodes) {
    if (node.parentId && idMap.has(node.parentId)) {
      node.parentId = idMap.get(node.parentId);
    } else if (node.parentId) {
      delete node.parentId;
    }
  }

  const clonedEdges = edges.map((e, i) => ({
    ...e,
    id: `${e.id}-copy-${stamp}-${i}`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
    data: { ...e.data },
    selected: false,
  })) as Edge[];

  return { nodes: clonedNodes, edges: clonedEdges };
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
  virtualize: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  _past: [],
  _future: [],
  _clipboard: null,
  _hydrated: false,

  // ── React Flow change handlers ─────────────────────────
  // These fire on every drag frame, selection toggle, etc.
  // Do NOT push history here — the view calls pushHistory()
  // at the right moments (e.g., onNodeDragStart).

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyCanvasNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyCanvasEdgeChanges(changes, s.edges) })),

  onConnect: (connection) => {
    const s = get();
    set({
      edges: addCanvasEdge(connection, s.edges),
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

  // Merge an ownership tree into the canvas WITHOUT discarding user drawings.
  // Ownership nodes/edges are replaced wholesale (they are derived from the
  // desk map); every other node kind (shape/text/image/frame) and any edge not
  // touching an ownership node is preserved. Mirrors the preserve policy that
  // applySpacingFactors already uses, so re-import no longer wipes annotations.
  mergeImportGraph: (ownershipNodes, ownershipEdges) => {
    const s = get();
    const incomingNodeIds = new Set(ownershipNodes.map((n) => n.id));
    const preservedNodes = s.nodes.filter(
      (n) => n.type !== 'ownership' && !incomingNodeIds.has(n.id)
    );
    const preservedEdges = s.edges.filter((e) => {
      const node = (id: string) =>
        s.nodes.find((n) => n.id === id) ?? ownershipNodes.find((n) => n.id === id);
      const src = node(e.source);
      const tgt = node(e.target);
      // Drop edges that are part of the ownership tree being replaced; keep
      // edges the user drew between their own (non-ownership) elements.
      return src?.type !== 'ownership' && tgt?.type !== 'ownership';
    });
    set({
      nodes: [...ownershipNodes, ...preservedNodes],
      edges: [...ownershipEdges, ...preservedEdges],
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

  // Create a freeform shape node at a flow-space position (used by the
  // pane-click handler when a draw-* tool is active). Pushes one history entry
  // and returns the new node id so the caller can select it for editing.
  addShapeNode: (shapeType, position) => {
    const s = get();
    const defaults = SHAPE_DEFAULTS[shapeType];
    const id = `shape-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const data: ShapeNodeData = {
      shapeType,
      text: '',
      width: defaults.width,
      height: defaults.height,
      fontSize: defaults.fontSize,
      textAlign: 'center',
    };
    const node: Node = {
      id,
      type: 'shape',
      position: {
        x: position.x - defaults.width / 2,
        y: position.y - defaults.height / 2,
      },
      data: data as unknown as Record<string, unknown>,
      selected: true,
    };
    set({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
    return id;
  },

  // Create a titled frame/section container. Frames sit behind other content
  // (negative zIndex) and are a purely visual grouping aid; they print as a
  // labeled border without altering the page-grid print pipeline.
  addFrameNode: (position) => {
    const s = get();
    const id = `frame-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const data: FrameNodeData = {
      title: 'Frame',
      width: FRAME_DEFAULTS.width,
      height: FRAME_DEFAULTS.height,
    };
    const minZ = s.nodes.reduce((m, n) => Math.min(m, n.zIndex ?? 0), 0);
    const node: Node = {
      id,
      type: 'frame',
      position,
      data: data as unknown as Record<string, unknown>,
      selected: true,
      zIndex: minZ - 1,
    };
    set({
      nodes: [node, ...s.nodes.map((n) => ({ ...n, selected: false }))],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
    return id;
  },

  // Place an image node referencing a stored asset (by content hash). The blob
  // already lives in the canvasAssets store; the node carries only the hash.
  addImageNode: (assetHash, size, aspectRatio, position) => {
    const s = get();
    const id = `image-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const data: ImageNodeData = {
      assetHash,
      width: size.width,
      height: size.height,
      aspectRatio,
    };
    const node: Node = {
      id,
      type: 'image',
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
      // Top-level width/height are the live size React Flow's NodeResizer drives
      // (data.width/height stay as the initial/fallback footprint).
      width: size.width,
      height: size.height,
      data: data as unknown as Record<string, unknown>,
      selected: true,
    };
    set({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
    return id;
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

  updateEdgeData: (id, data) =>
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...data } } : e
      ),
    })),

  // ── Templates ──────────────────────────────────────────

  insertElements: (newNodes, newEdges) => {
    const s = get();
    set({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...s.edges, ...newEdges],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  // ── Clipboard / duplication ────────────────────────────

  copySelection: () => {
    const s = get();
    const selectedNodes = s.nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    const idSet = new Set(selectedNodes.map((n) => n.id));
    // Only copy edges whose endpoints are both in the selection.
    const selectedEdges = s.edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    );
    set({
      _clipboard: {
        nodes: selectedNodes.map((n) => ({ ...n, data: { ...n.data }, selected: false })),
        edges: selectedEdges.map((e) => ({ ...e, data: { ...e.data }, selected: false })),
      },
    });
  },

  paste: () => {
    const s = get();
    if (!s._clipboard || s._clipboard.nodes.length === 0) return;
    const { nodes: pasted, edges: pastedEdges } = cloneWithFreshIds(
      s._clipboard.nodes,
      s._clipboard.edges,
      PASTE_OFFSET
    );
    set({
      nodes: [
        ...s.nodes.map((n) => ({ ...n, selected: false })),
        ...pasted,
      ],
      edges: [...s.edges, ...pastedEdges],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  duplicateSelection: () => {
    const s = get();
    const selectedNodes = s.nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    const idSet = new Set(selectedNodes.map((n) => n.id));
    const selectedEdges = s.edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    );
    const { nodes: dup, edges: dupEdges } = cloneWithFreshIds(
      selectedNodes,
      selectedEdges,
      PASTE_OFFSET
    );
    set({
      nodes: [
        ...s.nodes.map((n) => ({ ...n, selected: false })),
        ...dup,
      ],
      edges: [...s.edges, ...dupEdges],
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  // ── Z-order ────────────────────────────────────────────

  bringToFront: (ids) => {
    const s = get();
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const maxZ = s.nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
    set({
      nodes: s.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, zIndex: maxZ + 1 } : n
      ),
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

  sendToBack: (ids) => {
    const s = get();
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const minZ = s.nodes.reduce((m, n) => Math.min(m, n.zIndex ?? 0), 0);
    set({
      nodes: s.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, zIndex: minZ - 1 } : n
      ),
      _past: pushToPast(s._past, captureSnapshot(s)),
      _future: [],
    });
  },

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

  // ── Performance ────────────────────────────────────────

  setVirtualize: (virtualize) => set({ virtualize }),

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
