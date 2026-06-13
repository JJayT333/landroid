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
