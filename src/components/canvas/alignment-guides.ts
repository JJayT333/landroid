/**
 * Drag-snap alignment guides. Given a dragged node rectangle and the other
 * nodes, computes a snapped top-left position and the guide lines to draw when
 * the dragged node's edges or center align with another node's (Miro-style).
 *
 * Pure and framework-free so it can be unit-tested in isolation.
 */

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentSnap {
  /** Snapped top-left position (may equal the input if nothing snapped). */
  x: number;
  y: number;
  /** Flow-space x coordinates of vertical guide lines to draw. */
  verticalLines: number[];
  /** Flow-space y coordinates of horizontal guide lines to draw. */
  horizontalLines: number[];
}

export const DEFAULT_SNAP_THRESHOLD = 6;

function edges(value: number, size: number): [number, number, number] {
  // start, center, end
  return [value, value + size / 2, value + size];
}

export function computeAlignmentSnap(
  dragged: NodeRect,
  others: NodeRect[],
  threshold = DEFAULT_SNAP_THRESHOLD
): AlignmentSnap {
  const [dLeft, dCenterX, dRight] = edges(dragged.x, dragged.width);
  const [dTop, dCenterY, dBottom] = edges(dragged.y, dragged.height);

  let bestX: { delta: number; snap: number; line: number } | null = null;
  let bestY: { delta: number; snap: number; line: number } | null = null;

  for (const other of others) {
    if (other.id === dragged.id) continue;
    const [oLeft, oCenterX, oRight] = edges(other.x, other.width);
    const [oTop, oCenterY, oBottom] = edges(other.y, other.height);

    // Vertical alignment (x axis): match each dragged x-anchor to each other x-anchor.
    for (const [dAnchor, offset] of [
      [dLeft, 0],
      [dCenterX, dragged.width / 2],
      [dRight, dragged.width],
    ] as const) {
      for (const oAnchor of [oLeft, oCenterX, oRight]) {
        const delta = Math.abs(dAnchor - oAnchor);
        if (delta <= threshold && (!bestX || delta < bestX.delta)) {
          bestX = { delta, snap: oAnchor - offset, line: oAnchor };
        }
      }
    }

    // Horizontal alignment (y axis).
    for (const [dAnchor, offset] of [
      [dTop, 0],
      [dCenterY, dragged.height / 2],
      [dBottom, dragged.height],
    ] as const) {
      for (const oAnchor of [oTop, oCenterY, oBottom]) {
        const delta = Math.abs(dAnchor - oAnchor);
        if (delta <= threshold && (!bestY || delta < bestY.delta)) {
          bestY = { delta, snap: oAnchor - offset, line: oAnchor };
        }
      }
    }
  }

  return {
    x: bestX ? bestX.snap : dragged.x,
    y: bestY ? bestY.snap : dragged.y,
    verticalLines: bestX ? [bestX.line] : [],
    horizontalLines: bestY ? [bestY.line] : [],
  };
}
