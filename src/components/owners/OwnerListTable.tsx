/** Sortable owner table with status badges. */
import { useOwnerStore, type SortField } from '../../store/owner-store';
import { STATUS_OPTIONS } from '../../types/owner';
import type { Owner } from '../../types/owner';

function StatusBadge({ status }: { status: Owner['status'] }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${opt?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {opt?.label ?? status}
    </span>
  );
}

const COLUMNS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Owner' },
  { field: 'county', label: 'County' },
  { field: 'status', label: 'Status' },
  { field: 'updatedAt', label: 'Updated' },
];

export default function OwnerListTable() {
  const owners = useOwnerStore((s) => s.owners);
  const selectedId = useOwnerStore((s) => s.selectedOwnerId);
  const selectOwner = useOwnerStore((s) => s.selectOwner);
  const searchQuery = useOwnerStore((s) => s.searchQuery);
  const statusFilter = useOwnerStore((s) => s.statusFilter);
  const sortField = useOwnerStore((s) => s.sortField);
  const sortDirection = useOwnerStore((s) => s.sortDirection);
  const setSort = useOwnerStore((s) => s.setSort);

  const q = searchQuery.toLowerCase();
  const filtered = owners
    .filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (q && !o.name.toLowerCase().includes(q) && !o.county.toLowerCase().includes(q) && !o.prospect.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_70px_70px] gap-1 px-3 py-2 bg-parchment-dark/50 border-b border-ledger-line sticky top-0">
        {COLUMNS.map((col) => (
          <button
            key={col.field}
            onClick={() => setSort(col.field)}
            className="text-[10px] font-semibold text-ink-light uppercase tracking-wider text-left hover:text-ink transition-colors flex items-center gap-1"
          >
            {col.label}
            {sortField === col.field && (
              <span className="text-leather">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-light/60">
          {owners.length === 0 ? 'No owners yet. Click "+ New Owner" to get started.' : 'No owners match your filters.'}
        </div>
      ) : (
        filtered.map((owner) => (
          <button
            key={owner.id}
            onClick={() => selectOwner(owner.id)}
            className={`
              w-full grid grid-cols-[1fr_80px_70px_70px] gap-1 px-3 py-2.5 text-left border-b border-ledger-line/50 transition-colors
              ${selectedId === owner.id
                ? 'bg-leather/10 border-l-2 border-l-leather'
                : 'hover:bg-parchment-dark/30 border-l-2 border-l-transparent'}
            `}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink truncate">{owner.name || 'Unnamed'}</div>
              {owner.prospect && (
                <div className="text-[10px] text-ink-light/60 truncate">{owner.prospect}</div>
              )}
            </div>
            <div className="text-xs text-ink-light truncate self-center">{owner.county}</div>
            <div className="self-center"><StatusBadge status={owner.status} /></div>
            <div className="text-[10px] text-ink-light/50 self-center font-mono">
              {owner.updatedAt ? new Date(owner.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
