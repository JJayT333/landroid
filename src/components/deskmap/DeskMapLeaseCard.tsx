import { memo } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { OwnershipNode } from '../../types/node';
import DeskMapDocumentChips from './DeskMapDocumentChips';

interface DeskMapLeaseCardProps {
  node: OwnershipNode;
  onEdit: (nodeId: string) => void;
  onViewDoc: (docId: string) => void;
  readOnly?: boolean;
}

function DeskMapLeaseCard({
  node,
  onEdit,
  onViewDoc,
  readOnly = false,
}: DeskMapLeaseCardProps) {
  const isActive = useWorkspaceStore((state) => state.activeNodeId === node.id);
  const termChips = node.remarks
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          group w-[208px] rounded-[10px] border transition-all
          hover:border-tint-green-ink/60 hover:shadow-[0_4px_12px_rgba(45,33,20,0.11)]
          ${
            isActive
              ? 'border-tint-green-ink shadow-[0_0_0_3px_var(--color-parchment-dark),0_2px_8px_rgba(45,33,20,0.07)]'
              : 'border-tint-green-line shadow-[0_2px_8px_rgba(45,33,20,0.07)]'
          }
          bg-emerald-50 text-ink
          ${readOnly ? 'cursor-default' : 'cursor-pointer'}
        `}
        aria-disabled={readOnly}
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
        onClick={() => {
          if (!readOnly) onEdit(node.id);
        }}
      >
        <div className="rounded-t-[9px] border-b border-tint-green-line bg-emerald-100 px-[9px] py-[5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[8.5px] font-bold uppercase tracking-wide text-tint-green-ink">
              {node.instrument || 'Lease'}
            </span>
            <span className="rounded-[5px] bg-[#a7e8c4] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-emerald-950">
              Lessee
            </span>
          </div>
          {(node.date || node.fileDate || node.docNo) && (
            <div className="mt-0.5 font-mono text-[9px] text-tint-green-ink/80">
              {[node.date || node.fileDate, node.docNo ? `Doc# ${node.docNo}` : '']
                .filter(Boolean)
                .join(' • ')}
            </div>
          )}
        </div>

        <div className="space-y-1 px-[9px] py-[7px]">
          <div className="truncate text-[9px] text-tint-green-ink/90">
            Lessor: {node.grantor || 'Unknown lessor'}
          </div>
          <div className="truncate font-display text-[12.5px] font-bold leading-snug text-ink">
            {node.grantee || 'Lessee on file'}
          </div>
          {termChips.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {termChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-[5px] border border-tint-green-line bg-white px-1.5 py-0.5 text-[8.5px] text-tint-green-ink"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <DeskMapDocumentChips node={node} tone="emerald" onViewDoc={onViewDoc} />
        </div>

      </div>
    </div>
  );
}


function deskMapLeaseCardPropsAreEqual(
  previous: DeskMapLeaseCardProps,
  next: DeskMapLeaseCardProps
): boolean {
  return (
    previous.node === next.node &&
    previous.onEdit === next.onEdit &&
    previous.onViewDoc === next.onViewDoc &&
    previous.readOnly === next.readOnly
  );
}

export default memo(DeskMapLeaseCard, deskMapLeaseCardPropsAreEqual);
