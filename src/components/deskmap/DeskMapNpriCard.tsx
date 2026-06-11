import { memo } from 'react';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import { useWorkspaceStore } from '../../store/workspace-store';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { OwnershipNode } from '../../types/node';
import type { NpriBranchDiscrepancy } from '../../engine/math-engine';
import DeskMapDocumentChips from './DeskMapDocumentChips';
import { FormulaTooltip } from '../leasehold/FormulaTooltip';
import {
  npriDiscrepancyFormula,
  npriInitialFractionFormula,
  remainingFractionFormula,
} from './deskmap-formulas';

interface DeskMapNpriCardProps {
  node: OwnershipNode;
  relatedDocs: OwnershipNode[];
  discrepancy?: NpriBranchDiscrepancy | null;
  onEdit: (nodeId: string) => void;
  onConvey: (nodeId: string) => void;
  onPrecede: (nodeId: string) => void;
  onAttachDoc: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onViewDoc: (docId: string) => void;
  readOnly?: boolean;
}

function DeskMapNpriCard({
  node,
  relatedDocs,
  discrepancy = null,
  onEdit,
  onConvey,
  onPrecede,
  onAttachDoc,
  onDelete,
  onViewDoc,
  readOnly = false,
}: DeskMapNpriCardProps) {
  const isActive = useWorkspaceStore((state) => state.activeNodeId === node.id);
  const remaining = d(node.fraction);
  const initial = d(node.initialFraction);
  const hasConveyedSome = initial.greaterThan(0) && remaining.lessThan(initial);
  const isFloating = node.royaltyKind === 'floating';
  const hasDiscrepancy = Boolean(discrepancy);
  const discrepancyLabel =
    discrepancy?.kind === 'floating_over_royalty'
      ? 'Floating NPRIs exceed royalty'
      : discrepancy?.kind === 'fixed_branch_over_branch'
        ? 'Fixed NPRIs exceed branch'
        : 'Whole-tract NPRIs exceed branch';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          group w-[208px] rounded-[10px] border transition-all
          ${hasDiscrepancy ? 'hover:border-seal' : 'hover:border-tint-amber-ink/60 hover:shadow-[0_4px_12px_rgba(45,33,20,0.11)]'}
          ${
            hasDiscrepancy
              ? 'border-seal ring-2 ring-seal/20 shadow-[0_10px_24px_rgba(127,29,29,0.20)]'
              : isActive
              ? 'border-tint-amber-ink shadow-[0_0_0_3px_var(--color-parchment-dark),0_2px_8px_rgba(45,33,20,0.07)]'
              : 'border-tint-amber-line shadow-[0_2px_8px_rgba(45,33,20,0.07)]'
          }
          ${hasDiscrepancy ? 'bg-seal/5 text-ink' : 'bg-tint-amber text-ink'}
          ${readOnly ? 'cursor-default' : 'cursor-pointer'}
        `}
        aria-disabled={readOnly}
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
        onClick={() => {
          if (!readOnly) onEdit(node.id);
        }}
      >
        <div className={`rounded-t-[9px] border-b px-[9px] py-[5px] ${
          hasDiscrepancy
            ? 'border-seal/20 bg-seal/10'
            : 'border-tint-amber-line bg-[#f4e6c2]/80'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[8.5px] font-bold uppercase tracking-wide text-tint-amber-ink">
              {node.instrument || 'Royalty Deed'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-amber-300 bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950">
                NPRI
              </span>
              <span className="rounded-full border border-amber-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
                {isFloating ? 'Floating' : 'Fixed'}
              </span>
              {!isFloating && (
                <span className="rounded border border-amber-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
                  {node.fixedRoyaltyBasis === 'whole_tract' ? 'Whole tract' : 'Branch'}
                </span>
              )}
              {hasDiscrepancy && (
                <span className="rounded-full border border-seal/25 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-seal">
                  Review
                </span>
              )}
            </div>
          </div>
          {(node.date || node.fileDate || node.docNo) && (
            <div className="mt-0.5 font-mono text-[9px] text-tint-amber-ink/80">
              {[node.date || node.fileDate, node.docNo ? `Doc# ${node.docNo}` : '']
                .filter(Boolean)
                .join(' • ')}
            </div>
          )}
        </div>

        <div className="space-y-1 px-[9px] py-[7px]">
          <div className="truncate text-[9px] text-tint-amber-ink/90">
            From: {node.grantor || 'Unknown grantor'}
          </div>
          <div className="truncate font-display text-[12.5px] font-bold leading-snug text-ink">
            {node.grantee || 'NPRI holder on file'}
          </div>
          {node.remarks && (
            <div className="line-clamp-2 text-[9.5px] text-tint-amber-ink/90">
              {node.remarks}
            </div>
          )}
          <DeskMapDocumentChips node={node} tone="amber" onViewDoc={onViewDoc} />
          {hasDiscrepancy && discrepancy && (
            <div className="rounded-md border border-seal/25 bg-seal/10 px-2 py-1.5 text-[10px] leading-4 text-seal">
              <div className="font-semibold">{discrepancyLabel}</div>
              <div>
                Total{' '}
                <FormulaTooltip content={npriDiscrepancyFormula(discrepancy)}>
                  {formatAsFraction(d(discrepancy.totalBurden))}
                </FormulaTooltip>
                ; capacity{' '}
                <FormulaTooltip content={npriDiscrepancyFormula(discrepancy)}>
                  {formatAsFraction(d(discrepancy.capacity))}
                </FormulaTooltip>
                ; over by{' '}
                <FormulaTooltip content={npriDiscrepancyFormula(discrepancy)}>
                  {formatAsFraction(d(discrepancy.excess))}
                </FormulaTooltip>
                .
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-[3px] border-t border-tint-amber-line px-[9px] py-[7px]">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-tint-amber-ink">
              {isFloating
                ? 'Of Lease Royalty'
                : node.fixedRoyaltyBasis === 'whole_tract'
                  ? 'Of Whole Tract'
                  : 'Of Burdened Branch'}
            </span>
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-ink">
              <FormulaTooltip content={npriInitialFractionFormula(node)}>
                {formatAsFraction(initial)}
              </FormulaTooltip>
            </span>
          </div>
          {hasConveyedSome && (
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-tint-amber-ink">
                Remaining
              </span>
              <span className="font-mono text-[11.5px] font-semibold tabular-nums text-tint-amber-ink">
                <FormulaTooltip content={remainingFractionFormula(node)}>
                  {formatAsFraction(remaining)}
                </FormulaTooltip>
              </span>
            </div>
          )}
        </div>

        {relatedDocs.length > 0 && (
          <div className="space-y-1 border-t border-tint-amber-line px-2 py-1.5">
            {relatedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-colors border-amber-300/60 bg-white/70 hover:bg-white"
                aria-disabled={readOnly}
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!readOnly) onEdit(doc.id);
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
                <DeskMapDocumentChips node={doc} tone="amber" onViewDoc={onViewDoc} />
              </div>
            ))}
          </div>
        )}

        <div className="hidden gap-0.5 rounded-b-[9px] border-t border-tint-amber-line bg-white/70 px-2 py-[4px] group-hover:flex">
          <ActionBtn label="Precede" disabled={readOnly} onClick={() => onPrecede(node.id)} />
          <ActionBtn label="Convey" disabled={readOnly} onClick={() => onConvey(node.id)} />
          <ActionBtn label="Attach" disabled={readOnly} onClick={() => onAttachDoc(node.id)} />
          <span className="ml-auto">
            <ActionBtn label="Delete" danger disabled={readOnly} onClick={() => onDelete(node.id)} />
          </span>
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
      className={`rounded-[5px] px-[5px] py-[3px] text-[8px] font-bold uppercase tracking-[0.05em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-seal hover:bg-[#f7e9e4]'
          : 'text-tint-amber-ink hover:bg-[#f4e6c2]'
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
    previous.discrepancy === next.discrepancy &&
    previous.onEdit === next.onEdit &&
    previous.onConvey === next.onConvey &&
    previous.onPrecede === next.onPrecede &&
    previous.onAttachDoc === next.onAttachDoc &&
    previous.onDelete === next.onDelete &&
    previous.onViewDoc === next.onViewDoc &&
    previous.readOnly === next.readOnly
  );
}

export default memo(DeskMapNpriCard, deskMapNpriCardPropsAreEqual);
