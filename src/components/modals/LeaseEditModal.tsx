/** Full lease form modal — all LPR fields, provisions checklist, attachments checklist. */
import { useState } from 'react';
import Modal from '../shared/Modal';
import type { Lease, LeaseType } from '../../types/owner';
import {
  LEASE_TYPE_OPTIONS,
  PROVISION_OPTIONS,
  ATTACHMENT_OPTIONS,
} from '../../types/owner';

interface Props {
  lease: Lease;
  onSave: (fields: Partial<Lease>) => void;
  onClose: () => void;
}

export default function LeaseEditModal({ lease, onSave, onClose }: Props) {
  const [form, setForm] = useState({ ...lease });

  const set = (field: keyof Lease, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const toggleProvision = (key: string) => {
    setForm((f) => ({
      ...f,
      provisions: f.provisions.includes(key)
        ? f.provisions.filter((p) => p !== key)
        : [...f.provisions, key],
    }));
  };

  const toggleAttachment = (key: string) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.includes(key)
        ? f.attachments.filter((a) => a !== key)
        : [...f.attachments, key],
    }));
  };

  const handleSave = () => {
    const { id, ownerId, createdAt, updatedAt, ...fields } = form;
    onSave(fields);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={lease.tractNo ? `Lease \u2014 Tract ${lease.tractNo}` : 'New Lease'} wide>
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Lease Info */}
        <FieldSection title="Lease Information">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Lease Type</Label>
              <select
                value={form.leaseType}
                onChange={(e) => set('leaseType', e.target.value as LeaseType)}
                className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
              >
                {LEASE_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Input label="Lease Form" value={form.leaseForm} onChange={(v) => set('leaseForm', v)} className="col-span-2" />
            <Input label="Lessee" value={form.lessee} onChange={(v) => set('lessee', v)} className="col-span-3" />
            <Input label="Lessee Address" value={form.lesseeAddress} onChange={(v) => set('lesseeAddress', v)} className="col-span-3" placeholder="e.g. 3811 Turtle Creek Blvd., Suite 1900, Dallas, TX 75219" />
          </div>
        </FieldSection>

        {/* Dates */}
        <FieldSection title="Dates">
          <div className="grid grid-cols-4 gap-3">
            <Input label="Lease Date" value={form.leaseDate} onChange={(v) => set('leaseDate', v)} type="date" />
            <Input label="Effective Date" value={form.effectiveDate} onChange={(v) => set('effectiveDate', v)} type="date" />
            <Input label="Expiration Date" value={form.expirationDate} onChange={(v) => set('expirationDate', v)} type="date" />
            <Input label="Primary Term" value={form.primaryTerm} onChange={(v) => set('primaryTerm', v)} placeholder="e.g. 3 years" />
            <Input label="Term (as written on lease)" value={form.primaryTermWritten} onChange={(v) => set('primaryTermWritten', v)} placeholder='e.g. three (3) years' className="col-span-2" />
          </div>
        </FieldSection>

        {/* Financial */}
        <FieldSection title="Financial Terms">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Royalty Rate" value={form.royaltyRate} onChange={(v) => set('royaltyRate', v)} placeholder="e.g. 3/16" />
            <Input label="Royalty (as written on lease)" value={form.royaltyWritten} onChange={(v) => set('royaltyWritten', v)} placeholder='e.g. three sixteenths (3/16)' className="col-span-2" />
            <Input label="Bonus / Acre" value={form.bonusPerAcre} onChange={(v) => set('bonusPerAcre', v)} placeholder="$" />
            <Input label="Rental / Acre" value={form.rentalPerAcre} onChange={(v) => set('rentalPerAcre', v)} placeholder="$" />
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.paidUp}
                onChange={(e) => set('paidUp', e.target.checked)}
                className="rounded border-ledger-line text-leather focus:ring-leather"
              />
              Paid Up
            </label>
            <Input label="Total Bonus" value={form.totalBonus} onChange={(v) => set('totalBonus', v)} placeholder="$" />
            <Input label="Total Check(s)" value={form.totalCheck} onChange={(v) => set('totalCheck', v)} placeholder="$" />
          </div>
        </FieldSection>

        {/* Land */}
        <FieldSection title="Land Description">
          <div className="grid grid-cols-4 gap-3">
            <Input label="Tract No." value={form.tractNo} onChange={(v) => set('tractNo', v)} />
            <Input label="Lessor Interest" value={form.lessorInterest} onChange={(v) => set('lessorInterest', v)} placeholder="e.g. 0.5" />
            <Input label="Gross Acres" value={form.grossAcres} onChange={(v) => set('grossAcres', v)} />
            <Input label="Net Acres" value={form.netAcres} onChange={(v) => set('netAcres', v)} />
          </div>
          <div className="mt-3">
            <Label>Brief Description</Label>
            <textarea
              value={form.briefDescription}
              onChange={(e) => set('briefDescription', e.target.value)}
              rows={2}
              placeholder="e.g. 106.19 acres, Vital Flores Survey, A-14, San Jacinto County, TX"
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
          <div className="mt-3">
            <Label>Full Legal Description</Label>
            <textarea
              value={form.legalDescription}
              onChange={(e) => set('legalDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
        </FieldSection>

        {/* Provisions checklist */}
        <FieldSection title="Significant Provisions">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {PROVISION_OPTIONS.map((prov) => (
              <label key={prov.key} className="flex items-center gap-2 text-xs text-ink cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={form.provisions.includes(prov.key)}
                  onChange={() => toggleProvision(prov.key)}
                  className="rounded border-ledger-line text-leather focus:ring-leather h-3.5 w-3.5"
                />
                {prov.label}
              </label>
            ))}
          </div>
          <div className="mt-2">
            <Label>Provision Notes</Label>
            <textarea
              value={form.provisionNotes}
              onChange={(e) => set('provisionNotes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
        </FieldSection>

        {/* Attachments checklist */}
        <FieldSection title="Attachments on File">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {ATTACHMENT_OPTIONS.map((att) => (
              <label key={att.key} className="flex items-center gap-2 text-xs text-ink cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={form.attachments.includes(att.key)}
                  onChange={() => toggleAttachment(att.key)}
                  className="rounded border-ledger-line text-leather focus:ring-leather h-3.5 w-3.5"
                />
                {att.label}
              </label>
            ))}
          </div>
        </FieldSection>

        {/* Comments & Prep */}
        <FieldSection title="Notes">
          <textarea
            value={form.comments}
            onChange={(e) => set('comments', e.target.value)}
            rows={3}
            placeholder="Comments..."
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input label="Prepared By" value={form.preparedBy} onChange={(v) => set('preparedBy', v)} />
            <Input label="Date Prepared" value={form.datePrepared} onChange={(v) => set('datePrepared', v)} type="date" />
          </div>
        </FieldSection>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-ledger-line">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors">
          Save Lease
        </button>
      </div>
    </Modal>
  );
}

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">{children}</label>;
}

function Input({ label, value, onChange, type = 'text', placeholder, className = '' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      />
    </div>
  );
}
