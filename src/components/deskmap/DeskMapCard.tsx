/**
 * Desk Map card — displays one ownership node with action buttons.
 *
 * Shows instrument/date, grantor->grantee, fractions.
 * Hover reveals action buttons: PRECEDE | CONVEY | LEASE | ATTACH DOC | DELETE.
 * LEASE shows only on a present mineral owner (a lease overlays the owner, it
 * does not convey ownership).
 * Click opens the edit modal.
 * Related docs render as compact rectangles beneath the card.
 */
import { memo } from 'react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d, serialize } from '../../engine/decimal';
import { useWorkspaceStore } from '../../store/workspace-store';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { OwnershipNode } from '../../types/node';
import { isNpriNode } from '../../types/node';
import type { DeskMapPrimaryLeaseSummary } from './deskmap-coverage';
import DeskMapDocumentChips from './DeskMapDocumentChips';
import Chip from '../shared/Chip';
import { isLeaseNode } from './deskmap-lease-node';
import { FormulaTooltip } from '../leasehold/FormulaTooltip';
import {
  grantedFractionFormula,
  ofWholeFractionFormula,
  remainingFractionFormula,
} from './deskmap-formulas';

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
  onLease: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewDoc: (docId: string) => void;
  readOnly?: boolean;
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
  onLease,
  onDelete,
  onViewDoc,
  readOnly = false,
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
  // Card body tints communicate node class at a glance:
  //   • mineral present owner (leased or not) → soft sky tint (blue)
  //   • NPRI burden card, healthy             → soft green tint (a distinct
  //                                              shade from the emerald lease
  //                                              chips, so NPRIs and lease
  //                                              chips never get confused)
  //   • NPRI-discrepancy card                 → seal tint (red, wins everything)
  //   • fully-conveyed historical card        → parchment (no tint)
  //
  // Leased state is conveyed not by recoloring the lessor card, but by the
  // emerald lease chip rendered beneath it (see RelatedDocChip). The lessor
  // is still a present mineral owner — they just have a lease attached.
  const isLeased = Boolean(leaseSummary) && holdsInterest;
  const isNpri = isNpriNode(node);
  // Leasing is offered only on a present mineral owner (holds remaining interest,
  // mineral class, not an NPRI/related node). A lease is an overlay on the
  // present owner, not a conveyance — so it sits beside CONVEY here.
  const canLease = holdsInterest && node.interestClass === 'mineral' && !isNpri;
  const cardBodyTint = hasNpriDiscrepancy
    ? 'bg-seal/5 text-ink'
    : isNpri && holdsInterest
      ? 'bg-green-50 text-ink'
      : holdsInterest
        ? 'bg-sky-50 text-ink'
        : 'bg-parchment-light text-ink';
  const headerTint = hasNpriDiscrepancy
    ? 'bg-seal/10'
    : isNpri && holdsInterest
      ? 'bg-green-100/70'
      : holdsInterest
        ? 'bg-sky-100/70'
        : 'bg-[#f1e8d5]';
  // Hairline + label inks follow the tint family (design handoff values).
  const innerLine = hasNpriDiscrepancy
    ? 'border-seal/25'
    : isNpri && holdsInterest
      ? 'border-tint-green-line'
      : holdsInterest
        ? 'border-tint-sky-line'
        : 'border-ledger-line';
  const mutedInk = hasNpriDiscrepancy
    ? 'text-ink-light'
    : isNpri && holdsInterest
      ? 'text-tint-green-ink'
      : holdsInterest
        ? 'text-tint-sky-ink'
        : 'text-ink-light';

  return (
    <div className="flex flex-col items-center">
      {/* Main card */}
      <div
        className={`
          group w-[232px] rounded-[10px] border transition-all
          ${hasNpriDiscrepancy
            ? 'border-seal ring-2 ring-seal/20 shadow-[0_10px_24px_rgba(127,29,29,0.20)] hover:border-seal'
            : isActive
            ? 'border-leather shadow-[0_0_0_3px_var(--color-parchment-dark),0_3px_10px_rgba(45,33,20,0.09)] hover:border-leather'
            : holdsInterest
              ? `${innerLine} shadow-[0_3px_10px_rgba(45,33,20,0.09)] hover:border-leather/70 hover:shadow-[0_5px_14px_rgba(45,33,20,0.13)]`
              : 'border-ledger-line shadow-[0_2px_8px_rgba(45,33,20,0.07)] hover:border-leather/50'}
          ${isFullyConveyed ? 'opacity-85' : ''}
          ${readOnly ? 'cursor-default' : 'cursor-pointer'}
          ${cardBodyTint}
        `}
        aria-disabled={readOnly}
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
        onClick={() => {
          if (!readOnly) onEdit(node.id);
        }}
      >
        {/* Header */}
        <div
          className={`rounded-t-[9px] border-b px-2.5 py-1.5 ${innerLine} ${headerTint}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              {holdsInterest && (
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold-light shadow-[0_0_0_2px_rgba(255,255,255,0.8)]"
                  title={isLeased ? 'Present owner — leased' : 'Present owner'}
                />
              )}
              <span className={`truncate text-[8.5px] font-bold uppercase tracking-wide ${mutedInk}`}>
                {node.instrument || 'Document'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {hasNpriDiscrepancy && (
                <Chip tone="seal" shape="pill">
                  NPRI Issue
                </Chip>
              )}
              {(node.date || node.fileDate) && (
                <span className={`font-mono text-[9px] ${mutedInk}`}>
                  {node.date || node.fileDate}
                </span>
              )}
            </div>
          </div>
          {(node.vol || node.page || node.docNo) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] font-mono">
              {(node.vol || node.page) && (
                <span className="inline-flex items-center rounded-sm border border-leather/30 bg-leather/5 px-1 text-leather">
                  {node.vol && `Vol. ${node.vol}`}
                  {node.vol && node.page && ' / '}
                  {node.page && `Pg. ${node.page}`}
                </span>
              )}
              {node.docNo && (
                <span className="text-ink-light/70">{`Doc# ${node.docNo}`}</span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-2.5 py-2">
          {node.grantor && (
            <div className={`truncate text-[9.5px] ${mutedInk}`}>
              From: {node.grantor}
            </div>
          )}
          <div className="truncate font-display text-[13.5px] font-bold leading-snug text-ink">
            {node.grantee || 'Unknown'}
            {node.isDeceased && (
              <span className="ml-1 text-[10px] text-seal font-normal font-body">(deceased)</span>
            )}
          </div>
          <DeskMapDocumentChips node={node} onViewDoc={onViewDoc} />
          {hasNpriDiscrepancy && (
            <div className="mt-2 rounded-md border border-seal/25 bg-seal/10 px-2 py-1.5 text-[10px] leading-4 text-seal">
              NPRI burden discrepancy on this branch. Review the red NPRI card
              {npriDiscrepancyCount > 1 ? `s (${npriDiscrepancyCount})` : ''}.
            </div>
          )}
        </div>

        {/* Fractions */}
        <div className={`grid gap-[3px] border-t px-2.5 py-[7px] ${innerLine}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={`shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.05em] ${mutedInk}`}>Granted</span>
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-ink">
              <FormulaTooltip content={grantedFractionFormula(node, parentInitialFraction)}>
                {grantedFrac}
              </FormulaTooltip>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={`shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.05em] ${mutedInk}`}>Of Whole</span>
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-ink">
              <FormulaTooltip content={ofWholeFractionFormula(node)}>
                {ofWholeFrac}
              </FormulaTooltip>
            </span>
          </div>
          {hasConveyedSome && (
            <div className="flex items-center justify-between gap-2">
              <span className={`shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.05em] ${mutedInk}`}>
                {isFullyConveyed ? 'Conveyed All' : 'Remaining'}
              </span>
              <span className={`font-mono text-[11.5px] font-semibold tabular-nums ${isFullyConveyed ? 'text-ink-light' : 'text-seal'}`}>
                {isFullyConveyed ? (
                  '\u2014'
                ) : (
                  <FormulaTooltip content={remainingFractionFormula(node)}>
                    {remainingFrac}
                  </FormulaTooltip>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Related docs — shown inline beneath fractions */}
        {relatedDocs.length > 0 && (
          <div className={`space-y-1 border-t px-2 py-1.5 ${innerLine}`}>
            {relatedDocs.map((doc) => (
              <RelatedDocChip
                key={doc.id}
                doc={doc}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDoc={onViewDoc}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}

        {/* Action row — three slots, Convey centered (operator feedback).
            Attach and Delete live inside the editor now; the empty third cell
            keeps Convey centered when Lease doesn't apply. */}
        <div className={`hidden grid-cols-3 justify-items-center rounded-b-[9px] border-t bg-white/70 px-2 py-[5px] group-hover:grid ${innerLine}`}>
          <ActionBtn label="Precede" variant="muted" disabled={readOnly} onClick={() => onPrecede(node.id)} />
          <ActionBtn label="Convey" variant="primary" disabled={readOnly} onClick={() => onConvey(node.id)} />
          {canLease ? (
            <ActionBtn label="Lease" variant="lease" disabled={readOnly} onClick={() => onLease(node.id)} />
          ) : (
            <span aria-hidden="true" />
          )}
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
    previous.onLease === next.onLease &&
    previous.onDelete === next.onDelete &&
    previous.onViewDoc === next.onViewDoc &&
    previous.readOnly === next.readOnly
  );
}

export default memo(DeskMapCard, deskMapCardPropsAreEqual);

// ── Related document chip ───────────────────────────────

function RelatedDocChip({
  doc,
  onEdit,
  onDelete,
  onViewDoc,
  readOnly = false,
}: {
  doc: OwnershipNode;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewDoc: (id: string) => void;
  readOnly?: boolean;
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
      className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${chipChrome}`}
      aria-disabled={readOnly}
      title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!readOnly) onEdit(doc.id);
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
        <DeskMapDocumentChips node={doc} onViewDoc={onViewDoc} />
      </div>
      <button
        type="button"
        disabled={readOnly}
        onClick={(e) => {
          e.stopPropagation();
          if (readOnly) return;
          onDelete(doc.id);
        }}
        className="text-[10px] text-seal/50 hover:text-seal shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Remove'}
      >
        &times;
      </button>
    </div>
  );
}

// ── Action button ───────────────────────────────────────

const ACTION_VARIANTS = {
  muted: 'text-ink-light hover:bg-parchment-dark',
  primary: 'text-leather hover:bg-parchment-dark',
  lease: 'text-tint-green-ink hover:bg-emerald-100',
  accent: 'text-leather hover:bg-parchment-dark',
  danger: 'text-seal hover:bg-[#f7e9e4]',
} as const;

function ActionBtn({
  label,
  variant,
  onClick,
  disabled = false,
}: {
  label: string;
  variant: keyof typeof ACTION_VARIANTS;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      title={disabled ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
      className={`rounded-[5px] px-[5px] py-[3px] text-[8px] font-bold uppercase tracking-[0.05em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${ACTION_VARIANTS[variant]}`}
    >
      {label}
    </button>
  );
}
