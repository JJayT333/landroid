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
 *
 * The visible box is split into a pure `OwnershipCard` (no React Flow context)
 * so it can be rendered in a server-side test, and `OwnershipNodeComponent`
 * wraps it with the React Flow handles/resizer/toolbar.
 */
import { memo, type ReactNode } from 'react';
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

// Mirror the NodeResizer minimums below. A stale/sub-minimum stored width on a
// saved node would otherwise collapse the card to a sliver with overflowing
// text; floor the footprint so the box always renders as a readable card.
export const MIN_CARD_WIDTH = 160;
export const MIN_CARD_HEIGHT = 96;

/**
 * Resolve a node's stored width/height into the card footprint, flooring both so
 * a stale/sub-minimum stored size can't collapse the card. Pure + exported for
 * test. `height` is the explicit (resized) height, or undefined to auto-size.
 */
export function resolveCardFootprint(
  width: number | undefined,
  height: number | undefined,
  scale: number
): { width: number; minHeight: number; height: number | undefined } {
  const metrics = getOwnershipNodeDimensions(scale);
  return {
    width: Math.max(typeof width === 'number' ? width : metrics.width, MIN_CARD_WIDTH),
    minHeight: Math.max(typeof height === 'number' ? height : metrics.height, MIN_CARD_HEIGHT),
    height: typeof height === 'number' ? Math.max(height, MIN_CARD_HEIGHT) : undefined,
  };
}

/**
 * Pure, context-free card body. No React Flow hooks — `children` carries the
 * RF handles/resizer/toolbar in the live node, and is omitted in tests so the
 * card can be rendered with `renderToStaticMarkup`.
 */
export function OwnershipCard({
  data,
  scale,
  selected = false,
  width,
  minHeight,
  height,
  children,
}: {
  data: OwnershipNodeData;
  scale: number;
  selected?: boolean;
  /** Resolved (already floored) card width in canvas px. */
  width: number;
  /** Resolved (already floored) default footprint height in canvas px. */
  minHeight: number;
  /** Resolved (already floored) explicit height, or undefined to auto-size. */
  height?: number;
  children?: ReactNode;
}) {
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
  const hasConveyedSome = absInterest.greaterThan(0) && remaining.lessThan(absInterest);
  const isFullyConveyed = absInterest.greaterThan(0) && remaining.isZero();

  const grantedFrac = formatAsFraction(relShare);
  const ofWholeFrac = formatAsFraction(absInterest);
  const remainingFrac = formatAsFraction(remaining);

  return (
    <div
      style={{
        width,
        minHeight,
        height,
        borderRadius,
        borderWidth,
      }}
      className={`
        relative flex flex-col border-solid bg-parchment-light text-ink shadow-md transition-shadow
        ${selected ? 'border-leather shadow-lg ring-2 ring-gold/50' : data.stale ? 'border-seal' : 'border-line-strong'}
      `}
    >
      {data.stale && (
        <div
          className="absolute -top-2 left-2 z-10 rounded-sm bg-seal px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow"
          title="This box no longer matches a record in the workspace — it was deleted after the chart was built. Re-import to refresh."
        >
          Stale
        </div>
      )}

      {children}

      {/* Header — instrument + date */}
      <div
        className="border-b border-line-strong bg-parchment-dark"
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
            {data.instrument || 'Document'}
          </span>
          {data.date && (
            <span
              className="text-ink-light font-mono ml-2 shrink-0"
              style={{ fontSize: dateSize }}
            >
              {data.date}
            </span>
          )}
        </div>
      </div>

      {/* Body — grantor → grantee */}
      <div className="flex-1" style={{ padding: `${bodyPaddingY}px ${bodyPaddingX}px` }}>
        {data.grantor && (
          <div className="text-ink-light truncate" style={{ fontSize: fromSize }}>
            From: {data.grantor}
          </div>
        )}
        <div
          className="font-bold font-display truncate"
          style={{ fontSize: nameSize, lineHeight: 1.2 }}
        >
          {data.grantee || 'Unknown'}
        </div>
      </div>

      {/* Fractions */}
      <div
        className="border-t border-line-strong bg-ledger space-y-0.5"
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
          <span className="font-mono font-semibold text-leather" style={{ fontSize: fractionValueSize }}>
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
          <span className="font-mono font-semibold text-ink" style={{ fontSize: fractionValueSize }}>
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
    </div>
  );
}

function OwnershipNodeComponent({ id, data, selected, width, height }: NodeProps & { data: OwnershipNodeData }) {
  const nodeData = data as OwnershipNodeData;
  const scale = clampNodeScale(nodeData.nodeScale ?? 1);
  // A user-resized card carries explicit width/height; fall back to the
  // scale-derived footprint. Floor both so a stale/sub-minimum stored size
  // can't collapse the card. Print reads the same precedence so they agree.
  const footprint = resolveCardFootprint(width, height, scale);
  const handleSize = Math.max(4, 10 * scale);
  const handleBorderWidth = Math.max(1, 2 * scale);

  return (
    <OwnershipCard
      data={nodeData}
      scale={scale}
      selected={!!selected}
      width={footprint.width}
      minHeight={footprint.minHeight}
      height={footprint.height}
    >
      <CanvasNodeToolbar nodeId={id} isVisible={!!selected} />
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_CARD_WIDTH}
        minHeight={MIN_CARD_HEIGHT}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />
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
    </OwnershipCard>
  );
}

export default memo(OwnershipNodeComponent);
