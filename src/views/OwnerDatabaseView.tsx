/** Owner Database — list-detail split view for landowner management. */
import { useState } from 'react';
import { useOwnerStore } from '../store/owner-store';
import { createBlankOwner } from '../types/owner';
import { downloadOwnerExport } from '../storage/owner-export';
import OwnerListPanel from '../components/owners/OwnerListPanel';
import OwnerDetailPanel from '../components/owners/OwnerDetailPanel';

export default function OwnerDatabaseView() {
  const owners = useOwnerStore((s) => s.owners);
  const selectedOwnerId = useOwnerStore((s) => s.selectedOwnerId);
  const addOwner = useOwnerStore((s) => s.addOwner);
  const selectOwner = useOwnerStore((s) => s.selectOwner);
  const [exporting, setExporting] = useState(false);

  const selectedOwner = owners.find((o) => o.id === selectedOwnerId) ?? null;

  const handleNewOwner = async () => {
    const owner = createBlankOwner({ name: 'New Owner' });
    await addOwner(owner);
    await selectOwner(owner.id);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadOwnerExport();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console for details.');
    }
    setExporting(false);
  };

  return (
    <div className="flex h-full">
      {/* Left panel — owner list */}
      <div className="w-[340px] shrink-0">
        <OwnerListPanel
          onNewOwner={handleNewOwner}
          onExport={handleExport}
        />
      </div>

      {/* Right panel — detail or empty state */}
      <div className="flex-1 min-w-0">
        {selectedOwner ? (
          <OwnerDetailPanel owner={selectedOwner} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="text-5xl text-ink-light/20">{'\uD83D\uDCCB'}</div>
              <h2 className="text-xl font-display font-bold text-ink/40">Owner Database</h2>
              <p className="text-sm text-ink-light/50 max-w-sm">
                {owners.length === 0
                  ? 'Get started by adding your first landowner. All owner info, leases, contacts, and documents in one place.'
                  : 'Select an owner from the list to view their details, leases, and contact history.'}
              </p>
              {owners.length === 0 && (
                <button
                  onClick={handleNewOwner}
                  className="mt-3 px-5 py-2.5 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
                >
                  + Add First Owner
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export loading overlay */}
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
          <div className="bg-parchment rounded-xl shadow-xl px-6 py-4 text-sm font-medium text-ink">
            Exporting to Excel...
          </div>
        </div>
      )}
    </div>
  );
}
