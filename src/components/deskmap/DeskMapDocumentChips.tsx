/**
 * Desk Map document chips — multi-attachment surface for an ownership
 * node. Phase 5 / B1 replacement for the single-chip
 * `DeskMapDocumentBadge`.
 *
 * Renders up to `maxVisible` chips (4 by default per the design doc),
 * then collapses the rest behind a "+N more" chip that expands inline.
 * Each chip is a click-target — the `onViewDoc` callback receives the
 * specific attachment's `docId`, not the node ID.
 *
 * Behavior matches the single-chip badge for tone, card-mount, and the
 * "View attached PDF" hover tooltip. The kind tag (`deed | lease | obit
 * | ...`) is not yet color-coded in this pass — Phase B follow-ups can
 * add a chip-color band keyed off `attachment.kind` without changing
 * this component's call signature.
 */
import { useState } from 'react';
import type {
  NodeAttachmentSummary,
  OwnershipNode,
} from '../../types/node';

/**
 * Resolve the chip label for a single attachment. Falls back to the
 * node's `docNo` when the attachment has no filename, and finally to a
 * generic placeholder.
 */
export function getAttachmentChipLabel(
  attachment: NodeAttachmentSummary,
  node: Pick<OwnershipNode, 'docNo'>
): string {
  if (attachment.fileName) return attachment.fileName;
  if (node.docNo) return `${node.docNo}.pdf`;
  return 'PDF attached';
}

const TONE_CLASSNAMES = {
  leather:
    'border-leather/25 bg-leather/5 text-leather hover:bg-leather/10',
  emerald:
    'border-tint-green-line bg-white/80 text-tint-green-ink hover:bg-tint-green-line/30',
  amber: 'border-tint-amber-line bg-white/80 text-tint-amber-ink hover:bg-tint-amber/70',
} as const;

const OVERFLOW_CLASSNAMES = {
  leather:
    'border-leather/40 bg-leather/15 text-leather hover:bg-leather/25',
  emerald:
    'border-tint-green-line bg-tint-green-line/40 text-tint-green-ink hover:bg-tint-green-line/55',
  amber: 'border-tint-amber-line bg-tint-amber text-tint-amber-ink hover:bg-tint-amber/80',
} as const;

export interface DeskMapDocumentChipsProps {
  node: Pick<OwnershipNode, 'id' | 'attachments' | 'docNo'>;
  tone?: 'leather' | 'emerald' | 'amber';
  /** Default 4 per the Phase 5 design doc. */
  maxVisible?: number;
  onViewDoc: (docId: string) => void;
}

export default function DeskMapDocumentChips({
  node,
  tone = 'leather',
  maxVisible = 4,
  onViewDoc,
}: DeskMapDocumentChipsProps) {
  const [expanded, setExpanded] = useState(false);

  if (node.attachments.length === 0) return null;

  const total = node.attachments.length;
  const showAll = expanded || total <= maxVisible;
  const visible = showAll ? node.attachments : node.attachments.slice(0, maxVisible);
  const overflowCount = showAll ? 0 : total - visible.length;
  const chipClass = TONE_CLASSNAMES[tone];
  const overflowClass = OVERFLOW_CLASSNAMES[tone];

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {visible.map((attachment) => {
        const label = getAttachmentChipLabel(attachment, node);
        return (
          <button
            key={attachment.attachmentId}
            type="button"
            data-attachment-id={attachment.attachmentId}
            data-doc-id={attachment.docId}
            data-document-kind={attachment.kind}
            onClick={(event) => {
              event.stopPropagation();
              onViewDoc(attachment.docId);
            }}
            className={`group inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors ${chipClass}`}
            title={`View document: ${label}`}
          >
            <span className="shrink-0 uppercase tracking-wider">PDF</span>
            <span className="truncate">{label}</span>
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center gap-0.5 rounded-sm border border-current/40 px-1 uppercase tracking-wider opacity-80 group-hover:opacity-100"
            >
              {/* eye icon */}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View
            </span>
          </button>
        );
      })}
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(true);
          }}
          className={`inline-flex items-center rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors ${overflowClass}`}
          title={`Show ${overflowCount} more attached PDF${overflowCount === 1 ? '' : 's'}`}
        >
          +{overflowCount} more
        </button>
      )}
      {expanded && total > maxVisible && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}
          className={`inline-flex items-center rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors ${overflowClass}`}
          title="Collapse the attachment list"
        >
          show fewer
        </button>
      )}
    </div>
  );
}
