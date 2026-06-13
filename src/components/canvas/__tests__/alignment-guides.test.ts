import { describe, expect, it } from 'vitest';
import { computeAlignmentSnap, type NodeRect } from '../alignment-guides';

const other: NodeRect = { id: 'o', x: 100, y: 100, width: 100, height: 100 };

describe('computeAlignmentSnap', () => {
  it('snaps left edges when within threshold and emits a vertical guide', () => {
    const dragged: NodeRect = { id: 'd', x: 103, y: 400, width: 50, height: 50 };
    const snap = computeAlignmentSnap(dragged, [other]);
    expect(snap.x).toBe(100); // left edge snapped to other's left (100)
    expect(snap.verticalLines).toContain(100);
    expect(snap.y).toBe(400); // y unchanged (no vertical neighbor in range)
  });

  it('snaps centers together', () => {
    // other center x = 150. Dragged width 50 -> center at x+25. Snap so center=150 => x=125.
    const dragged: NodeRect = { id: 'd', x: 123, y: 400, width: 50, height: 50 };
    const snap = computeAlignmentSnap(dragged, [other]);
    expect(snap.x).toBe(125);
    expect(snap.verticalLines).toContain(150);
  });

  it('does not snap when outside the threshold', () => {
    const dragged: NodeRect = { id: 'd', x: 300, y: 400, width: 50, height: 50 };
    const snap = computeAlignmentSnap(dragged, [other]);
    expect(snap.x).toBe(300);
    expect(snap.y).toBe(400);
    expect(snap.verticalLines).toHaveLength(0);
    expect(snap.horizontalLines).toHaveLength(0);
  });

  it('ignores the dragged node itself', () => {
    const dragged: NodeRect = { id: 'o', x: 101, y: 101, width: 100, height: 100 };
    const snap = computeAlignmentSnap(dragged, [other]);
    // only candidate is itself (same id) -> skipped
    expect(snap.x).toBe(101);
  });
});
