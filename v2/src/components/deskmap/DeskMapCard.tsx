/**
 * Desk Map card — displays one ownership node with action buttons.
 *
 * Shows instrument/date, grantor->grantee, fractions.
 * Hover reveals action buttons: PRECEDE | CONVEY | ATTACH DOC | DELETE.
 * Click opens the edit modal.
 * Related docs render as compact rectangles beneath the card.
 */
import { formatAsFraction } from '../../engine/fraction-display';
import { d, serialize } from '../../engine/decimal';
import type { OwnershipNode } from '../../types/node';

interface DeskMapCardProps {
  node: OwnershipNode;
  parentInitialFraction: string | null;
  relatedDocs: OwnershipNode[];
  onEdit: (nodeId: string) => void;
  onConvey: (nodeId: string) => void;
  onPrecede: (nodeId: string) => void;
  onAttachDoc: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewPdf: (nodeId: string) => void;
  isActive: boolean;
}

export default function DeskMapCard({
  node,
  parentInitialFraction,
  relatedDocs,
  onEdit,
  onConvey,
  onPrecede,
  onAttachDoc,
  onDelete,
  onViewPdf,
  isActive,
}: DeskMapCardProps) {
  const initial = d(node.initialFraction);
  const remaining = d(node.fraction);
  const hasConveyedSome = initial.greaterThan(0) && remaining.lessThan(initial);
  const isFullyConveyed = initial.greaterThan(0) && remaining.isZero();

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

  return (
    <div className="flex flex-col items-center">
      {/* Main card */}
      <div
        className={`
          group w-72 rounded-lg border-2 shadow-md cursor-pointer transition-all
          hover:shadow-lg hover:border-leather
          ${isActive ? 'border-leather ring-2 ring-gold/50' : 'border-ledger-line'}
          ${isFullyConveyed ? 'opacity-75' : ''}
          bg-parchment text-ink
        `}
        onClick={() => onEdit(node.id)}
      >
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-ledger-line bg-parchment-dark rounded-t-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-ink-light uppercase tracking-wide truncate">
              {node.instrument || 'Document'}
            </span>
            {(node.date || node.fileDate) && (
              <span className="text-[10px] text-ink-light font-mono ml-2 shrink-0">
                {node.date || node.fileDate}
              </span>
            )}
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
          {node.hasDoc && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewPdf(node.id);
              }}
              className="text-[9px] text-leather font-semibold mt-0.5 hover:underline cursor-pointer"
            >
              View PDF
            </button>
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
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded border border-gold/30 bg-gold/5 cursor-pointer hover:bg-gold/10 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(doc.id);
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-semibold text-gold uppercase tracking-wider truncate">
          {doc.instrument || 'Related Doc'}
        </div>
        {(doc.date || doc.fileDate) && (
          <div className="text-[8px] text-ink-light font-mono">{doc.date || doc.fileDate}</div>
        )}
        {doc.remarks && (
          <div className="text-[9px] text-ink-light truncate">{doc.remarks}</div>
        )}
        {doc.hasDoc && (
          <div className="text-[8px] text-leather font-semibold mt-0.5">PDF attached</div>
        )}
      </div>
      {doc.hasDoc && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewPdf(doc.id);
          }}
          className="text-[9px] text-leather font-bold hover:bg-leather/10 px-1.5 py-0.5 rounded shrink-0"
          title="View PDF"
        >
          PDF
        </button>
      )}
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
