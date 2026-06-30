/**
 * Lease Abstract Report (LPR Phase 3) — a printable, examiner/attorney-facing
 * rendering of one Lease Purchase Report. Mirrors the on-form B_LPR_01 abstract:
 * instrument header, economics, per-tract slices, significant provisions,
 * attachments, legal description, comments, and preparer.
 *
 * Display-only: nothing here enters ownership/royalty/NRI math (the economics
 * totals are computed for reference, never persisted or fed to a calculator).
 * Print isolation mirrors AuditSheetModal — a scoped `@media print` block hides
 * everything except the report subtree.
 */
import type { ReactNode } from 'react';
import {
  LEASE_ATTACHMENT_DEFINITIONS,
  LEASE_PROVISION_DEFINITIONS,
  LEASE_TYPE_OPTIONS,
  getProvision,
  hasAttachment,
  type LeaseEconomicsTotals,
  type LeasePurchaseReport,
} from '../../types/lease-purchase-report';

/** One materialized per-tract lease slice, pre-formatted by the caller. */
export interface LeaseAbstractReportSlice {
  tractName: string;
  lessorInterest: string;
  grossAcres: string;
  netAcres: string;
}

export interface LeaseAbstractReportModalProps {
  lpr: LeasePurchaseReport;
  /** Lessor display name, resolved from the linked owner record. */
  lessorName: string;
  slices: LeaseAbstractReportSlice[];
  economicsTotals: LeaseEconomicsTotals;
  projectName: string;
  /** Human-readable timestamp for the report header. */
  generatedAt: string;
  onClose: () => void;
}

function leaseTypeLabel(value: string): string {
  return LEASE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="break-inside-avoid">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </div>
      <div className="text-[12px] text-ink">{value.trim() === '' ? '—' : value}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-5 border-b border-ledger-line/60 pb-1 font-display text-[14px] font-bold text-ink">
      {children}
    </h3>
  );
}

