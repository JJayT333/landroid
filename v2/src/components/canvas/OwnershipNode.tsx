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
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import type { OwnershipNodeData } from '../../types/flowchart';

function OwnershipNodeComponent({ data, selected }: NodeProps & { data: OwnershipNodeData }) {
  const nodeData = data as OwnershipNodeData;
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
      className={`
        w-72 rounded-lg border-2 shadow-md transition-shadow
        ${selected ? 'border-leather shadow-lg ring-2 ring-gold/50' : 'border-ledger-line'}
        bg-parchment text-ink
      `}
    >
      {/* Top handle */}
      <Handle type="target" position={Position.Top} className="!bg-leather !w-3 !h-3" />

      {/* Header — instrument + date */}
      <div className="px-3 py-1.5 border-b border-ledger-line bg-parchment-dark rounded-t-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-ink-light uppercase tracking-wide truncate">
            {nodeData.instrument || 'Document'}
          </span>
          {nodeData.date && (
            <span className="text-[10px] text-ink-light font-mono ml-2 shrink-0">{nodeData.date}</span>
          )}
        </div>
      </div>

      {/* Body — grantor → grantee */}
      <div className="px-3 py-2">
        {nodeData.grantor && (
          <div className="text-[10px] text-ink-light truncate">
            From: {nodeData.grantor}
          </div>
        )}
        <div className="text-sm font-bold font-display truncate">
          {nodeData.grantee || 'Unknown'}
        </div>
      </div>

      {/* Fractions */}
      <div className="px-3 py-2 border-t border-ledger-line bg-ledger rounded-b-lg space-y-0.5">
        {/* Line 1: Granted — what this deed conveyed */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">Granted</span>
          <span className="text-sm font-mono font-semibold text-leather">{grantedFrac}</span>
        </div>

        {/* Line 2: Of Whole — absolute interest in the tract */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">Of Whole</span>
          <span className="text-sm font-mono font-semibold text-ink">{ofWholeFrac}</span>
        </div>

        {/* Line 3: Remaining — only shown if grantee has conveyed some away */}
        {hasConveyedSome && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">
              {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
            </span>
            <span className={`text-sm font-mono font-semibold ${isFullyConveyed ? 'text-ink-light' : 'text-seal'}`}>
              {isFullyConveyed ? '—' : remainingFrac}
            </span>
          </div>
        )}
      </div>

      {/* Bottom handle */}
      <Handle type="source" position={Position.Bottom} className="!bg-leather !w-3 !h-3" />
    </div>
  );
}

export default memo(OwnershipNodeComponent);
