import type { OwnershipNode } from '../../types/node';

export function getDeskMapDocumentLabel(
  node: Pick<OwnershipNode, 'hasDoc' | 'docFileName' | 'docNo'>
): string | null {
  if (!node.hasDoc) return null;
  if (node.docFileName) return node.docFileName;
  if (node.docNo) return `${node.docNo}.pdf`;
  return 'PDF attached';
}

export default function DeskMapDocumentBadge({
  node,
  tone = 'leather',
  onViewPdf,
}: {
  node: Pick<OwnershipNode, 'id' | 'hasDoc' | 'docFileName' | 'docNo'>;
  tone?: 'leather' | 'emerald' | 'amber';
  onViewPdf: (nodeId: string) => void;
}) {
  const label = getDeskMapDocumentLabel(node);
  if (!label) return null;

  const toneClassName =
    tone === 'emerald'
      ? 'border-emerald-300 bg-white/80 text-emerald-900 hover:bg-emerald-100'
      : tone === 'amber'
        ? 'border-amber-300 bg-white/80 text-amber-900 hover:bg-amber-100'
        : 'border-leather/25 bg-leather/5 text-leather hover:bg-leather/10';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onViewPdf(node.id);
      }}
      className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors ${toneClassName}`}
      title={`View attached PDF: ${label}`}
    >
      <span className="shrink-0 uppercase tracking-wider">PDF</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
