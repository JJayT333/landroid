import { useEffect, useMemo, useState } from 'react';
import { buildRrcDelimitedTextPreview } from '../../research/rrc-delimited-text';
import {
  PENDING_DRILLING_FILE_SPECS,
  detectPendingDrillingFileKind,
} from '../../research/rrc-pending-drilling';
import { isPdfFileName, normalizePdfBlob } from '../../utils/pdf-validation';
import RrcDelimitedPreviewTable from '../research/RrcDelimitedPreviewTable';
import Modal from '../shared/Modal';

interface AssetPreviewModalProps {
  fileName: string;
  mimeType: string;
  blob: Blob;
  onClose: () => void;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AssetPreviewModal({
  fileName,
  mimeType,
  blob,
  onClose,
}: AssetPreviewModalProps) {
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [delimitedPreview, setDelimitedPreview] = useState<ReturnType<typeof buildRrcDelimitedTextPreview> | null>(null);
  const lowerMime = mimeType.toLowerCase();
  const lowerFileName = fileName.toLowerCase();
  const isPdf = lowerMime.includes('pdf') || isPdfFileName(fileName);
  const isImage =
    lowerMime === 'image/png' ||
    lowerMime === 'image/jpeg' ||
    lowerFileName.endsWith('.png') ||
    lowerFileName.endsWith('.jpg') ||
    lowerFileName.endsWith('.jpeg');
  const isTextLike =
    lowerMime.includes('json') ||
    lowerMime.startsWith('text/') ||
    lowerFileName.endsWith('.geojson') ||
    lowerFileName.endsWith('.json');
  const objectUrl = useMemo(
    () => (isPdf ? null : URL.createObjectURL(blob)),
    [blob, isPdf]
  );
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTextLike) {
      setTextPreview(null);
      setDelimitedPreview(null);
      return;
    }

    let cancelled = false;
    blob.text()
      .then((text) => {
        if (cancelled) return;
        const pendingFileKind = detectPendingDrillingFileKind(fileName);
        const preview = buildRrcDelimitedTextPreview(text, {
          knownColumns: pendingFileKind
            ? PENDING_DRILLING_FILE_SPECS[pendingFileKind].columns
            : undefined,
          maxRows: 50,
        });
        setDelimitedPreview(preview);
        try {
          setTextPreview(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setTextPreview(text);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDelimitedPreview(null);
        setTextPreview('Failed to read this file for inline preview.');
      });

    return () => {
      cancelled = true;
    };
  }, [blob, fileName, isTextLike]);

  useEffect(() => {
    if (!isPdf) {
      setPdfObjectUrl(null);
      setPdfError(null);
      return;
    }

    let cancelled = false;
    let url: string | null = null;
    setPdfObjectUrl(null);
    setPdfError(null);

    normalizePdfBlob(blob, fileName)
      .then((safeBlob) => {
        if (cancelled) return;
        url = URL.createObjectURL(safeBlob);
        setPdfObjectUrl(url);
      })
      .catch((error) => {
        if (cancelled) return;
        setPdfError(
          error instanceof Error
            ? error.message
            : 'This file is not a valid PDF.'
        );
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob, fileName, isPdf]);

  useEffect(() => {
    if (!objectUrl) return undefined;
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <Modal open onClose={onClose} title={fileName} wide>
      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => downloadBlob(blob, fileName)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
          >
            Download
          </button>
        </div>

        {isPdf && (
          pdfError ? (
            <div className="rounded-md border border-seal/30 bg-seal/5 p-4 text-sm text-seal">
              {pdfError}
            </div>
          ) : pdfObjectUrl ? (
            <iframe
              src={pdfObjectUrl}
              sandbox="allow-downloads"
              className="w-full rounded-md border border-ledger-line"
              style={{ height: '70vh' }}
              title={fileName}
            />
          ) : (
            <div className="rounded-md border border-ledger-line bg-ledger p-4 text-sm text-ink-light">
              Loading PDF preview...
            </div>
          )
        )}

        {isImage && objectUrl && (
          <div className="rounded-md border border-ledger-line bg-ledger p-3">
            <img
              src={objectUrl}
              alt={fileName}
              className="max-h-[70vh] mx-auto rounded"
            />
          </div>
        )}

        {!isPdf && !isImage && isTextLike && delimitedPreview && (
          <RrcDelimitedPreviewTable
            title="Readable TXT Preview"
            preview={delimitedPreview}
            description="LANDroid parsed the RRC delimiter layout into rows and columns for easier review."
          />
        )}

        {!isPdf && !isImage && isTextLike && !delimitedPreview && (
          <pre className="max-h-[70vh] overflow-auto rounded-md border border-ledger-line bg-ledger p-4 text-xs text-ink whitespace-pre-wrap break-words">
            {textPreview ?? 'Loading preview...'}
          </pre>
        )}

        {!isPdf && !isImage && !isTextLike && (
          <div className="rounded-md border border-ledger-line bg-ledger p-4 text-sm text-ink-light">
            No inline preview is available for this file type yet.
          </div>
        )}
      </div>
    </Modal>
  );
}
