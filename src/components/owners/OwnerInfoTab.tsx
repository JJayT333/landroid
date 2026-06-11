import { useState } from 'react';
import Button from '../shared/Button';
import FormField from '../shared/FormField';
import { useConfirmation } from '../shared/ConfirmationProvider';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { Owner } from '../../types/owner';

interface OwnerInfoTabProps {
  owner: Owner;
  onSave: (fields: Partial<Owner>) => Promise<void>;
  onDelete: () => Promise<void>;
  readOnly?: boolean;
}

export default function OwnerInfoTab({
  owner,
  onSave,
  onDelete,
  readOnly = false,
}: OwnerInfoTabProps) {
  const { confirm: requestConfirmation } = useConfirmation();
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
        <FormField label="Owner Name" value={form.name} onChange={(value) => set('name', value)} disabled={readOnly} />
        <FormField
          label="Entity Type"
          value={form.entityType}
          onChange={(value) => set('entityType', value)}
          disabled={readOnly}
        />
        <FormField label="County" value={form.county} onChange={(value) => set('county', value)} disabled={readOnly} />
        <FormField
          label="Prospect"
          value={form.prospect}
          onChange={(value) => set('prospect', value)}
          disabled={readOnly}
        />
        <FormField
          label="Email"
          value={form.email}
          onChange={(value) => set('email', value)}
          disabled={readOnly}
        />
        <FormField
          label="Phone"
          value={form.phone}
          onChange={(value) => set('phone', value)}
          disabled={readOnly}
        />
      </div>

      <div>
        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
          Mailing Address
        </label>
        <textarea
          value={form.mailingAddress}
          disabled={readOnly}
          onChange={(event) => set('mailingAddress', event.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-md border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
          Notes
        </label>
        <textarea
          value={form.notes}
          disabled={readOnly}
          onChange={(event) => set('notes', event.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-md border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-ledger-line">
        <button
          type="button"
          disabled={readOnly}
          onClick={async () => {
            if (readOnly) return;
            const confirmed = await requestConfirmation({
              title: 'Delete Owner?',
              message: `Delete ${owner.name || 'this owner'} and all linked owner records?`,
              confirmLabel: 'Delete Owner',
              tone: 'danger',
            });
            if (!confirmed) return;
            await onDelete();
          }}
          title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
          className="px-3 py-2 rounded-md text-xs font-semibold text-seal hover:bg-seal/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete Owner
        </button>
        <Button
          disabled={readOnly || saving}
          onClick={async () => {
            if (readOnly) return;
            setSaving(true);
            await onSave(form);
            setSaving(false);
          }}
          title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
        >
          {saving ? 'Saving...' : 'Save Owner'}
        </Button>
      </div>
    </div>
  );
}