export default function LeaseAbstractReportModal({
  lpr,
  lessorName,
  slices,
  economicsTotals,
  projectName,
  generatedAt,
  onClose,
}: LeaseAbstractReportModalProps) {
  const flaggedProvisions = LEASE_PROVISION_DEFINITIONS.map((definition) => ({
    definition,
    provision: getProvision(lpr.provisions, definition.key),
  })).filter(
    (row) => row.provision.present || row.provision.paragraph.trim() !== ''
  );
  const presentAttachments = LEASE_ATTACHMENT_DEFINITIONS.filter((definition) =>
    hasAttachment(lpr.attachments, definition.key)
  );

  return (
    <div className="fixed inset-0 z-[200] overflow-auto bg-parchment">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ledger-line bg-parchment-light px-5 py-3 print:hidden">
        <div>
          <h2 className="font-display text-[17px] font-bold leading-tight text-ink">
            Lease Abstract Report
          </h2>
          <div className="text-[11px] text-ink-light">
            {lessorName || 'Lessor'} → {lpr.lesseeName || 'Lessee'} · abstract for review
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-leather bg-leather px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-leather/90"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10"
          >
            Close
          </button>
        </div>
      </div>

      <div className="lease-abstract-print-root mx-auto max-w-3xl px-8 py-6 text-ink">
        <header className="mb-4 border-b border-ledger-line pb-3">
          <div className="font-display text-xl font-bold">{projectName || 'LANDroid'}</div>
          <div className="text-sm font-semibold text-ink">Lease Purchase Report — Abstract</div>
          <div className="text-[11px] text-ink-light">Generated {generatedAt}</div>
        </header>

        <SectionHeading>Instrument</SectionHeading>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Field label="Lessor" value={lessorName} />
          <Field label="Lessee" value={lpr.lesseeName} />
          <Field label="Lease Type" value={leaseTypeLabel(lpr.leaseType)} />
          <Field label="Lease Form" value={lpr.leaseForm} />
          <Field label="Lease Date" value={lpr.leaseDate} />
          <Field label="Primary Term" value={lpr.primaryTerm} />
          <Field label="Effective Date" value={lpr.effectiveDate} />
          <Field label="Expiration Date" value={lpr.expirationDate} />
          <Field label="Held By Production" value={lpr.heldByProduction ? 'Yes' : 'No'} />
        </div>

        <SectionHeading>Economics</SectionHeading>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Field label="Royalty" value={lpr.royalty} />
          <Field label="Bonus / Acre" value={lpr.bonusPerAcre} />
          <Field label="Rental / Acre" value={lpr.rentalPerAcre} />
          <Field label="Paid Up" value={lpr.paidUp ? 'Yes' : 'No'} />
          <Field label="Total Bonus" value={economicsTotals.totalBonus} />
          <Field
            label="Delay Rental"
            value={lpr.paidUp ? 'Paid up' : economicsTotals.totalDelayRental}
          />
        </div>
        <div className="mt-1 text-[10px] italic text-ink-light">
          Economics are reference-only and do not enter ownership, royalty, or NRI math.
        </div>

        {slices.length > 0 && (
          <>
            <SectionHeading>Tracts</SectionHeading>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-ledger-line text-left text-ink-light">
                  <th className="py-1 pr-3 font-semibold">Tract</th>
                  <th className="py-1 pr-3 font-semibold">Lessor Interest</th>
                  <th className="py-1 pr-3 font-semibold">Gross Acres</th>
                  <th className="py-1 font-semibold">Net Mineral Acres</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((slice, index) => (
                  <tr key={index} className="border-b border-ledger-line/40 break-inside-avoid">
                    <td className="py-1 pr-3 text-ink">{slice.tractName}</td>
                    <td className="py-1 pr-3 font-mono text-ink">{slice.lessorInterest || '—'}</td>
                    <td className="py-1 pr-3 font-mono text-ink">{slice.grossAcres || '—'}</td>
                    <td className="py-1 font-mono text-ink">{slice.netAcres || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <SectionHeading>Significant Provisions</SectionHeading>
        {flaggedProvisions.length === 0 ? (
          <div className="text-[11px] text-ink-light">None flagged.</div>
        ) : (
          <ul className="space-y-0.5 text-[11px]">
            {flaggedProvisions.map((row) => (
              <li key={row.definition.key} className="break-inside-avoid">
                <span className="text-ink">{row.definition.label}</span>
                {row.provision.paragraph.trim() !== '' && (
                  <span className="text-ink-light"> — ¶ {row.provision.paragraph}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <SectionHeading>Attachments</SectionHeading>
        {presentAttachments.length === 0 ? (
          <div className="text-[11px] text-ink-light">None.</div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 text-[11px]">
            {presentAttachments.map((definition) => (
              <li key={definition.key} className="text-ink">
                {definition.label}
              </li>
            ))}
          </ul>
        )}

        {lpr.legalDescription.trim() !== '' && (
          <>
            <SectionHeading>Legal Description</SectionHeading>
            <div className="whitespace-pre-wrap text-[11px] text-ink">{lpr.legalDescription}</div>
          </>
        )}

        {lpr.comments.trim() !== '' && (
          <>
            <SectionHeading>Comments</SectionHeading>
            <div className="whitespace-pre-wrap text-[11px] text-ink">{lpr.comments}</div>
          </>
        )}

        <div className="mt-6 flex justify-between border-t border-ledger-line pt-2 text-[10px] text-ink-light">
          <span>Prepared by: {lpr.preparedBy.trim() === '' ? '—' : lpr.preparedBy}</span>
          <span>{lpr.preparedDate.trim() === '' ? '' : `Date: ${lpr.preparedDate}`}</span>
        </div>
      </div>

      <style>{`@media print {
        body * { visibility: hidden !important; }
        .lease-abstract-print-root, .lease-abstract-print-root * { visibility: visible !important; }
        .lease-abstract-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0 4mm; }
        @page { margin: 14mm; }
      }`}</style>
    </div>
  );
}
