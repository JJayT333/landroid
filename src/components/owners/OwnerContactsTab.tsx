import { useState } from 'react';
import FormField from '../shared/FormField';
import type { ContactLog } from '../../types/owner';
import { createBlankContact } from '../../types/owner';

interface OwnerContactsTabProps {
  workspaceId: string;
  ownerId: string;
  contacts: ContactLog[];
  onAdd: (contact: ContactLog) => Promise<void>;
  onUpdate: (id: string, fields: Partial<ContactLog>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export default function OwnerContactsTab({
  workspaceId,
  ownerId,
  contacts,
  onAdd,
  onUpdate,
  onRemove,
}: OwnerContactsTabProps) {
  const [draft, setDraft] = useState<ContactLog | null>(null);
  const [saving, setSaving] = useState(false);

  const beginAdd = () => {
    setDraft(createBlankContact(workspaceId, ownerId));
  };

  const beginEdit = (contact: ContactLog) => {
    setDraft({ ...contact });
  };

  const set = (field: keyof ContactLog, value: string) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  return (
    <div className="space-y-4">
      {draft ? (
        <div className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Contact Date"
              type="date"
              value={draft.contactDate}
              onChange={(value) => set('contactDate', value)}
            />
            <FormField
              label="Method"
              value={draft.method}
              onChange={(value) => set('method', value)}
            />
            <FormField
              label="Subject"
              value={draft.subject}
              onChange={(value) => set('subject', value)}
            />
            <FormField
              label="Outcome"
              value={draft.outcome}
              onChange={(value) => set('outcome', value)}
            />
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                if (contacts.some((contact) => contact.id === draft.id)) {
                  await onUpdate(draft.id, draft);
                } else {
                  await onAdd(draft);
                }
                setSaving(false);
                setDraft(null);
              }}
              className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginAdd}
          className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
        >
          + Add Contact
        </button>
      )}

      <div className="space-y-3">
        {contacts.length === 0 && (
          <div className="rounded-lg border border-dashed border-ledger-line px-4 py-5 text-sm text-ink-light">
            No contact history recorded yet.
          </div>
        )}

        {contacts
          .slice()
          .sort((left, right) => right.contactDate.localeCompare(left.contactDate))
          .map((contact) => (
            <div
              key={contact.id}
              className="rounded-xl border border-ledger-line bg-parchment px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-ink">
                    {contact.subject || contact.method || 'Contact'}
                  </div>
                  <div className="text-xs text-ink-light">
                    {[contact.contactDate || 'No date', contact.method, contact.outcome]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                  {contact.notes && (
                    <div className="text-sm text-ink whitespace-pre-wrap">{contact.notes}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(contact)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this contact log?')) {
                        return;
                      }
                      await onRemove(contact.id);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
