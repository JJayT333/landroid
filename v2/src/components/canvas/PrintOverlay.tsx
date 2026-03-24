/**
 * Print overlay — renders each page tile as a separate printed page.
 *
 * Hidden on screen (print-only class). When the browser prints,
 * each tile clips to its rectangle of the canvas, producing one
 * letter-size sheet per tile.
 *
 * Nodes are rendered as lightweight cards (no React Flow dependency).
 * Edges are rendered as SVG paths.
 */
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import {
  clampNodeScale,
  getOwnershipNodeDimensions,
} from '../../engine/flowchart-metrics';
import { getPageDimensions, getPrintPageSize } from '../../engine/flowchart-pages';
import type { FlowEdgeData, OwnershipNodeData } from '../../types/flowchart';
import { getOwnershipEdgeGeometry } from './ownership-edge-geometry';
import type { PageOrientation, PageSizeId } from '../../types/flowchart';

// ── Types ───────────────────────────────────────────────

interface PrintNode {
  id: string;
  position: { x: number; y: number };
  data: OwnershipNodeData;
  measured?: { width?: number; height?: number };
}

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

// ── Lightweight card (no React Flow context) ────────────

function PrintCard({ data }: { data: OwnershipNodeData }) {
  const scale = clampNodeScale(data.nodeScale ?? 1);
  const metrics = getOwnershipNodeDimensions(scale);
  const borderRadius = 8 * scale;
  const borderWidth = Math.max(1, 2 * scale);
  const headerPaddingX = 12 * scale;
  const headerPaddingY = 6 * scale;
  const bodyPaddingX = 12 * scale;
  const bodyPaddingY = 8 * scale;
  const footerPaddingX = 12 * scale;
  const footerPaddingY = 8 * scale;
  const headerLabelSize = 10 * scale;
  const dateSize = 10 * scale;
  const fromSize = 10 * scale;
  const nameSize = 14 * scale;
  const fractionLabelSize = 10 * scale;
  const fractionValueSize = 14 * scale;
  const relShare = d(data.relativeShare);
  const absInterest = d(data.grantFraction);
  const remaining = d(data.remainingFraction);
  const hasConveyedSome =
    absInterest.greaterThan(0) && remaining.lessThan(absInterest);
  const isFullyConveyed =
    absInterest.greaterThan(0) && remaining.isZero();

  const grantedFrac = formatAsFraction(relShare);
  const ofWholeFrac = formatAsFraction(absInterest);
  const remainingFrac = formatAsFraction(remaining);

  return (
    <div
      style={{
        width: metrics.width,
        minHeight: metrics.height,
        borderRadius,
        border: `${borderWidth}px solid #d4c5a9`,
        background: '#faf3e8',
        color: '#2c1810',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${headerPaddingY}px ${headerPaddingX}px`,
          borderBottom: '1px solid #d4c5a9',
          background: '#f0e6d3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: headerLabelSize,
            fontWeight: 600,
            color: '#5c3d2e',
            textTransform: 'uppercase',
            letterSpacing: `${0.05 * scale}em`,
          }}
        >
          {data.instrument || 'Document'}
        </span>
        {data.date && (
          <span
            style={{
              fontSize: dateSize,
              color: '#5c3d2e',
              fontFamily: '"Courier Prime", monospace',
            }}
          >
            {data.date}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: `${bodyPaddingY}px ${bodyPaddingX}px` }}>
        {data.grantor && (
          <div style={{ fontSize: fromSize, color: '#5c3d2e' }}>
            From: {data.grantor}
          </div>
        )}
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 700,
            fontFamily: '"Playfair Display", Georgia, serif',
          }}
        >
          {data.grantee || 'Unknown'}
        </div>
      </div>

      {/* Fractions */}
      <div
        style={{
          padding: `${footerPaddingY}px ${footerPaddingX}px`,
          borderTop: '1px solid #d4c5a9',
          background: '#f5f0e1',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: fractionLabelSize,
              color: '#5c3d2e',
              textTransform: 'uppercase',
              letterSpacing: `${0.05 * scale}em`,
            }}
          >
            Granted
          </span>
          <span
            style={{
              fontSize: fractionValueSize,
              fontFamily: '"Courier Prime", monospace',
              fontWeight: 600,
              color: '#8b4513',
            }}
          >
            {grantedFrac}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: fractionLabelSize,
              color: '#5c3d2e',
              textTransform: 'uppercase',
              letterSpacing: `${0.05 * scale}em`,
            }}
          >
            Of Whole
          </span>
          <span
            style={{
              fontSize: fractionValueSize,
              fontFamily: '"Courier Prime", monospace',
              fontWeight: 600,
              color: '#2c1810',
            }}
          >
            {ofWholeFrac}
          </span>
        </div>
        {hasConveyedSome && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: fractionLabelSize,
                color: '#5c3d2e',
                textTransform: 'uppercase',
                letterSpacing: `${0.05 * scale}em`,
              }}
            >
              {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
            </span>
            <span
              style={{
                fontSize: fractionValueSize,
                fontFamily: '"Courier Prime", monospace',
                fontWeight: 600,
                color: isFullyConveyed ? '#5c3d2e' : '#b22222',
              }}
            >
              {isFullyConveyed ? '\u2014' : remainingFrac}
            </span>
          </div>
        )}
      </div>
    </div>
  );
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

      const srcDims = getOwnershipNodeDimensions(src.data.nodeScale ?? 1);
      const tgtDims = getOwnershipNodeDimensions(tgt.data.nodeScale ?? 1);
      const srcW = src.measured?.width ?? srcDims.width;
      const srcH = src.measured?.height ?? srcDims.height;
      const tgtW = tgt.measured?.width ?? tgtDims.width;

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

            {/* Node cards */}
            {nodes.map((node) => {
              const dims = getOwnershipNodeDimensions(node.data.nodeScale ?? 1);
              const nx = node.position.x - offsetX;
              const ny = node.position.y - offsetY;
              const nw = node.measured?.width ?? dims.width;
              const nh = node.measured?.height ?? dims.height;

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
                  <PrintCard data={node.data} />
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
