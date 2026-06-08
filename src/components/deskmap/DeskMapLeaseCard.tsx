import { memo } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { OwnershipNode } from '../../types/node';
import DeskMapDocumentChips from './DeskMapDocumentChips';

interface DeskMapLeaseCardProps {
  node: OwnershipNode;
  onEdit: (nodeId: string) => void;
  onAttachDoc: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewDoc: (docId: string) => void;
  readOnly?: boolean;
}

function DeskMapLeaseCard({
  node,
  onEdit,
  onAttachDoc,
  onDelete,
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
          group w-72 rounded-lg border-2 shadow-md cursor-pointer transition-all
          hover:shadow-lg hover:border-emerald-500
          ${
            isActive
              ? 'border-emerald-600 ring-2 ring-emerald-200'
              : 'border-emerald-200 shadow-[0_8px_18px_rgba(5,150,105,0.14)]'
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
        <div className="px-3 py-1.5 border-b border-emerald-200 rounded-t-lg bg-emerald-100/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wide truncate">
              {node.instrument || 'Lease'}
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-900">
              Lessee
            </span>
          </div>
          {(node.date || node.fileDate || node.docNo) && (
            <div className="mt-0.5 text-[9px] text-emerald-900/75 font-mono">
              {[node.date || node.fileDate, node.docNo ? `Doc# ${node.docNo}` : '']
                .filter(Boolean)
                .join(' • ')}
            </div>
          )}
        </div>

        <div className="px-3 py-2 space-y-1.5">
          <div className="text-[10px] text-emerald-900/75 truncate">
            Lessor: {node.grantor || 'Unknown lessor'}
          </div>
          <div className="text-sm font-bold font-display text-emerald-950 truncate">
            {node.grantee || 'Lessee on file'}
          </div>
          {termChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {termChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[9px] text-emerald-900/85"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <DeskMapDocumentChips node={node} tone="emerald" onViewDoc={onViewDoc} />
        </div>

        <div className="hidden group-hover:flex px-2 py-1.5 border-t border-emerald-200 bg-emerald-100/70 rounded-b-lg gap-1 justify-center">
          <ActionBtn label="ATTACH" disabled={readOnly} onClick={() => onAttachDoc(node.id)} />
          <ActionBtn label="DELETE" danger disabled={readOnly} onClick={() => onDelete(node.id)} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      title={disabled ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
      className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-seal hover:bg-seal/10'
          : 'text-emerald-900 hover:bg-emerald-200/60'
      }`}
    >
      {label}
    </button>
  );
}

function deskMapLeaseCardPropsAreEqual(
  previous: DeskMapLeaseCardProps,
  next: DeskMapLeaseCardProps
): boolean {
  return (
    previous.node === next.node &&
    previous.onEdit === next.onEdit &&
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewDoc === next.onViewDoc &&
    previous.readOnly === next.readOnly
  );
}

export default memo(DeskMapLeaseCard, deskMapLeaseCardPropsAreEqual);
