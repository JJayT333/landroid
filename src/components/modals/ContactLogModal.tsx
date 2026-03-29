/** Add/edit contact log entry modal. */
import { useState } from 'react';
import Modal from '../shared/Modal';
import type { ContactLog, ContactType, ContactDirection } from '../../types/owner';
import { CONTACT_TYPE_OPTIONS } from '../../types/owner';

interface Props {
  entry: ContactLog;
  onSave: (entry: ContactLog) => void;
  onClose: () => void;
}

export default function ContactLogModal({ entry, onSave, onClose }: Props) {
  const [form, setForm] = useState({ ...entry });

  const set = (field: keyof ContactLog, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Log Contact">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Type</Label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value as ContactType)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              {CONTACT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Direction</Label>
            <select
              value={form.direction}
              onChange={(e) => set('direction', e.target.value as ContactDirection)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <Input label="Contact Person" value={form.contactPerson} onChange={(v) => set('contactPerson', v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" value={form.date} onChange={(v) => set('date', v)} type="date" />
          <Input label="Time" value={form.time} onChange={(v) => set('time', v)} type="time" />
        </div>

        <div>
          <Label>Summary</Label>
          <input
            type="text"
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder="Brief one-liner..."
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
          />
        </div>

        <div>
          <Label>Detailed Notes</Label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">Follow-up</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Follow-up Date" value={form.followUpDate} onChange={(v) => set('followUpDate', v)} type="date" />
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.followUpCompleted}
                  onChange={(e) => set('followUpCompleted', e.target.checked)}
                  className="rounded border-ledger-line text-leather focus:ring-leather"
                />
                Completed
              </label>
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-3 border-t border-ledger-line">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">{children}</label>;
}

function Input({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      />
    </div>
  );
}
