import { useEffect, useRef, useState } from 'react';
import AssetPreviewModal from '../modals/AssetPreviewModal';
import OwnerDocEditModal from '../modals/OwnerDocEditModal';
import { useConfirmation } from '../shared/ConfirmationProvider';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import type { Lease, OwnerDoc, OwnerDocMeta } from '../../types/owner';
import { createBlankOwnerDoc } from '../../types/owner';
import { getOwnerDocBlob } from '../../storage/owner-persistence';
import {
  OWNER_DOCUMENT_ACCEPT,
  OWNER_DOCUMENT_UPLOAD_EXTENSIONS,
  assertAllowedFileExtension,
  assertFileSize,
  limitForExtension,
} from '../../utils/file-validation';
import {
  PDF_MIME_TYPE,
  isPdfFileName,
  normalizePdfBlob,
} from '../../utils/pdf-validation';

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
  docs: OwnerDocMeta[];
  leases: Lease[];
  onAdd: (doc: OwnerDoc) => Promise<void>;
  onUpdate: (id: string, fields: Partial<OwnerDoc>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export default function OwnerDocsTab({
  workspaceId,
  ownerId,
  docs,
  leases,
  onAdd,
  onUpdate,
  onRemove,
  readOnly = false,
}: OwnerDocsTabProps) {
  const {
    alert: showAlert,
    confirm: requestConfirmation,
  } = useConfirmation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] =
    useState<{ meta: OwnerDocMeta; blob: Blob } | null>(null);
  const [editingDoc, setEditingDoc] = useState<OwnerDocMeta | null>(null);

  useEffect(() => {
    if (readOnly) {
      setEditingDoc(null);
    }
  }, [readOnly]);

  // Owner-doc blobs are loaded on demand: the store holds metadata only, so
  // preview/download fetch the bytes from Dexie when the user asks for them.
  async function withDocBlob(
    doc: OwnerDocMeta,
    use: (blob: Blob) => void
  ): Promise<void> {
    const blob = await getOwnerDocBlob(doc.id);
    if (!blob) {
      await showAlert({
        title: 'Document Unavailable',
        message: 'This document’s file could not be loaded.',
      });
      return;
    }
    use(blob);
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={OWNER_DOCUMENT_ACCEPT}
        disabled={readOnly}
        className="hidden"
        multiple
        onChange={async (event) => {
          if (readOnly) return;
          const files = Array.from(event.target.files ?? []);
          try {
            for (const file of files) {
              assertAllowedFileExtension(
                file.name,
                OWNER_DOCUMENT_UPLOAD_EXTENSIONS,
                'Owner document'
              );
              const limit = limitForExtension(file.name);
              assertFileSize(file, limit.bytes, limit.label);
              const isPdf = isPdfFileName(file.name) || file.type.toLowerCase().includes('pdf');
              const blob = isPdf ? await normalizePdfBlob(file, file.name) : file;
              await onAdd(
                createBlankOwnerDoc(workspaceId, ownerId, blob, {
                  fileName: file.name,
                  mimeType: isPdf
                    ? PDF_MIME_TYPE
                    : file.type || 'application/octet-stream',
                })
              );
            }
          } catch (error) {
            await showAlert({
              title: 'Upload Blocked',
              message:
                error instanceof Error
                  ? error.message
                  : 'One or more owner documents could not be uploaded.',
            });
          } finally {
            event.target.value = '';
          }
        }}
      />

      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) inputRef.current?.click();
        }}
        title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
        className="px-3 py-2 rounded-md text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        Upload Documents
      </button>

      {docs.length === 0 && (
        <div className="rounded-md border border-dashed border-ledger-line px-4 py-5 text-sm text-ink-light">
          No owner documents yet. Click to upload files.
        </div>
      )}

      <div className="space-y-3">
        {docs.map((doc) => {
          const linkedLease = leases.find((lease) => lease.id === doc.leaseId);

          return (
            <div
              key={doc.id}
              className="rounded-md border border-ledger-line bg-parchment px-4 py-3"
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
                    onClick={() =>
                      withDocBlob(doc, (blob) =>
                        setPreviewDoc({ meta: doc, blob })
                      )
                    }
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setEditingDoc(doc)}
                    title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-ink hover:bg-parchment-dark transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      withDocBlob(doc, (blob) => downloadBlob(blob, doc.fileName))
                    }
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-ink hover:bg-parchment-dark transition-colors"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={async () => {
                      if (readOnly) return;
                      const confirmed = await requestConfirmation({
                        title: 'Delete Owner Document?',
                        message: 'Delete this document?',
                        confirmLabel: 'Delete Document',
                        tone: 'danger',
                      });
                      if (!confirmed) return;
                      await onRemove(doc.id);
                    }}
                    title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-seal hover:bg-seal/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
          fileName={previewDoc.meta.fileName}
          mimeType={previewDoc.meta.mimeType}
          blob={previewDoc.blob}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {editingDoc && (
        <OwnerDocEditModal
          doc={editingDoc}
          leases={leases}
          onClose={() => setEditingDoc(null)}
          onPreview={() =>
            withDocBlob(editingDoc, (blob) =>
              setPreviewDoc({ meta: editingDoc, blob })
            )
          }
          onSave={(fields) => onUpdate(editingDoc.id, fields)}
        />
      )}
    </div>
  );
}
