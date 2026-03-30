import { memo } from 'react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode } from '../../types/node';

interface DeskMapNpriCardProps {
  node: OwnershipNode;
  relatedDocs: OwnershipNode[];
  onEdit: (nodeId: string) => void;
  onConvey: (nodeId: string) => void;
  onPrecede: (nodeId: string) => void;
  onAttachDoc: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewPdf: (nodeId: string) => void;
}

function DeskMapNpriCard({
  node,
  relatedDocs,
  onEdit,
  onConvey,
  onPrecede,
  onAttachDoc,
  onDelete,
  onViewPdf,
}: DeskMapNpriCardProps) {
  const isActive = useWorkspaceStore((state) => state.activeNodeId === node.id);
  const remaining = d(node.fraction);
  const initial = d(node.initialFraction);
  const hasConveyedSome = initial.greaterThan(0) && remaining.lessThan(initial);
  const isFloating = node.royaltyKind === 'floating';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          group w-72 rounded-lg border-2 shadow-md cursor-pointer transition-all
          hover:shadow-lg hover:border-amber-500
          ${
            isActive
              ? 'border-amber-600 ring-2 ring-amber-200'
              : 'border-amber-200 shadow-[0_8px_18px_rgba(217,119,6,0.14)]'
          }
          bg-amber-50 text-ink
        `}
        onClick={() => onEdit(node.id)}
      >
        <div className="px-3 py-1.5 border-b border-amber-200 rounded-t-lg bg-amber-100/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-amber-900 uppercase tracking-wide truncate">
              {node.instrument || 'Royalty Deed'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-amber-300 bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950">
                NPRI
              </span>
              <span className="rounded-full border border-amber-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
                {isFloating ? 'Floating' : 'Fixed'}
              </span>
            </div>
          </div>
          {(node.date || node.fileDate || node.docNo) && (
            <div className="mt-0.5 text-[9px] text-amber-900/75 font-mono">
              {[node.date || node.fileDate, node.docNo ? `Doc# ${node.docNo}` : '']
                .filter(Boolean)
                .join(' • ')}
            </div>
          )}
        </div>

        <div className="px-3 py-2 space-y-1.5">
          <div className="text-[10px] text-amber-900/75 truncate">
            From: {node.grantor || 'Unknown grantor'}
          </div>
          <div className="text-sm font-bold font-display text-amber-950 truncate">
            {node.grantee || 'NPRI holder on file'}
          </div>
          {node.remarks && (
            <div className="text-[10px] text-amber-900/75 line-clamp-2">
              {node.remarks}
            </div>
          )}
          {node.hasDoc && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewPdf(node.id);
              }}
              className="text-[9px] text-amber-800 font-semibold hover:underline"
            >
              View PDF
            </button>
          )}
        </div>

        <div className="px-3 py-2 border-t border-amber-200 bg-amber-100/40 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-amber-900/75 text-[10px] uppercase tracking-wider shrink-0">
              {isFloating ? 'Of Lease Royalty' : 'Fixed Royalty'}
            </span>
            <span className="text-sm font-mono font-semibold text-amber-950">
              {formatAsFraction(initial)}
            </span>
          </div>
          {hasConveyedSome && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-amber-900/75 text-[10px] uppercase tracking-wider shrink-0">
                Remaining
              </span>
              <span className="text-sm font-mono font-semibold text-amber-900">
                {formatAsFraction(remaining)}
              </span>
            </div>
          )}
        </div>

        {relatedDocs.length > 0 && (
          <div className="px-2 py-1.5 border-t border-amber-200 space-y-1">
            {relatedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors border-amber-300/60 bg-white/70 hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(doc.id);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-wider truncate text-amber-900">
                    {doc.instrument || 'Related Doc'}
                  </div>
                  {(doc.date || doc.fileDate) && (
                    <div className="text-[8px] text-amber-900/75 font-mono">
                      {doc.date || doc.fileDate}
                    </div>
                  )}
                  {doc.remarks && (
                    <div className="text-[9px] text-amber-900/75 truncate">{doc.remarks}</div>
                  )}
                </div>
                {doc.hasDoc && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewPdf(doc.id);
                    }}
                    className="text-[9px] text-amber-800 font-bold hover:bg-amber-100 px-1.5 py-0.5 rounded shrink-0"
                  >
                    PDF
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="hidden group-hover:flex px-2 py-1.5 border-t border-amber-200 bg-amber-100/70 rounded-b-lg gap-1 justify-center">
          <ActionBtn label="PRECEDE" onClick={() => onPrecede(node.id)} />
          <ActionBtn label="CONVEY" onClick={() => onConvey(node.id)} />
          <ActionBtn label="ATTACH" onClick={() => onAttachDoc(node.id)} />
          <ActionBtn label="DELETE" danger onClick={() => onDelete(node.id)} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors ${
        danger
          ? 'text-seal hover:bg-seal/10'
          : 'text-amber-900 hover:bg-amber-200/60'
      }`}
    >
      {label}
    </button>
  );
}

function deskMapNpriCardPropsAreEqual(
  previous: DeskMapNpriCardProps,
  next: DeskMapNpriCardProps
): boolean {
  return (
    previous.node === next.node &&
    previous.relatedDocs === next.relatedDocs &&
    previous.onEdit === next.onEdit &&
    previous.onConvey === next.onConvey &&
    previous.onPrecede === next.onPrecede &&
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewPdf === next.onViewPdf
  );
}

export default memo(DeskMapNpriCard, deskMapNpriCardPropsAreEqual);
