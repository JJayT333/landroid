/**
 * PDF viewer modal — displays an attached PDF in an iframe.
 *
 * Phase 5: keyed externally by `nodeId` for backward compatibility with
 * the Desk Map / NodeEditModal callback chain, but resolves the first
 * attached document on the node and loads the blob from the v8
 * `documents` table. Phase B will switch the prop to `docId` so a
 * multi-chip surface can target any attachment.
 */
import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { getDocBlob, getDocMeta } from '../../storage/document-store';
import { useWorkspaceStore } from '../../store/workspace-store';

interface PdfViewerModalProps {
  nodeId: string;
  fileNameHint?: string | null;
  onClose: () => void;
}

export default function PdfViewerModal({
  nodeId,
  fileNameHint,
  onClose,
}: PdfViewerModalProps) {
  const docId = useWorkspaceStore(
    (state) => state.nodes.find((n) => n.id === nodeId)?.attachments[0]?.docId
  );
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    setError(null);
    setObjectUrl(null);
    setFileName('');

    (async () => {
      try {
        if (!docId) {
          throw new Error(
            'No PDF attachment was found for this title card. Reattach the recorded instrument before relying on View PDF.'
          );
        }
        const [blob, meta] = await Promise.all([
          getDocBlob(docId),
          getDocMeta(docId),
        ]);
        if (!blob || blob.size === 0) {
          throw new Error(
            'No PDF attachment was found for this title card. Reattach the recorded instrument before relying on View PDF.'
          );
        }

        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setFileName(meta?.fileName ?? fileNameHint ?? '');
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No PDF found for this node.'
        );
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId, fileNameHint, nodeId]);

  return (
    <Modal open onClose={onClose} title={fileName || fileNameHint || 'View PDF'} wide>
      {error ? (
        <div className="text-center py-8 text-ink-light">{error}</div>
      ) : objectUrl ? (
        <iframe
          src={objectUrl}
          className="w-full rounded-lg border border-ledger-line"
          style={{ height: '70vh' }}
          title={fileName}
        />
      ) : (
        <div className="text-center py-8 text-ink-light">Loading PDF...</div>
      )}
    </Modal>
  );
}
