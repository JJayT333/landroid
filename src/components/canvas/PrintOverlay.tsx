/**
 * Print overlay — renders each page tile as a separate printed page.
 *
 * Hidden on screen (print-only class). When the browser prints,
 * each tile clips to its rectangle of the canvas, producing one
 * letter-size sheet per tile.
 *
 * Nodes are rendered by kind through the print-renderer registry
 * (print-renderers.tsx); edges are rendered as SVG paths.
 */
import { getPageDimensions, getPrintPageSize } from '../../engine/flowchart-pages';
import type { FlowEdgeData } from '../../types/flowchart';
import { getOwnershipEdgeGeometry } from './ownership-edge-geometry';
import {
  getPrintNodeDimensions,
  renderPrintNodeBody,
  type PrintNode,
} from './print-renderers';
import type { PageOrientation, PageSizeId } from '../../types/flowchart';

// ── Types ───────────────────────────────────────────────

interface PrintEdge {
  source: string;
  target: string;
  data?: FlowEdgeData;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

interface PrintOverlayProps {
  nodes: PrintNode[];
  edges: PrintEdge[];
  cols: number;
  rows: number;
  orientation: PageOrientation;
  pageSize: PageSizeId;
}

// ── Edge rendering ──────────────────────────────────────

function renderEdges(
  nodes: PrintNode[],
  edges: PrintEdge[],
  offsetX: number,
  offsetY: number,
  pw: number,
  ph: number,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges
    .map((edge, i) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return null;

      const srcDims = getPrintNodeDimensions(src);
      const tgtDims = getPrintNodeDimensions(tgt);
      const srcW = srcDims.width;
      const srcH = srcDims.height;
      const tgtW = tgtDims.width;

      // Source bottom center → target top center
      const x1 = src.position.x + srcW / 2 - offsetX;
      const y1 = src.position.y + srcH - offsetY;
      const x2 = tgt.position.x + tgtW / 2 - offsetX;
      const y2 = tgt.position.y - offsetY;

      // Skip edges entirely outside this page
      if (x1 < -srcW && x2 < -tgtW) return null;
      if (x1 > pw + srcW && x2 > pw + tgtW) return null;
      if (y1 < -srcH && y2 < -tgtDims.height) return null;
      if (y1 > ph + srcH && y2 > ph + tgtDims.height) return null;

      const geometry = getOwnershipEdgeGeometry({
        sourceX: x1,
        sourceY: y1,
        targetX: x2,
        targetY: y2,
        edgeData: edge.data,
        strokeWidth: edge.style?.strokeWidth,
      });

      return (
        <path
          key={i}
          d={geometry.path}
          fill="none"
          stroke={edge.style?.stroke ?? '#8b4513'}
          strokeWidth={geometry.strokeWidth}
        />
      );
    })
    .filter(Boolean);
}

// ── Edge label (DA2-F4 / edge labels) ──────────────────

function renderEdgeLabels(
  nodes: PrintNode[],
  edges: PrintEdge[],
  offsetX: number,
  offsetY: number,
  pw: number,
  ph: number,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges
    .map((edge, i) => {
      const label = edge.data?.label;
      if (!label) return null;
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return null;

      const srcDims = getPrintNodeDimensions(src);
      const tgtDims = getPrintNodeDimensions(tgt);
      const x1 = src.position.x + srcDims.width / 2 - offsetX;
      const y1 = src.position.y + srcDims.height - offsetY;
      const x2 = tgt.position.x + tgtDims.width / 2 - offsetX;
      const y2 = tgt.position.y - offsetY;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;

      if (cx < 0 || cx > pw || cy < 0 || cy > ph) return null;

      return (
        <div
          key={`label-${i}`}
          style={{
            position: 'absolute',
            left: cx,
            top: cy,
            transform: 'translate(-50%, -50%)',
            fontSize: 10,
            fontFamily: '"Courier Prime", monospace',
            color: '#2c1810',
            background: '#faf3e8',
            border: '1px solid #d4c5a9',
            borderRadius: 3,
            padding: '1px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      );
    })
    .filter(Boolean);
}

// ── Main overlay ────────────────────────────────────────

export default function PrintOverlay({
  nodes,
  edges,
  cols,
  rows,
  orientation,
  pageSize,
}: PrintOverlayProps) {
  const { pw, ph } = getPageDimensions(pageSize, orientation);
  const printPageSize = getPrintPageSize(pageSize, orientation);

  const tiles: { row: number; col: number; label: string }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        row,
        col,
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
      });
    }
  }

  return (
    <div className="print-only" id="print-overlay">
      {/* Dynamic @page orientation */}
      <style>{`@media print { @page { size: ${printPageSize}; margin: 0; } }`}</style>
      {tiles.map((tile, idx) => {
        const offsetX = tile.col * pw;
        const offsetY = tile.row * ph;

        return (
          <div
            key={tile.label}
            className="print-page"
            style={{
              width: pw,
              height: ph,
              position: 'relative',
              overflow: 'hidden',
              background: 'white',
              pageBreakAfter: idx < tiles.length - 1 ? 'always' : 'auto',
              breakAfter: idx < tiles.length - 1 ? 'page' : 'auto',
            }}
          >
            {/* Edge SVG layer */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: pw,
                height: ph,
              }}
            >
              {renderEdges(nodes, edges, offsetX, offsetY, pw, ph)}
            </svg>

            {/* Edge labels (HTML, above the SVG) */}
            {renderEdgeLabels(nodes, edges, offsetX, offsetY, pw, ph)}

            {/* Nodes, dispatched by kind, painted back-to-front by z-order
                so frames (negative z) sit behind content. */}
            {[...nodes]
              .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
              .map((node) => {
              const dims = getPrintNodeDimensions(node);
              const nx = node.position.x - offsetX;
              const ny = node.position.y - offsetY;
              const nw = dims.width;
              const nh = dims.height;

              // Skip nodes entirely outside this page
              if (nx + nw < 0 || nx > pw) return null;
              if (ny + nh < 0 || ny > ph) return null;

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: nx,
                    top: ny,
                  }}
                >
                  {renderPrintNodeBody(node)}
                </div>
              );
            })}

            {/* Subtle page label for reference */}
            <div
              style={{
                position: 'absolute',
                bottom: 4,
                right: 8,
                fontSize: 9,
                color: '#c4b89a',
                fontFamily: '"Courier Prime", monospace',
              }}
            >
              {tile.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
