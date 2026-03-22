/** Types for the React Flow canvas. */

export type ShapeType = 'rect' | 'roundRect' | 'ellipse' | 'diamond' | 'note';
export type PageOrientation = 'landscape' | 'portrait';

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
  nodeScale?: number;            // 0.35–1.0, set by Fit to Grid
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
