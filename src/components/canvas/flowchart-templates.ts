/**
 * Insertable canvas templates — pre-arranged frames + shapes for common
 * exhibits. Each template builds React Flow nodes/edges around an origin point
 * (a flow-space position, typically the viewport center).
 */
import type { Edge, Node } from '@xyflow/react';
import type { FrameNodeData, ShapeNodeData } from '../../types/flowchart';

export interface CanvasTemplate {
  id: string;
  label: string;
  build: (origin: { x: number; y: number }) => { nodes: Node[]; edges: Edge[] };
}

let templateCounter = 0;

function uid(prefix: string): string {
  return `${prefix}-tpl-${Date.now()}-${templateCounter++}`;
}

function frame(id: string, x: number, y: number, title: string, width: number, height: number): Node {
  const data: FrameNodeData = { title, width, height };
  return {
    id,
    type: 'frame',
    position: { x, y },
    width,
    height,
    data: data as unknown as Record<string, unknown>,
    zIndex: -1,
  };
}

function shape(
  id: string,
  x: number,
  y: number,
  text: string,
  shapeType: ShapeNodeData['shapeType'],
  width = 180,
  height = 70
): Node {
  const data: ShapeNodeData = {
    shapeType,
    text,
    width,
    height,
    fontSize: 14,
    textAlign: 'center',
  };
  return {
    id,
    type: 'shape',
    position: { x, y },
    width,
    height,
    data: data as unknown as Record<string, unknown>,
  };
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'ownership',
    data: { edgeScale: 1, variant: 'primary' },
    style: { stroke: '#8b4513', strokeWidth: 2 },
  };
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'title-chain',
    label: 'Title Chain Exhibit',
    build: (origin) => {
      const fx = origin.x - 320;
      const fy = origin.y - 220;
      const f = frame(uid('frame'), fx, fy, 'Title Chain Exhibit', 640, 440);
      const colX = origin.x - 90;
      const a = shape(uid('s'), colX, fy + 60, 'Sovereign / Patent', 'roundRect');
      const b = shape(uid('s'), colX, fy + 190, 'Conveyance', 'roundRect');
      const c = shape(uid('s'), colX, fy + 320, 'Current Owner', 'roundRect');
      const legend = shape(uid('note'), fx + 24, fy + 60, 'Legend / Notes', 'note', 150, 110);
      return {
        nodes: [f, legend, a, b, c],
        edges: [edge(a.id, b.id), edge(b.id, c.id)],
      };
    },
  },
  {
    id: 'unit-exhibit',
    label: 'Unit Exhibit',
    build: (origin) => {
      const fx = origin.x - 320;
      const fy = origin.y - 180;
      const f = frame(uid('frame'), fx, fy, 'Unit Exhibit', 640, 360);
      const header = shape(uid('note'), fx + 24, fy + 50, 'Unit: __________', 'note', 220, 70);
      const t1 = shape(uid('s'), fx + 80, fy + 180, 'Tract 1', 'rect', 200, 100);
      const t2 = shape(uid('s'), fx + 360, fy + 180, 'Tract 2', 'rect', 200, 100);
      return { nodes: [f, header, t1, t2], edges: [] };
    },
  },
];
