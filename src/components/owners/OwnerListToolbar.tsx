/** Search bar, status filter, New Owner and Export buttons. */
import { useOwnerStore } from '../../store/owner-store';
import { STATUS_OPTIONS } from '../../types/owner';
import type { OwnerStatus } from '../../types/owner';

interface Props {
  onNewOwner: () => void;
  onExport: () => void;
}

export default function OwnerListToolbar({ onNewOwner, onExport }: Props) {
  const searchQuery = useOwnerStore((s) => s.searchQuery);
  const setSearch = useOwnerStore((s) => s.setSearch);
  const statusFilter = useOwnerStore((s) => s.statusFilter);
  const setStatusFilter = useOwnerStore((s) => s.setStatusFilter);

  return (
    <div className="space-y-2 p-3 border-b border-ledger-line">
      <div className="flex gap-2">
        <button
          onClick={onNewOwner}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors whitespace-nowrap"
        >
          + New Owner
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-light hover:bg-parchment-dark border border-ledger-line transition-colors whitespace-nowrap"
        >
          Export
        </button>
      </div>
      <input
        type="text"
        placeholder="Search owners..."
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm placeholder:text-ink-light/50 focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      />
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as OwnerStatus | 'all')}
        className="w-full px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink text-xs focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      >
        <option value="all">All Statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
