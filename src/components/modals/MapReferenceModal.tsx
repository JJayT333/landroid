import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import type { MapExternalReference, MapReferenceSource } from '../../types/map';
import {
  getMapReferenceUrlValidationMessage,
  MAP_REFERENCE_SOURCE_OPTIONS,
  normalizeMapReferenceUrl,
} from '../../types/map';

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
  const [urlError, setUrlError] = useState<string | null>(null);

  const set = (field: keyof typeof form, value: string) => {
    if (field === 'url') {
      setUrlError(null);
    }
    setForm((current) => ({ ...current, [field]: value }));
  };

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
        <div className="space-y-1">
          <FormField label="URL" value={form.url} onChange={(value) => set('url', value)} />
          <div className="text-[11px] text-ink-light">
            HTTP/HTTPS links only. Plain domains are saved as `https://...`.
          </div>
          {urlError && (
            <div className="text-[11px] font-medium text-seal">{urlError}</div>
          )}
        </div>

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
              const normalizedUrl = normalizeMapReferenceUrl(form.url);
              const nextUrlError = getMapReferenceUrlValidationMessage(form.url);
              if (nextUrlError) {
                setUrlError(nextUrlError);
                return;
              }

              setSaving(true);
              try {
                await onSave({
                  source: form.source as MapReferenceSource,
                  label: form.label,
                  url: normalizedUrl,
                  notes: form.notes,
                });
                onClose();
              } finally {
                setSaving(false);
              }
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
