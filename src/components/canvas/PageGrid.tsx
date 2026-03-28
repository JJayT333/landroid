/**
 * Page grid overlay for the React Flow canvas.
 *
 * Renders dashed page boundaries in canvas coordinates so they
 * pan/zoom with the canvas. pointer-events: none so clicks pass through.
 *
 */
import { useViewport } from '@xyflow/react';
import { getPageDimensions } from '../../engine/flowchart-pages';
import type { PageOrientation, PageSizeId } from '../../types/flowchart';

interface PageGridProps {
  cols: number;
  rows: number;
  orientation: PageOrientation;
  pageSize: PageSizeId;
}

export default function PageGrid({ cols, rows, orientation, pageSize }: PageGridProps) {
  const { x, y, zoom } = useViewport();
  const { pw, ph } = getPageDimensions(pageSize, orientation);
  const totalWidth = pw * cols;
  const totalHeight = ph * rows;

  // Generate page tile labels
  const tiles: { label: string; x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
        x: col * pw,
        y: row * ph,
      });
    }
  }

  // Scale-independent stroke/font (constant apparent size on screen)
  const strokeW = 1.5 / zoom;
  const dashLen = 8 / zoom;
  const gapLen = 4 / zoom;
  const fontSize = 13 / zoom;
  const labelPad = 8 / zoom;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
      className="no-print"
    >
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
          {/* Outer border */}
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={totalHeight}
            fill="rgba(255, 255, 255, 0.03)"
            stroke="var(--color-leather)"
            strokeWidth={strokeW * 1.5}
            strokeDasharray={`${dashLen} ${gapLen}`}
          />

          {/* Vertical dividers */}
          {Array.from({ length: cols - 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(i + 1) * pw}
              y1={0}
              x2={(i + 1) * pw}
              y2={totalHeight}
              stroke="var(--color-leather)"
              strokeWidth={strokeW}
              strokeDasharray={`${dashLen} ${gapLen}`}
              opacity={0.4}
            />
          ))}

          {/* Horizontal dividers */}
          {Array.from({ length: rows - 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(i + 1) * ph}
              x2={totalWidth}
              y2={(i + 1) * ph}
              stroke="var(--color-leather)"
              strokeWidth={strokeW}
              strokeDasharray={`${dashLen} ${gapLen}`}
              opacity={0.4}
            />
          ))}

          {/* Page labels */}
          {tiles.map((tile) => (
            <text
              key={tile.label}
              x={tile.x + labelPad}
              y={tile.y + labelPad + fontSize}
              fontSize={fontSize}
              fill="var(--color-leather)"
              opacity={0.5}
              fontFamily="var(--font-mono)"
              fontWeight="bold"
            >
              {tile.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
