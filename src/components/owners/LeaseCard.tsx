/** Expandable lease summary card. */
import { useState } from 'react';
import type { Lease } from '../../types/owner';
import { LEASE_TYPE_OPTIONS, PROVISION_OPTIONS, ATTACHMENT_OPTIONS } from '../../types/owner';

interface Props {
  lease: Lease;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
}

export default function LeaseCard({ lease, onEdit, onDelete, onGenerate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = LEASE_TYPE_OPTIONS.find((t) => t.value === lease.leaseType)?.label ?? lease.leaseType;

  const handleDelete = () => {
    if (confirm('Delete this lease record?')) onDelete();
  };

  return (
    <div className="bg-ledger rounded-xl border border-ledger-line overflow-hidden">
      {/* Summary row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-parchment-dark/30 transition-colors cursor-pointer"
      >
        <span className="text-ink-light text-xs shrink-0">{expanded ? '\u25BC' : '\u25B6'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">Tract {lease.tractNo || '\u2014'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-leather/10 text-leather">{typeLabel}</span>
          </div>
          <div className="text-xs text-ink-light truncate mt-0.5">
            {lease.grossAcres ? `${lease.grossAcres} gross ac` : ''}
            {lease.netAcres ? ` / ${lease.netAcres} net ac` : ''}
            {lease.royaltyRate ? ` \u00B7 ${lease.royaltyRate} royalty` : ''}
            {lease.leaseDate ? ` \u00B7 ${lease.leaseDate}` : ''}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            className="px-2 py-1 rounded text-[10px] font-semibold text-gold hover:bg-gold/10 transition-colors"
            title="Generate Producers 88 Lease"
          >
            P-88
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="px-2 py-1 rounded text-[10px] font-semibold text-leather hover:bg-leather/10 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="px-2 py-1 rounded text-[10px] text-seal hover:bg-seal/10 transition-colors"
          >
            Del
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-ledger-line/50 space-y-3">
          <DetailGrid>
            <DItem label="Lease Form" value={lease.leaseForm} />
            <DItem label="Lessee" value={lease.lessee} />
            <DItem label="Lease Date" value={lease.leaseDate} />
            <DItem label="Effective" value={lease.effectiveDate} />
            <DItem label="Expiration" value={lease.expirationDate} />
            <DItem label="Primary Term" value={lease.primaryTerm} />
            <DItem label="Royalty" value={lease.royaltyRate} />
            <DItem label="Bonus/Ac" value={lease.bonusPerAcre} />
            <DItem label="Rental/Ac" value={lease.rentalPerAcre} />
            <DItem label="Paid Up" value={lease.paidUp ? 'Yes' : 'No'} />
            <DItem label="Total Bonus" value={lease.totalBonus} />
            <DItem label="Total Check" value={lease.totalCheck} />
            <DItem label="Lessor Int." value={lease.lessorInterest} />
            <DItem label="Gross Ac" value={lease.grossAcres} />
            <DItem label="Net Ac" value={lease.netAcres} />
            <DItem label="Prepared By" value={lease.preparedBy} />
          </DetailGrid>

          {lease.briefDescription && (
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-wider">Description</span>
              <p className="text-xs text-ink mt-0.5">{lease.briefDescription}</p>
            </div>
          )}

          {lease.legalDescription && (
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-wider">Legal Description</span>
              <p className="text-xs text-ink mt-0.5 whitespace-pre-wrap">{lease.legalDescription}</p>
            </div>
          )}

          {lease.provisions.length > 0 && (
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-wider">Provisions</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {lease.provisions.map((key) => {
                  const prov = PROVISION_OPTIONS.find((p) => p.key === key);
                  return (
                    <span key={key} className="px-2 py-0.5 rounded-full text-[10px] bg-gold/15 text-ink-light font-medium">
                      {prov?.label ?? key}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {lease.attachments.length > 0 && (
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-wider">Attachments on File</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {lease.attachments.map((key) => {
                  const att = ATTACHMENT_OPTIONS.find((a) => a.key === key);
                  return (
                    <span key={key} className="px-2 py-0.5 rounded-full text-[10px] bg-leather/10 text-leather font-medium">
                      {att?.label ?? key}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {lease.comments && (
            <div>
              <span className="text-[10px] text-ink-light uppercase tracking-wider">Comments</span>
              <p className="text-xs text-ink mt-0.5 whitespace-pre-wrap">{lease.comments}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">{children}</div>;
}

function DItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-ink-light/60 block">{label}</span>
      <span className="text-xs text-ink font-medium">{value || '\u2014'}</span>
    </div>
  );
}
