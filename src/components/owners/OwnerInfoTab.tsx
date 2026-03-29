import { useState } from 'react';
import FormField from '../shared/FormField';
import type { Owner } from '../../types/owner';

interface OwnerInfoTabProps {
  owner: Owner;
  onSave: (fields: Partial<Owner>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function OwnerInfoTab({
  owner,
  onSave,
  onDelete,
}: OwnerInfoTabProps) {
  const [form, setForm] = useState({
    name: owner.name,
    entityType: owner.entityType,
    county: owner.county,
    prospect: owner.prospect,
    mailingAddress: owner.mailingAddress,
    email: owner.email,
    phone: owner.phone,
    notes: owner.notes,
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Owner Name" value={form.name} onChange={(value) => set('name', value)} />
        <FormField
          label="Entity Type"
          value={form.entityType}
          onChange={(value) => set('entityType', value)}
        />
        <FormField label="County" value={form.county} onChange={(value) => set('county', value)} />
        <FormField
          label="Prospect"
          value={form.prospect}
          onChange={(value) => set('prospect', value)}
        />
        <FormField
          label="Email"
          value={form.email}
          onChange={(value) => set('email', value)}
        />
        <FormField
          label="Phone"
          value={form.phone}
          onChange={(value) => set('phone', value)}
        />
      </div>

      <div>
        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
          Mailing Address
        </label>
        <textarea
          value={form.mailingAddress}
          onChange={(event) => set('mailingAddress', event.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
        />
      </div>

      <div>
        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(event) => set('notes', event.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-ledger-line">
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Delete ${owner.name || 'this owner'} and all linked owner records?`)) {
              return;
            }
            await onDelete();
          }}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
        >
          Delete Owner
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(form);
            setSaving(false);
          }}
          className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Owner'}
        </button>
      </div>
    </div>
  );
}
