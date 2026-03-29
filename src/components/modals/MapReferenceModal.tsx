import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import type { MapExternalReference, MapReferenceSource } from '../../types/map';
import { MAP_REFERENCE_SOURCE_OPTIONS } from '../../types/map';

interface MapReferenceModalProps {
  reference: MapExternalReference;
  onClose: () => void;
  onSave: (fields: Partial<MapExternalReference>) => Promise<void>;
}

export default function MapReferenceModal({
  reference,
  onClose,
  onSave,
}: MapReferenceModalProps) {
  const [form, setForm] = useState({
    source: reference.source,
    label: reference.label,
    url: reference.url,
    notes: reference.notes,
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <Modal open onClose={onClose} title="Reference Link">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Source
          </label>
          <select
            value={form.source}
            onChange={(event) => set('source', event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
          >
            {MAP_REFERENCE_SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <FormField label="Label" value={form.label} onChange={(value) => set('label', value)} />
        <FormField label="URL" value={form.url} onChange={(value) => set('url', value)} />

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                source: form.source as MapReferenceSource,
                label: form.label,
                url: form.url,
                notes: form.notes,
              });
              setSaving(false);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
          >
            Save Link
          </button>
        </div>
      </div>
    </Modal>
  );
}
