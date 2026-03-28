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

export interface FlowEdgeData extends Record<string, unknown> {
  edgeScale?: number;
  variant?: 'primary' | 'related';
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
  | 'draw-note';
