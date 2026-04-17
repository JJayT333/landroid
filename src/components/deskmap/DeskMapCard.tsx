/**
 * Desk Map card — displays one ownership node with action buttons.
 *
 * Shows instrument/date, grantor->grantee, fractions.
 * Hover reveals action buttons: PRECEDE | CONVEY | ATTACH DOC | DELETE.
 * Click opens the edit modal.
 * Related docs render as compact rectangles beneath the card.
 */
import { memo } from 'react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d, serialize } from '../../engine/decimal';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode } from '../../types/node';
import type { DeskMapPrimaryLeaseSummary } from './deskmap-coverage';
import DeskMapDocumentBadge from './DeskMapDocumentBadge';
import { isLeaseNode } from './deskmap-lease-node';

interface DeskMapCardProps {
  node: OwnershipNode;
  parentInitialFraction: string | null;
  relatedDocs: OwnershipNode[];
  leaseSummary: DeskMapPrimaryLeaseSummary | null;
  npriDiscrepancyActive?: boolean;
  npriDiscrepancyCount?: number;
  onEdit: (nodeId: string) => void;
  onConvey: (nodeId: string) => void;
  onPrecede: (nodeId: string) => void;
  onAttachDoc: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewPdf: (nodeId: string) => void;
}

function DeskMapCard({
  node,
  parentInitialFraction,
  relatedDocs,
  leaseSummary,
  npriDiscrepancyActive = false,
  npriDiscrepancyCount = 0,
  onEdit,
  onConvey,
  onPrecede,
  onAttachDoc,
  onDelete,
  onViewPdf,
}: DeskMapCardProps) {
  const isActive = useWorkspaceStore((state) => state.activeNodeId === node.id);
  const initial = d(node.initialFraction);
  const remaining = d(node.fraction);
  const holdsInterest = node.type !== 'related' && remaining.greaterThan(0);
  const hasConveyedSome = initial.greaterThan(0) && remaining.lessThan(initial);
  const isFullyConveyed = initial.greaterThan(0) && remaining.isZero();
  const hasNpriDiscrepancy = npriDiscrepancyActive || npriDiscrepancyCount > 0;

  const relativeShare = parentInitialFraction
    ? (() => {
        const parentInit = d(parentInitialFraction);
        if (parentInit.isZero()) return '0';
        return serialize(initial.div(parentInit));
      })()
    : node.initialFraction;

  const grantedFrac = formatAsFraction(d(relativeShare));
  const ofWholeFrac = formatAsFraction(initial);
  const remainingFrac = formatAsFraction(remaining);

  // ── Card tint by status ──────────────────────────────────
  // Present-owner status is signalled by tinting the card body itself:
  //   • retained mineral interest (leased or not) → soft sky tint ("present owner")
  //   • fully-conveyed historical card            → parchment (no tint)
  //   • NPRI-discrepancy card                     → seal tint (error state, wins)
  // Leased state is conveyed not by recoloring the lessor card, but by the
  // green lease chip rendered beneath it (see RelatedDocChip). The lessor is
  // still a present mineral owner — they just have a lease attached.
  const isLeased = Boolean(leaseSummary) && holdsInterest;
  const cardBodyTint = hasNpriDiscrepancy
    ? 'bg-seal/5 text-ink'
    : holdsInterest
      ? 'bg-sky-50 text-ink'
      : 'bg-parchment text-ink';
  const headerTint = hasNpriDiscrepancy
    ? 'bg-seal/10'
    : holdsInterest
      ? 'bg-sky-100/70'
      : 'bg-parchment-dark';

  return (
    <div className="flex flex-col items-center">
      {/* Main card */}
      <div
        className={`
          group w-72 rounded-lg border-2 shadow-md cursor-pointer transition-all
          hover:shadow-lg ${hasNpriDiscrepancy ? 'hover:border-seal' : 'hover:border-leather'}
          ${hasNpriDiscrepancy
            ? 'border-seal ring-2 ring-seal/20 shadow-[0_10px_24px_rgba(127,29,29,0.20)]'
            : isActive
            ? 'border-leather ring-2 ring-gold/50'
            : holdsInterest
              ? 'border-leather/60 shadow-[0_8px_18px_rgba(92,61,46,0.12)]'
              : 'border-ledger-line'}
          ${isFullyConveyed ? 'opacity-75' : ''}
          ${cardBodyTint}
        `}
        onClick={() => onEdit(node.id)}
      >
        {/* Header */}
        <div
          className={`px-3 py-1.5 border-b border-ledger-line rounded-t-lg ${headerTint}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              {holdsInterest && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_0_2px_rgba(212,197,169,0.9)]"
                  title={isLeased ? 'Present owner — leased' : 'Present owner'}
                />
              )}
              <span className="text-[10px] font-semibold text-ink-light uppercase tracking-wide truncate">
                {node.instrument || 'Document'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {hasNpriDiscrepancy && (
                <span className="rounded-full border border-seal/25 bg-seal/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-seal">
                  NPRI Issue
                </span>
              )}
              {(node.date || node.fileDate) && (
                <span className="text-[10px] text-ink-light font-mono">
                  {node.date || node.fileDate}
                </span>
              )}
            </div>
          </div>
          {(node.vol || node.page || node.docNo) && (
            <div className="text-[9px] text-ink-light/70 font-mono mt-0.5">
              {node.vol && `Vol. ${node.vol}`}
              {node.vol && node.page && ' / '}
              {node.page && `Pg. ${node.page}`}
              {(node.vol || node.page) && node.docNo && ' \u2014 '}
              {node.docNo && `Doc# ${node.docNo}`}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          {node.grantor && (
            <div className="text-[10px] text-ink-light truncate">
              From: {node.grantor}
            </div>
          )}
          <div className="text-sm font-bold font-display truncate">
            {node.grantee || 'Unknown'}
            {node.isDeceased && (
              <span className="ml-1 text-[10px] text-seal font-normal">(deceased)</span>
            )}
          </div>
          <DeskMapDocumentBadge node={node} onViewPdf={onViewPdf} />
          {hasNpriDiscrepancy && (
            <div className="mt-2 rounded-md border border-seal/25 bg-seal/10 px-2 py-1.5 text-[10px] leading-4 text-seal">
              NPRI burden discrepancy on this branch. Review the red NPRI card
              {npriDiscrepancyCount > 1 ? `s (${npriDiscrepancyCount})` : ''}.
            </div>
          )}
        </div>

        {/* Fractions */}
        <div className="px-3 py-2 border-t border-ledger-line bg-ledger space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">Granted</span>
            <span className="text-sm font-mono font-semibold text-leather">{grantedFrac}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">Of Whole</span>
            <span className="text-sm font-mono font-semibold text-ink">{ofWholeFrac}</span>
          </div>
          {hasConveyedSome && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-light text-[10px] uppercase tracking-wider shrink-0">
                {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
              </span>
              <span className={`text-sm font-mono font-semibold ${isFullyConveyed ? 'text-ink-light' : 'text-seal'}`}>
                {isFullyConveyed ? '\u2014' : remainingFrac}
              </span>
            </div>
          )}
        </div>

        {/* Related docs — shown inline beneath fractions */}
        {relatedDocs.length > 0 && (
          <div className="px-2 py-1.5 border-t border-ledger-line space-y-1">
            {relatedDocs.map((doc) => (
              <RelatedDocChip
                key={doc.id}
                doc={doc}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewPdf={onViewPdf}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="hidden group-hover:flex px-2 py-1.5 border-t border-ledger-line bg-parchment-dark rounded-b-lg gap-1 justify-center">
          <ActionBtn label="PRECEDE" variant="muted" onClick={() => onPrecede(node.id)} />
          <ActionBtn label="CONVEY" variant="primary" onClick={() => onConvey(node.id)} />
          <ActionBtn label="ATTACH" variant="accent" onClick={() => onAttachDoc(node.id)} />
          <ActionBtn label="DELETE" variant="danger" onClick={() => onDelete(node.id)} />
        </div>
      </div>
    </div>
  );
}

function deskMapCardPropsAreEqual(
  previous: DeskMapCardProps,
  next: DeskMapCardProps
): boolean {
  return (
    previous.node === next.node &&
    previous.parentInitialFraction === next.parentInitialFraction &&
    previous.relatedDocs === next.relatedDocs &&
    previous.leaseSummary === next.leaseSummary &&
    previous.npriDiscrepancyActive === next.npriDiscrepancyActive &&
    previous.npriDiscrepancyCount === next.npriDiscrepancyCount &&
    previous.onEdit === next.onEdit &&
    previous.onConvey === next.onConvey &&
    previous.onPrecede === next.onPrecede &&
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewPdf === next.onViewPdf
  );
}

export default memo(DeskMapCard, deskMapCardPropsAreEqual);

// ── Related document chip ───────────────────────────────

function RelatedDocChip({
  doc,
  onEdit,
  onDelete,
  onViewPdf,
}: {
  doc: OwnershipNode;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewPdf: (id: string) => void;
}) {
  // Lease chips render in emerald (lessee = green) so the leased relationship
  // is visible beneath the still-blue lessor card. Other related docs keep the
  // gold treatment.
  const isLease = isLeaseNode(doc);
  const chipChrome = isLease
    ? 'border-emerald-400/50 bg-emerald-50 hover:bg-emerald-100'
    : 'border-gold/30 bg-gold/5 hover:bg-gold/10';
  const chipLabelTone = isLease ? 'text-emerald-800' : 'text-gold';

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors ${chipChrome}`}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(doc.id);
      }}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[9px] font-semibold uppercase tracking-wider truncate ${chipLabelTone}`}>
          {doc.instrument || 'Related Doc'}
        </div>
        {(doc.date || doc.fileDate) && (
          <div className="text-[8px] text-ink-light font-mono">{doc.date || doc.fileDate}</div>
        )}
        {doc.remarks && (
          <div className="text-[9px] text-ink-light truncate">{doc.remarks}</div>
        )}
        <DeskMapDocumentBadge node={doc} onViewPdf={onViewPdf} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(doc.id);
        }}
        className="text-[10px] text-seal/50 hover:text-seal shrink-0"
        title="Remove"
      >
        &times;
      </button>
    </div>
  );
}

// ── Action button ───────────────────────────────────────

const ACTION_VARIANTS = {
  muted: 'text-ink-light hover:bg-ink-light/10',
  primary: 'text-leather hover:bg-leather/10',
  lease: 'text-emerald-700 hover:bg-emerald-100',
  accent: 'text-gold hover:bg-gold/10',
  danger: 'text-seal hover:bg-seal/10',
} as const;

function ActionBtn({
  label,
  variant,
  onClick,
}: {
  label: string;
  variant: keyof typeof ACTION_VARIANTS;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${ACTION_VARIANTS[variant]}`}
    >
      {label}
    </button>
  );
}
