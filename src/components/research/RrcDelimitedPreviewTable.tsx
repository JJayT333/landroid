import type { RrcDelimitedTextPreview } from '../../research/rrc-delimited-text';

interface RrcDelimitedPreviewTableProps {
  title: string;
  preview: RrcDelimitedTextPreview;
  description?: string;
}

export default function RrcDelimitedPreviewTable({
  title,
  preview,
  description,
}: RrcDelimitedPreviewTableProps) {
  return (
    <div className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          {description && (
            <div className="mt-1 text-xs text-ink-light">{description}</div>
          )}
        </div>
        <div className="text-xs text-ink-light">
          {preview.totalRowCount} row{preview.totalRowCount === 1 ? '' : 's'}
        </div>
      </div>

      <div className="text-xs text-ink-light">
        {preview.hasHeaderRow
          ? 'Header row detected from the imported file.'
          : 'Column names inferred from the known RRC file structure.'}
        {preview.truncated && ` Showing first ${preview.rows.length} rows.`}
      </div>

      <div className="max-h-[26rem] overflow-auto rounded-lg border border-ledger-line bg-parchment">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-ledger">
            <tr>
              {preview.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-ledger-line px-3 py-2 text-left font-semibold text-ink whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="odd:bg-parchment even:bg-ledger/40">
                {row.map((value, columnIndex) => (
                  <td
                    key={`${title}-${rowIndex}-${preview.columns[columnIndex] ?? columnIndex}`}
                    className="border-b border-ledger-line/60 px-3 py-2 align-top text-ink"
                  >
                    <div className="max-w-[20rem] whitespace-pre-wrap break-words">
                      {value || '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
