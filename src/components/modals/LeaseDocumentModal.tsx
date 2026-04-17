/**
 * Lease Document Modal — renders a structured BLM Form 3100-11 summary for a
 * federal lease record. Reuses the Modal chrome from `PdfViewerModal` but
 * substitutes a typed text layout for the iframe so the seeded Raven Forest
 * leases display without an actual PDF binary.
 *
 * The component is forward-compatible: callers may pass an optional `pdfUrl`
 * to render an iframe alongside (or instead of) the structured summary once
 * real PDFs are attached.
 */
import Modal from '../shared/Modal';
import {
  getFederalLeaseDocument,
  type FederalLeaseDocument,
} from '../../storage/federal-lease-seed';

interface LeaseDocumentModalProps {
  recordId: string;
  /** Optional override; if omitted, the registry lookup is used. */
  document?: FederalLeaseDocument | null;
  /** Forward-compat: a future PDF attachment URL. */
  pdfUrl?: string;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-light">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-ink">{value || '—'}</div>
    </div>
  );
}

export default function LeaseDocumentModal({
  recordId,
  document,
  pdfUrl,
  onClose,
}: LeaseDocumentModalProps) {
  const resolved = document ?? getFederalLeaseDocument(recordId);

  if (!resolved) {
    return (
      <Modal open onClose={onClose} title="Lease Document" wide>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          No structured lease document is registered for this record. Seed the
          combinatorial Raven Forest workspace to populate BLM Form 3100-11
          summaries, or attach a PDF in a future revision.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${resolved.form} — ${resolved.mlrsSerial}`}
      wide
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-leather/30 bg-leather/5 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-leather">
            United States Department of the Interior — Bureau of Land Management
          </div>
          <div className="mt-1 text-sm font-display font-bold text-ink">
            Offer to Lease and Lease for Oil and Gas (Form 3100-11)
          </div>
          <div className="mt-1 text-xs text-ink-light">
            Reference document only — does not feed Texas Desk Map, Leasehold,
            NPRI, ORRI, WI, payout, or ONRR math.
          </div>
        </div>

        <section className="rounded-lg border border-ledger-line bg-parchment p-3 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
            Identification
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="MLRS Serial" value={resolved.mlrsSerial} />
            <Field label="Legacy Serial" value={resolved.legacySerial} />
            <Field label="Lessee" value={resolved.lessee} />
            <Field label="Lease Status" value={resolved.status} />
          </div>
        </section>

        <section className="rounded-lg border border-ledger-line bg-parchment p-3 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
            Legal Description
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prospect" value={resolved.prospect} />
            <Field label="County" value={resolved.county} />
            <Field label="Survey" value={resolved.survey} />
            <Field label="Tract" value={resolved.tract} />
            <Field label="Acres" value={resolved.acres} />
            <Field label="Mineral %" value={resolved.mineralPercent} />
          </div>
        </section>

        <section className="rounded-lg border border-ledger-line bg-parchment p-3 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
            Term &amp; Consideration
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective Date" value={resolved.effectiveDate} />
            <Field label="Expiration Date" value={resolved.expirationDate} />
            <Field
              label="Primary Term"
              value={`${resolved.primaryTermYears} years`}
            />
            <Field label="Royalty" value={resolved.royaltyFraction} />
            <Field label="Bonus / Acre" value={resolved.bonusPerAcre} />
            <Field label="Rental / Acre" value={resolved.rentalPerAcre} />
          </div>
        </section>

        <section className="rounded-lg border border-ledger-line bg-parchment p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
            Stipulations
          </div>
          <ul className="flex flex-wrap gap-2">
            {resolved.stipulations.map((stip) => (
              <li
                key={stip}
                className="rounded-full border border-ledger-line bg-ledger px-2 py-0.5 text-xs font-semibold text-ink"
              >
                {stip}
              </li>
            ))}
          </ul>
        </section>

        {resolved.notes && (
          <section className="rounded-lg border border-ledger-line bg-parchment p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
              Notes
            </div>
            <p className="text-sm text-ink">{resolved.notes}</p>
          </section>
        )}

        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full rounded-lg border border-ledger-line"
            style={{ height: '60vh' }}
            title={`${resolved.mlrsSerial} attachment`}
          />
        )}
      </div>
    </Modal>
  );
}
