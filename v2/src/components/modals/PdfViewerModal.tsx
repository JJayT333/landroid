/**
 * PDF viewer modal — displays an attached PDF in an iframe.
 *
 * Loads the PDF blob from IndexedDB, creates an object URL,
 * and renders it inline. Cleans up the URL on unmount.
 */
import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { getPdf } from '../../storage/pdf-store';

interface PdfViewerModalProps {
  nodeId: string;
  onClose: () => void;
}

export default function PdfViewerModal({ nodeId, onClose }: PdfViewerModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    getPdf(nodeId).then((attachment) => {
      if (cancelled) return;
      if (!attachment) {
        setError('No PDF found for this node.');
        return;
      }
      url = URL.createObjectURL(attachment.blob);
      setObjectUrl(url);
      setFileName(attachment.fileName);
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [nodeId]);

  return (
    <Modal open onClose={onClose} title={fileName || 'View PDF'} wide>
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
