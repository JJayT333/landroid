/** Lease list for an owner — cards + add button + P-88 generation. */
import { useState } from 'react';
import { useOwnerStore } from '../../store/owner-store';
import { createBlankLease } from '../../types/owner';
import type { Lease } from '../../types/owner';
import { downloadProducers88 } from '../../engine/lease-generator';
import LeaseCard from './LeaseCard';
import LeaseEditModal from '../modals/LeaseEditModal';

interface Props {
  ownerId: string;
}

export default function OwnerLeasesTab({ ownerId }: Props) {
  const owners = useOwnerStore((s) => s.owners);
  const leases = useOwnerStore((s) => s.activeLeases);
  const addLease = useOwnerStore((s) => s.addLease);
  const updateLease = useOwnerStore((s) => s.updateLease);
  const removeLease = useOwnerStore((s) => s.removeLease);

  const [editingLease, setEditingLease] = useState<Lease | null>(null);

  const owner = owners.find((o) => o.id === ownerId);

  const handleNew = () => {
    setEditingLease(createBlankLease(ownerId));
  };

  const handleSave = (fields: Partial<Lease>) => {
    if (!editingLease) return;
    const existing = leases.find((l) => l.id === editingLease.id);
    if (existing) {
      updateLease(editingLease.id, fields);
    } else {
      addLease({ ...editingLease, ...fields } as Lease);
    }
  };

  const handleGenerate = async (lease: Lease) => {
    if (!owner) return;
    try {
      await downloadProducers88(owner, lease);
    } catch (err) {
      console.error('Lease generation failed:', err);
      alert('Failed to generate lease document. Check console for details.');
    }
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-light uppercase tracking-wider">
          Leases ({leases.length})
        </h3>
        <button
          onClick={handleNew}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
        >
          + Add Lease
        </button>
      </div>

      {leases.length === 0 ? (
        <div className="text-center py-10 text-sm text-ink-light/50">
          No leases recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {leases.map((lease) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              onEdit={() => setEditingLease(lease)}
              onDelete={() => removeLease(lease.id)}
              onGenerate={() => handleGenerate(lease)}
            />
          ))}
        </div>
      )}

      {editingLease && (
        <LeaseEditModal
          lease={editingLease}
          onSave={handleSave}
          onClose={() => setEditingLease(null)}
        />
      )}
    </div>
  );
}
