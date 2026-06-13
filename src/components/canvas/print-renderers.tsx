/**
 * Print-renderer registry — maps a canvas node's kind to its printed body
 * (DA2-F4). PrintOverlay dispatches every node through here so a non-ownership
 * node never gets force-rendered as a bogus ownership card.
 *
 * Each renderer is React-Flow-free and uses inline styles with hardcoded colors
 * (print cannot depend on CSS custom properties).
 */
import type { CSSProperties, ReactNode } from 'react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  clampNodeScale,
  getOwnershipNodeDimensions,
} from '../../engine/flowchart-metrics';
import type {
  FrameNodeData,
  NodeKind,
  OwnershipNodeData,
  ShapeNodeData,
} from '../../types/flowchart';

export interface PrintNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: unknown;
  measured?: { width?: number; height?: number };
  zIndex?: number;
}

// ── Ownership card (moved verbatim from PrintOverlay; markup is golden) ──

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
        height: metrics.height,
        borderRadius,
        border: `${borderWidth}px solid #d4c5a9`,
        background: '#faf3e8',
        color: '#2c1810',
        display: 'flex',
        flexDirection: 'column',
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
            display: 'block',
            minWidth: 0,
            flex: 1,
            fontSize: headerLabelSize,
            fontWeight: 600,
            color: '#5c3d2e',
            textTransform: 'uppercase',
            letterSpacing: `${0.05 * scale}em`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
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
              whiteSpace: 'nowrap',
            }}
          >
            {data.date}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: `${bodyPaddingY}px ${bodyPaddingX}px`,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {data.grantor && (
          <div
            style={{
              fontSize: fromSize,
              color: '#5c3d2e',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            From: {data.grantor}
          </div>
        )}
        <div
          style={{
            fontSize: nameSize,
            lineHeight: 1.2,
            fontWeight: 700,
            fontFamily: '"Playfair Display", Georgia, serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
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
              {isFullyConveyed ? '—' : remainingFrac}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Freeform shape ──────────────────────────────────────

function PrintShape({ data }: { data: ShapeNodeData }) {
  const { shapeType, text, width, height, fontSize, textAlign } = data;

  const style: CSSProperties = {
    width,
    height,
    boxSizing: 'border-box',
    border: '2px solid #d4c5a9',
    background: '#faf3e8',
    color: '#2c1810',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    overflow: 'hidden',
  };
  let textRotate: string | undefined;

  switch (shapeType) {
    case 'ellipse':
      style.borderRadius = 9999;
      break;
    case 'roundRect':
      style.borderRadius = 6;
      break;
    case 'diamond':
      style.transform = 'rotate(45deg)';
      textRotate = 'rotate(-45deg)';
      break;
    case 'note':
      style.borderRadius = 2;
      style.borderLeft = '4px solid #c9a227';
      style.background = '#f5f0e1';
      break;
    default:
      style.borderRadius = 6;
  }

  return (
    <div style={style}>
      <span
        style={{
          fontSize,
          textAlign,
          whiteSpace: 'pre-wrap',
          transform: textRotate,
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ── Plain text node (reserved kind) ─────────────────────

function PrintText({ data }: { data: ShapeNodeData }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        color: '#2c1810',
        fontSize: data.fontSize,
        textAlign: data.textAlign,
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
      }}
    >
      {data.text}
    </div>
  );
}

// ── Frame / section container ───────────────────────────

function PrintFrame({ data }: { data: FrameNodeData }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        boxSizing: 'border-box',
        border: '2px solid #d4c5a9',
        borderRadius: 6,
        background: 'transparent',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '1px 8px',
          borderRight: '1px solid #d4c5a9',
          borderBottom: '1px solid #d4c5a9',
          borderBottomRightRadius: 6,
          background: '#f0e6d3',
          color: '#5c3d2e',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {data.title || 'Frame'}
      </div>
    </div>
  );
}

// ── Dimensions + dispatch ───────────────────────────────

/** True printed footprint of a node, by kind. */
export function getPrintNodeDimensions(node: PrintNode): {
  width: number;
  height: number;
} {
  if (node.type === 'shape' || node.type === 'text' || node.type === 'frame') {
    const data = node.data as Partial<ShapeNodeData & FrameNodeData>;
    return {
      width:
        node.measured?.width ??
        (typeof data.width === 'number' ? data.width : BASE_NODE_WIDTH),
      height:
        node.measured?.height ??
        (typeof data.height === 'number' ? data.height : BASE_NODE_HEIGHT),
    };
  }
  // Ownership (and untyped legacy nodes) keep their scale-based footprint.
  const dims = getOwnershipNodeDimensions(
    (node.data as OwnershipNodeData).nodeScale ?? 1
  );
  return {
    width: node.measured?.width ?? dims.width,
    height: node.measured?.height ?? dims.height,
  };
}

/**
 * Render a node's printed body by kind. Unknown/unimplemented kinds (image,
 * frame, ink) render nothing rather than a bogus card — they get real
 * renderers in later phases.
 */
export function renderPrintNodeBody(node: PrintNode): ReactNode {
  const kind = (node.type ?? 'ownership') as NodeKind;
  switch (kind) {
    case 'shape':
      return <PrintShape data={node.data as ShapeNodeData} />;
    case 'text':
      return <PrintText data={node.data as ShapeNodeData} />;
    case 'frame':
      return <PrintFrame data={node.data as FrameNodeData} />;
    case 'ownership':
      return <PrintCard data={node.data as OwnershipNodeData} />;
    default:
      return null;
  }
}
