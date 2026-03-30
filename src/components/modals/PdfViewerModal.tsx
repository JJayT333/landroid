/**
 * PDF viewer modal — displays an attached PDF in an iframe.
 *
 * Loads the PDF blob from IndexedDB, creates an object URL,
 * and renders it inline. Cleans up the URL on unmount.
 */
import { useEffect, useState } from 'react';
import Modal from '../shared/Modal';
import { createBundledDeskMapPdfFile } from '../../storage/bundled-deskmap-pdfs';
import { getPdf } from '../../storage/pdf-store';
import { savePdf } from '../../storage/pdf-store';

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
        let attachment = await getPdf(nodeId);

        if (!attachment || attachment.blob.size === 0) {
          const fallbackFile = await createBundledDeskMapPdfFile(
            nodeId,
            fileNameHint
          );
          await savePdf(nodeId, fallbackFile);
          attachment = {
            nodeId,
            fileName: fallbackFile.name,
            mimeType: fallbackFile.type,
            blob: fallbackFile,
            createdAt: new Date().toISOString(),
          };
        }

        if (cancelled) return;
        url = URL.createObjectURL(attachment.blob);
        setObjectUrl(url);
        setFileName(attachment.fileName);
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
  }, [fileNameHint, nodeId]);

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
