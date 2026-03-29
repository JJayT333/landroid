/** Owner name, status badge, priority, quick action buttons. */
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/owner';
import type { Owner, OwnerStatus, Priority } from '../../types/owner';
import { useOwnerStore } from '../../store/owner-store';

interface Props {
  owner: Owner;
}

export default function OwnerDetailHeader({ owner }: Props) {
  const updateOwner = useOwnerStore((s) => s.updateOwner);
  const removeOwner = useOwnerStore((s) => s.removeOwner);
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === owner.status);

  const handleDelete = () => {
    if (confirm(`Delete "${owner.name}" and all their leases, contacts, and documents?`)) {
      removeOwner(owner.id);
    }
  };

  return (
    <div className="px-5 py-4 border-b border-ledger-line bg-parchment">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-display font-bold text-ink truncate">
            {owner.name || 'Unnamed Owner'}
          </h2>
          {owner.prospect && (
            <p className="text-xs text-ink-light mt-0.5">{owner.prospect} &middot; {owner.county}{owner.stateJurisdiction ? `, ${owner.stateJurisdiction}` : ''}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="px-2.5 py-1.5 rounded-lg text-xs text-seal hover:bg-seal/10 transition-colors shrink-0"
        >
          Delete
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-ink-light uppercase tracking-wider">Status</label>
          <select
            value={owner.status}
            onChange={(e) => updateOwner(owner.id, { status: e.target.value as OwnerStatus })}
            className={`px-2 py-1 rounded-full text-[11px] font-semibold border-0 outline-none cursor-pointer ${statusOpt?.color ?? 'bg-gray-100 text-gray-600'}`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-ink-light uppercase tracking-wider">Priority</label>
          <select
            value={owner.priority}
            onChange={(e) => updateOwner(owner.id, { priority: e.target.value as Priority })}
            className="px-2 py-1 rounded-lg text-[11px] font-medium border border-ledger-line bg-parchment text-ink outline-none cursor-pointer"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {owner.assignedTo && (
          <span className="text-[10px] text-ink-light/60 ml-auto">
            Assigned: <span className="font-medium text-ink-light">{owner.assignedTo}</span>
          </span>
        )}
      </div>
    </div>
  );
}
