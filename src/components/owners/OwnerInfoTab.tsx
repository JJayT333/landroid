/** Owner contact info — read mode with inline edit toggle. */
import { useState } from 'react';
import type { Owner } from '../../types/owner';
import { useOwnerStore } from '../../store/owner-store';

interface Props {
  owner: Owner;
}

export default function OwnerInfoTab({ owner }: Props) {
  const updateOwner = useOwnerStore((s) => s.updateOwner);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...owner });

  const set = (field: keyof Owner, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = () => {
    const { id, createdAt, updatedAt, ...fields } = form;
    updateOwner(owner.id, fields);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...owner });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="p-5 space-y-5">
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
          >
            Edit Info
          </button>
        </div>

        <Section title="Contact Information">
          <Row label="Name" value={owner.name} />
          <Row label="Additional Lessors" value={owner.additionalLessors} />
          <Row label="Phone" value={owner.phone} />
          <Row label="Alt Phone" value={owner.altPhone} />
          <Row label="Email" value={owner.email} />
          <Row label="SSN" value={owner.ssn ? '\u2022\u2022\u2022-\u2022\u2022-' + owner.ssn.slice(-4) : ''} />
        </Section>

        <Section title="Address">
          <Row label="Street" value={owner.address} />
          <Row label="City" value={owner.city} />
          <Row label="State" value={owner.state} />
          <Row label="ZIP" value={owner.zip} />
        </Section>

        <Section title="Project">
          <Row label="Prospect" value={owner.prospect} />
          <Row label="County" value={owner.county} />
          <Row label="State (Land)" value={owner.stateJurisdiction} />
          <Row label="Assigned To" value={owner.assignedTo} />
        </Section>

        {owner.notes && (
          <Section title="Notes">
            <p className="text-sm text-ink whitespace-pre-wrap">{owner.notes}</p>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <FieldSection title="Contact Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Legal Name" value={form.name} onChange={(v) => set('name', v)} />
          <Field label="Additional Lessors" value={form.additionalLessors} onChange={(v) => set('additionalLessors', v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
          <Field label="Alt Phone" value={form.altPhone} onChange={(v) => set('altPhone', v)} />
          <Field label="Email" value={form.email} onChange={(v) => set('email', v)} />
          <Field label="SSN" value={form.ssn} onChange={(v) => set('ssn', v)} type="password" />
        </div>
      </FieldSection>

      <FieldSection title="Address">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Street" value={form.address} onChange={(v) => set('address', v)} className="col-span-2" />
          <Field label="City" value={form.city} onChange={(v) => set('city', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={form.state} onChange={(v) => set('state', v)} />
            <Field label="ZIP" value={form.zip} onChange={(v) => set('zip', v)} />
          </div>
        </div>
      </FieldSection>

      <FieldSection title="Project">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prospect" value={form.prospect} onChange={(v) => set('prospect', v)} />
          <Field label="County" value={form.county} onChange={(v) => set('county', v)} />
          <Field label="State (Land)" value={form.stateJurisdiction} onChange={(v) => set('stateJurisdiction', v)} />
          <Field label="Assigned To" value={form.assignedTo} onChange={(v) => set('assignedTo', v)} />
        </div>
      </FieldSection>

      <FieldSection title="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
        />
      </FieldSection>

      <div className="flex justify-end gap-2 pt-3 border-t border-ledger-line">
        <button onClick={handleCancel} className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors">
          Save
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">{title}</h3>
      <div className="bg-ledger rounded-lg p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] text-ink-light/70 w-28 shrink-0">{label}</span>
      <span className="text-sm text-ink font-medium">{value || '\u2014'}</span>
    </div>
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

function Field({ label, value, onChange, type = 'text', className = '' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      />
    </div>
  );
}
