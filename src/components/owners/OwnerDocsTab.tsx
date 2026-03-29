import { useRef, useState } from 'react';
import AssetPreviewModal from '../modals/AssetPreviewModal';
import OwnerDocEditModal from '../modals/OwnerDocEditModal';
import type { Lease, OwnerDoc } from '../../types/owner';
import { createBlankOwnerDoc } from '../../types/owner';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface OwnerDocsTabProps {
  workspaceId: string;
  ownerId: string;
  docs: OwnerDoc[];
  leases: Lease[];
  onAdd: (doc: OwnerDoc) => Promise<void>;
  onUpdate: (id: string, fields: Partial<OwnerDoc>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export default function OwnerDocsTab({
  workspaceId,
  ownerId,
  docs,
  leases,
  onAdd,
  onUpdate,
  onRemove,
}: OwnerDocsTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<OwnerDoc | null>(null);
  const [editingDoc, setEditingDoc] = useState<OwnerDoc | null>(null);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          for (const file of files) {
            await onAdd(
              createBlankOwnerDoc(workspaceId, ownerId, file, {
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
              })
            );
          }
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
      >
        Upload Documents
      </button>

      {docs.length === 0 && (
        <div className="rounded-lg border border-dashed border-ledger-line px-4 py-5 text-sm text-ink-light">
          No owner documents yet. Click to upload files.
        </div>
      )}

      <div className="space-y-3">
        {docs.map((doc) => {
          const linkedLease = leases.find((lease) => lease.id === doc.leaseId);

          return (
            <div
              key={doc.id}
              className="rounded-xl border border-ledger-line bg-parchment px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{doc.fileName}</div>
                  <div className="text-xs text-ink-light">
                    {[doc.category, linkedLease ? `Lease: ${linkedLease.leaseName || linkedLease.lessee || linkedLease.docNo}` : '', doc.mimeType]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                  {doc.notes && (
                    <div className="text-sm text-ink whitespace-pre-wrap">{doc.notes}</div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDoc(doc)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-parchment-dark transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBlob(doc.blob, doc.fileName)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-parchment-dark transition-colors"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this document?')) {
                        return;
                      }
                      await onRemove(doc.id);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {previewDoc && (
        <AssetPreviewModal
          fileName={previewDoc.fileName}
          mimeType={previewDoc.mimeType}
          blob={previewDoc.blob}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {editingDoc && (
        <OwnerDocEditModal
          doc={editingDoc}
          leases={leases}
          onClose={() => setEditingDoc(null)}
          onPreview={() => setPreviewDoc(editingDoc)}
          onSave={(fields) => onUpdate(editingDoc.id, fields)}
        />
      )}
    </div>
  );
}
