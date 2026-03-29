/** Document attachments grid with upload and category. */
import { useRef } from 'react';
import { useOwnerStore } from '../../store/owner-store';
import { DOC_CATEGORY_OPTIONS } from '../../types/owner';
import type { OwnerDoc, DocCategory } from '../../types/owner';

interface Props {
  ownerId: string;
  onViewPdf?: (doc: OwnerDoc) => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function OwnerDocsTab({ ownerId, onViewPdf }: Props) {
  const docs = useOwnerStore((s) => s.activeDocs);
  const addDoc = useOwnerStore((s) => s.addDoc);
  const removeDoc = useOwnerStore((s) => s.removeDoc);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const doc: OwnerDoc = {
        id: uid('odoc'),
        ownerId,
        leaseId: null,
        category: guessCategoryFromName(file.name),
        fileName: file.name,
        mimeType: file.type,
        blob: file,
        notes: '',
        createdAt: new Date().toISOString(),
      };
      await addDoc(doc);
    }

    e.target.value = '';
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this document?')) removeDoc(id);
  };

  const categoryLabel = (cat: DocCategory) =>
    DOC_CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wider">
          Documents ({docs.length})
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
        >
          + Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {docs.length === 0 ? (
        <div
          className="border-2 border-dashed border-ledger-line rounded-xl p-8 text-center cursor-pointer hover:border-leather/40 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-3xl text-ink-light/30 mb-2">{'\uD83D\uDCC4'}</div>
          <p className="text-sm text-ink-light/50">Click to upload or drag files here</p>
          <p className="text-[10px] text-ink-light/30 mt-1">PDF, Word, images accepted</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-ledger rounded-xl border border-ledger-line p-3 group"
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl shrink-0">
                  {doc.mimeType.includes('pdf') ? '\uD83D\uDCC4' : '\uD83D\uDDBC\uFE0F'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink font-medium truncate">{doc.fileName}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-leather/10 text-leather mt-1">
                    {categoryLabel(doc.category)}
                  </span>
                  <p className="text-[10px] text-ink-light/40 font-mono mt-1">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.mimeType.includes('pdf') && onViewPdf && (
                  <button
                    onClick={() => onViewPdf(doc)}
                    className="px-2 py-1 rounded text-[10px] font-semibold text-leather hover:bg-leather/10 transition-colors"
                  >
                    View
                  </button>
                )}
                <button
                  onClick={() => {
                    const url = URL.createObjectURL(doc.blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = doc.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2 py-1 rounded text-[10px] font-semibold text-ink-light hover:bg-parchment-dark transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-2 py-1 rounded text-[10px] text-seal hover:bg-seal/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function guessCategoryFromName(name: string): DocCategory {
  const lower = name.toLowerCase();
  if (lower.includes('lease')) return 'lease';
  if (lower.includes('memo')) return 'memorandum';
  if (lower.includes('deed')) return 'deed';
  if (lower.includes('check')) return 'check';
  if (lower.includes('plat')) return 'plat';
  if (lower.includes('mor') || lower.includes('mineral ownership')) return 'mor';
  return 'other';
}
