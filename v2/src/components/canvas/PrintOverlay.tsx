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
import { getPageDimensions, type PageOrientation } from './PageGrid';
import type { OwnershipNodeData } from '../../types/flowchart';

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
}

interface PrintOverlayProps {
  nodes: PrintNode[];
  edges: PrintEdge[];
  cols: number;
  rows: number;
  orientation: PageOrientation;
}

// ── Lightweight card (no React Flow context) ────────────

const NODE_WIDTH = 288;
const NODE_HEIGHT = 160;

function PrintCard({ data }: { data: OwnershipNodeData }) {
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
        width: NODE_WIDTH,
        borderRadius: 8,
        border: '2px solid #d4c5a9',
        background: '#faf3e8',
        color: '#2c1810',
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '4px 10px',
          borderBottom: '1px solid #d4c5a9',
          background: '#f0e6d3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#5c3d2e',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {data.instrument || 'Document'}
        </span>
        {data.date && (
          <span
            style={{
              fontSize: 10,
              color: '#5c3d2e',
              fontFamily: '"Courier Prime", monospace',
            }}
          >
            {data.date}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '6px 10px' }}>
        {data.grantor && (
          <div style={{ fontSize: 10, color: '#5c3d2e' }}>
            From: {data.grantor}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
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
          padding: '6px 10px',
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
              fontSize: 10,
              color: '#5c3d2e',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Granted
          </span>
          <span
            style={{
              fontSize: 13,
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
              fontSize: 10,
              color: '#5c3d2e',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Of Whole
          </span>
          <span
            style={{
              fontSize: 13,
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
                fontSize: 10,
                color: '#5c3d2e',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
            </span>
            <span
              style={{
                fontSize: 13,
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

      const srcH = src.measured?.height ?? NODE_HEIGHT;

      // Source bottom center → target top center
      const x1 = src.position.x + NODE_WIDTH / 2 - offsetX;
      const y1 = src.position.y + srcH - offsetY;
      const x2 = tgt.position.x + NODE_WIDTH / 2 - offsetX;
      const y2 = tgt.position.y - offsetY;

      // Skip edges entirely outside this page
      if (x1 < -NODE_WIDTH && x2 < -NODE_WIDTH) return null;
      if (x1 > pw + NODE_WIDTH && x2 > pw + NODE_WIDTH) return null;
      if (y1 < -NODE_HEIGHT && y2 < -NODE_HEIGHT) return null;
      if (y1 > ph + NODE_HEIGHT && y2 > ph + NODE_HEIGHT) return null;

      // Simple step path: down, across, down
      const midY = (y1 + y2) / 2;
      const pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

      return (
        <path
          key={i}
          d={pathD}
          fill="none"
          stroke="#8b4513"
          strokeWidth={1.5}
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
}: PrintOverlayProps) {
  const { pw, ph } = getPageDimensions(orientation);

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
      <style>{`@media print { @page { size: letter ${orientation}; margin: 0; } }`}</style>
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
              const nx = node.position.x - offsetX;
              const ny = node.position.y - offsetY;
              const nh = node.measured?.height ?? NODE_HEIGHT;

              // Skip nodes entirely outside this page
              if (nx + NODE_WIDTH < 0 || nx > pw) return null;
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
