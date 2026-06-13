/**
 * PNG export for the flowchart canvas.
 *
 * Frames the whole graph with React Flow's bounds helpers, renders the
 * `.react-flow__viewport` element to a PNG via html-to-image, and triggers a
 * download. Off-screen nodes are included because we compute a viewport
 * transform that fits the entire node bounding box, not just what's visible.
 */
import type { Node } from '@xyflow/react';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';

const EXPORT_PADDING = 0.1;
const EXPORT_BACKGROUND = '#faf3e8'; // parchment, matches the canvas surface

export interface CanvasExportOptions {
  /** Pixel width of the exported image (height derives from node bounds). */
  width?: number;
  height?: number;
  fileName?: string;
  background?: string;
}

/**
 * Render the current canvas to a PNG and download it. Returns false when there
 * is nothing to export (no nodes / viewport element missing).
 */
export async function exportCanvasToPng(
  nodes: Node[],
  options: CanvasExportOptions = {}
): Promise<boolean> {
  if (nodes.length === 0) return false;

  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl) return false;

  const bounds = getNodesBounds(nodes);
  const imageWidth = options.width ?? Math.max(640, Math.ceil(bounds.width + 160));
  const imageHeight = options.height ?? Math.max(480, Math.ceil(bounds.height + 160));

  const transform = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.2, // minZoom
    2, // maxZoom
    EXPORT_PADDING
  );

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: options.background ?? EXPORT_BACKGROUND,
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  });

  const link = document.createElement('a');
  link.download = options.fileName ?? `flowchart-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = dataUrl;
  link.click();
  return true;
}
