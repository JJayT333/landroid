/**
 * Attach related document modal — creates a non-conveying node attached to a parent.
 *
 * Related docs are things like Death Certificates, Affidavits, Court Orders, etc.
 * They don't convey interest but are relevant to the title chain.
 */
import { useState } from 'react';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
import { normalizePdfBlob } from '../../utils/pdf-validation';
import { createBlankNode } from '../../types/node';

interface AttachDocModalProps {
  parentNodeId: string;
  onClose: () => void;
}

export default function AttachDocModal({ parentNodeId, onClose }: AttachDocModalProps) {
  const addNode = useWorkspaceStore((s) => s.addNode);
  const addNodeToActiveDeskMap = useWorkspaceStore((s) => s.addNodeToActiveDeskMap);
  const attachDocToNode = useWorkspaceStore((s) => s.attachDocToNode);
  const removeNode = useWorkspaceStore((s) => s.removeNode);

  const [form, setForm] = useState({
    instrument: '',
    date: '',
    fileDate: '',
    vol: '',
    page: '',
    docNo: '',
    remarks: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setError(null);
    setPending(true);
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
    let nodeAdded = false;
    try {
      if (file) {
        assertFileSize(file, FILE_SIZE_LIMITS.PDF, 'PDF');
        await normalizePdfBlob(file, file.name);
      }
      addNode(node);
      addNodeToActiveDeskMap(id);
      nodeAdded = true;
      if (file) {
        await attachDocToNode(id, file, {
          kind: 'related',
          fileName: file.name,
        });
      }
      onClose();
    } catch (saveError) {
      if (nodeAdded) {
        removeNode(id);
      }
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Document attachment failed. Please try again.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Attach Related Document">
      <div className="space-y-4">
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-2 text-xs text-ink">
          This document will be attached as a related record — it does not convey any interest.
        </div>

        {error && (
          <div className="rounded-md border border-seal/30 bg-seal/10 px-2 py-1 text-xs text-seal">
            {error}
          </div>
        )}

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

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            PDF Attachment
          </legend>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ledger-line bg-parchment px-2 py-1 text-xs font-semibold text-leather hover:bg-leather/5">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={pending}
              onChange={(event) => {
                setError(null);
                const selected = event.target.files?.[0] ?? null;
                if (!selected) {
                  setFile(null);
                  return;
                }
                try {
                  assertFileSize(selected, FILE_SIZE_LIMITS.PDF, 'PDF');
                  setFile(selected);
                } catch (uploadError) {
                  setFile(null);
                  setError(
                    uploadError instanceof Error
                      ? uploadError.message
                      : 'PDF attachment failed. Please try again.'
                  );
                } finally {
                  event.target.value = '';
                }
              }}
            />
            {file ? 'Change PDF' : '+ Attach PDF'}
          </label>
          {file && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-ledger-line bg-ledger px-2 py-1 text-xs text-ink">
              <span className="min-w-0 truncate font-mono">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold text-seal hover:bg-seal/10"
              >
                Remove
              </button>
            </div>
          )}
        </fieldset>

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Attaching...' : 'Attach'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
