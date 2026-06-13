/**
 * Custom React Flow node for ownership/conveyance cards.
 *
 * Each card shows:
 *   - Header: instrument type + date
 *   - Body: grantor → grantee
 *   - Footer: fraction lines
 *       Line 1: "Granted: 1/4"     (absolute interest conveyed by this deed)
 *       Line 2: "Of Whole: 1/4"    (this grantee's absolute interest in the tract)
 *       Optional: "Remaining: 1/8" (only if grantee has conveyed some away)
 */
import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import {
  clampNodeScale,
  getOwnershipNodeDimensions,
} from '../../engine/flowchart-metrics';
import type { OwnershipNodeData } from '../../types/flowchart';
import CanvasNodeToolbar from './CanvasNodeToolbar';

function OwnershipNodeComponent({ id, data, selected, width, height }: NodeProps & { data: OwnershipNodeData }) {
  const nodeData = data as OwnershipNodeData;
  const scale = clampNodeScale(nodeData.nodeScale ?? 1);
  const metrics = getOwnershipNodeDimensions(scale);
  // A user-resized card carries explicit width/height; fall back to the
  // scale-derived footprint. Print reads the same precedence so they agree.
  const cardWidth = typeof width === 'number' ? width : metrics.width;
  const cardHeight = typeof height === 'number' ? height : metrics.height;
  const handleSize = Math.max(4, 10 * scale);
  const handleBorderWidth = Math.max(1, 2 * scale);
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
  const relShare = d(nodeData.relativeShare);
  const absInterest = d(nodeData.grantFraction);
  const remaining = d(nodeData.remainingFraction);
  const hasConveyedSome = absInterest.greaterThan(0) && remaining.lessThan(absInterest);
  const isFullyConveyed = absInterest.greaterThan(0) && remaining.isZero();

  const grantedFrac = formatAsFraction(relShare);    // fraction of grantor's interest
  const ofWholeFrac = formatAsFraction(absInterest);  // absolute interest in tract
  const remainingFrac = formatAsFraction(remaining);

  return (
    <div
      style={{
        width: cardWidth,
        minHeight: cardHeight,
        height: typeof height === 'number' ? height : undefined,
        borderRadius,
        borderWidth,
      }}
      className={`
        relative flex flex-col border-solid shadow-md transition-shadow
        ${selected ? 'border-leather shadow-lg ring-2 ring-gold/50' : 'border-ledger-line'}
        ${nodeData.stale ? 'border-seal bg-parchment text-ink' : 'bg-parchment text-ink'}
      `}
    >
      {nodeData.stale && (
        <div
          className="absolute -top-2 left-2 z-10 rounded-sm bg-seal px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow"
          title="This box no longer matches a record in the workspace — it was deleted after the chart was built. Re-import to refresh."
        >
          Stale
        </div>
      )}
      <CanvasNodeToolbar nodeId={id} isVisible={!!selected} />
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={96}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />

      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-leather"
        style={{
          width: handleSize,
          height: handleSize,
          borderRadius: '9999px',
          borderWidth: handleBorderWidth,
          borderColor: 'var(--color-parchment)',
        }}
      />

      {/* Header — instrument + date */}
      <div
        className="border-b border-ledger-line bg-parchment-dark"
        style={{
          padding: `${headerPaddingY}px ${headerPaddingX}px`,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-semibold text-ink-light uppercase truncate"
            style={{ fontSize: headerLabelSize, letterSpacing: `${0.05 * scale}em` }}
          >
            {nodeData.instrument || 'Document'}
          </span>
          {nodeData.date && (
            <span
              className="text-ink-light font-mono ml-2 shrink-0"
              style={{ fontSize: dateSize }}
            >
              {nodeData.date}
            </span>
          )}
        </div>
      </div>

      {/* Body — grantor → grantee */}
      <div
        className="flex-1"
        style={{ padding: `${bodyPaddingY}px ${bodyPaddingX}px` }}
      >
        {nodeData.grantor && (
          <div className="text-ink-light truncate" style={{ fontSize: fromSize }}>
            From: {nodeData.grantor}
          </div>
        )}
        <div
          className="font-bold font-display truncate"
          style={{ fontSize: nameSize, lineHeight: 1.2 }}
        >
          {nodeData.grantee || 'Unknown'}
        </div>
      </div>

      {/* Fractions */}
      <div
        className="border-t border-ledger-line bg-ledger space-y-0.5"
        style={{
          padding: `${footerPaddingY}px ${footerPaddingX}px`,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        }}
      >
        {/* Line 1: Granted — what this deed conveyed */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-ink-light uppercase shrink-0"
            style={{ fontSize: fractionLabelSize, letterSpacing: `${0.05 * scale}em` }}
          >
            Granted
          </span>
          <span
            className="font-mono font-semibold text-leather"
            style={{ fontSize: fractionValueSize }}
          >
            {grantedFrac}
          </span>
        </div>

        {/* Line 2: Of Whole — absolute interest in the tract */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-ink-light uppercase shrink-0"
            style={{ fontSize: fractionLabelSize, letterSpacing: `${0.05 * scale}em` }}
          >
            Of Whole
          </span>
          <span
            className="font-mono font-semibold text-ink"
            style={{ fontSize: fractionValueSize }}
          >
            {ofWholeFrac}
          </span>
        </div>

        {/* Line 3: Remaining — only shown if grantee has conveyed some away */}
        {hasConveyedSome && (
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-ink-light uppercase shrink-0"
              style={{ fontSize: fractionLabelSize, letterSpacing: `${0.05 * scale}em` }}
            >
              {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
            </span>
            <span
              className={`font-mono font-semibold ${isFullyConveyed ? 'text-ink-light' : 'text-seal'}`}
              style={{ fontSize: fractionValueSize }}
            >
              {isFullyConveyed ? '—' : remainingFrac}
            </span>
          </div>
        )}
      </div>

      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-leather"
        style={{
          width: handleSize,
          height: handleSize,
          borderRadius: '9999px',
          borderWidth: handleBorderWidth,
          borderColor: 'var(--color-parchment)',
        }}
      />
    </div>
  );
}

export default memo(OwnershipNodeComponent);
