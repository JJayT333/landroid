/**
 * Attach related document modal — creates a non-conveying node attached to a parent.
 *
 * Related docs are things like Death Certificates, Affidavits, Court Orders, etc.
 * They don't convey interest but are relevant to the title chain.
 */
import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { createBlankNode } from '../../types/node';

interface AttachDocModalProps {
  parentNodeId: string;
  onClose: () => void;
}

export default function AttachDocModal({ parentNodeId, onClose }: AttachDocModalProps) {
  const addNode = useWorkspaceStore((s) => s.addNode);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);

  const [form, setForm] = useState({
    instrument: '',
    date: '',
    fileDate: '',
    vol: '',
    page: '',
    docNo: '',
    remarks: '',
  });

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = () => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const node = {
      ...createBlankNode(id, parentNodeId),
      type: 'related' as const,
      relatedKind: 'document' as const,
      instrument: form.instrument,
      date: form.date,
      fileDate: form.fileDate,
      vol: form.vol,
      page: form.page,
      docNo: form.docNo,
      remarks: form.remarks,
      fraction: '0',
      initialFraction: '0',
    };
    addNode(node);
    addNodeToActiveDeskMap(id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Attach Related Document">
      <div className="space-y-4">
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-2 text-xs text-ink">
          This document will be attached as a related record — it does not convey any interest.
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Document Info
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <InstrumentSelect value={form.instrument} onChange={(v) => set('instrument', v)} />
            <FormField label="Doc #" value={form.docNo} onChange={(v) => set('docNo', v)} />
            <FormField label="File Date" value={form.fileDate} onChange={(v) => set('fileDate', v)} type="date" />
            <FormField label="Inst. Date" value={form.date} onChange={(v) => set('date', v)} type="date" />
            <FormField label="Volume" value={form.vol} onChange={(v) => set('vol', v)} />
            <FormField label="Page" value={form.page} onChange={(v) => set('page', v)} />
          </div>
        </fieldset>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Description / Remarks
          </label>
          <textarea
            value={form.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            placeholder="Describe the document's relevance..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
          >
            Attach
          </button>
        </div>
      </div>
    </Modal>
  );
}
