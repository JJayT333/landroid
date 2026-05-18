/**
 * PDF viewer modal — displays a stored document in an iframe.
 *
 * Phase 5 / B2: keyed by `docId`. The caller (chips, modal "View PDF"
 * buttons, multi-chip rows) resolves which document to show before
 * opening the modal. `nodeId`-based callers are gone after B2.
 */
import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { getDocBlob, getDocMeta } from '../../storage/document-store';
import { normalizePdfBlob } from '../../utils/pdf-validation';

interface PdfViewerModalProps {
  docId: string;
  /**
   * Optional filename shown in the title while the blob loads. The
   * modal falls back to `getDocMeta(docId)` so the hint is purely a
   * visual smoothing aid and can be omitted.
   */
  fileNameHint?: string | null;
  onClose: () => void;
}

export default function PdfViewerModal({
  docId,
  fileNameHint,
  onClose,
}: PdfViewerModalProps) {
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
        const resolvedFileName = meta?.fileName ?? fileNameHint ?? 'PDF';
        const safeBlob = await normalizePdfBlob(blob, resolvedFileName);
        if (cancelled) return;
        url = URL.createObjectURL(safeBlob);
        setObjectUrl(url);
        setFileName(resolvedFileName);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No PDF found for this document.'
        );
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId, fileNameHint]);

  return (
    <Modal open onClose={onClose} title={fileName || fileNameHint || 'View PDF'} wide>
      {error ? (
        <div className="text-center py-8 text-ink-light">{error}</div>
      ) : objectUrl ? (
        <iframe
          src={objectUrl}
          sandbox="allow-downloads"
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
