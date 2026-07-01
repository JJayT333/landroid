/** Types for the React Flow canvas. */

export type ShapeType = 'rect' | 'roundRect' | 'ellipse' | 'diamond' | 'note';
export type PageOrientation = 'landscape' | 'portrait';
export type PageSizeId =
  | 'ansi-a'
  | 'ansi-b'
  | 'ansi-c'
  | 'ansi-d'
  | 'ansi-e'
  | 'arch-a'
  | 'arch-b'
  | 'arch-c'
  | 'arch-d'
  | 'arch-e1'
  | 'arch-e';

export interface OwnershipNodeData {
  label: string;
  grantee: string;
  grantor: string;
  instrument: string;
  date: string;
  grantFraction: string;        // Absolute interest conveyed (of whole tract)
  remainingFraction: string;    // What's left after conveyances away
  relativeShare: string;        // Fraction of PARENT's interest that was granted
  nodeId: string;               // Reference to OwnershipNode.id
  color?: string;
  nodeScale?: number;           // 0.2–3.0, chart-wide proportional scale
  /**
   * Set when the referenced OwnershipNode no longer exists in the workspace
   * (deleted after this node was placed on the canvas). The live-fraction
   * overlay (DA-H8) flags these so a stale node is visibly marked on screen and
   * in print instead of silently showing baked-in numbers.
   */
  stale?: boolean;
  /**
   * Missing Link overlay (placeholder provenance). When true the card renders in
   * the distinct dashed-amber placeholder state with the "⚠ MISSING LINK" badge
   * — it can NEVER be mistaken for a recorded link. Absent on ordinary recorded
   * nodes so their card is byte-identical to today's.
   */
  isPlaceholder?: boolean;
  /**
   * Placeholder only: what is missing — `'person'`, `'instrument'`, or `'both'`.
   * Drives the "what's-missing" line on the card. Triage/display only.
   */
  placeholderMissing?: 'person' | 'instrument' | 'both';
  /**
   * Display/payout overlay: this node sits AT or BELOW an `'indeterminate'`
   * Missing Link, so its fraction lines render as "—" with a "pending — unproven
   * link" hint instead of a computed number. Derived per render from
   * `collectUnprovenIndeterminateNodeIds`; never a stored-fraction change.
   */
  unprovenPending?: boolean;
  /**
   * Display overlay: this node descends from an `'assume'` Missing Link, so the
   * numbers DO compute and show, but the card carries a small "subject to
   * unproven link" flag. Derived per render.
   */
  assumeFlagged?: boolean;
}

export interface ShapeNodeData {
  shapeType: ShapeType;
  text: string;
  width: number;
  height: number;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  color?: string;
}

export interface FrameNodeData {
  title: string;
  width: number;
  height: number;
  color?: string;
}

export interface ImageNodeData {
  /** SHA-256 content hash referencing a row in the canvasAssets store. */
  assetHash: string;
  width: number;
  height: number;
  /** Natural aspect ratio (w/h) for proportional resize. */
  aspectRatio?: number;
  alt?: string;
}

export interface FlowEdgeData extends Record<string, unknown> {
  edgeScale?: number;
  variant?: 'primary' | 'related';
  label?: string;
}

export type FlowTool =
  | 'select'
  | 'pan'
  | 'move-tree'
  | 'connect'
  | 'draw-rect'
  | 'draw-round'
  | 'draw-ellipse'
  | 'draw-diamond'
  | 'draw-note'
  | 'draw-frame'
  // Reserved seam for a future freehand pen tool. No capture/render is wired
  // yet; it exists so the tool enum and the node-kind/print registries already
  // account for ink and a later implementation drops in without a refactor.
  | 'draw-pen';

/**
 * Element kinds a canvas node can be. Used as the key for the print-renderer
 * registry and node-type dispatch. `'ink'` is a reserved seam (see draw-pen).
 */
export type NodeKind = 'ownership' | 'shape' | 'text' | 'image' | 'frame' | 'ink';

/** Map of a draw-* tool to the shape it creates on pane click. */
export const DRAW_TOOL_SHAPE: Partial<Record<FlowTool, ShapeType>> = {
  'draw-rect': 'rect',
  'draw-round': 'roundRect',
  'draw-ellipse': 'ellipse',
  'draw-diamond': 'diamond',
  'draw-note': 'note',
};
