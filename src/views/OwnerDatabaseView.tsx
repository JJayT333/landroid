import { useEffect } from 'react';
import OwnerDetailPanel from '../components/owners/OwnerDetailPanel';
import { useOwnerStore } from '../store/owner-store';
import { createBlankOwner } from '../types/owner';

export default function OwnerDatabaseView() {
  const workspaceId = useOwnerStore((state) => state.workspaceId);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const contacts = useOwnerStore((state) => state.contacts);
  const docs = useOwnerStore((state) => state.docs);
  const selectedOwnerId = useOwnerStore((state) => state.selectedOwnerId);
  const selectOwner = useOwnerStore((state) => state.selectOwner);
  const addOwner = useOwnerStore((state) => state.addOwner);
  const updateOwner = useOwnerStore((state) => state.updateOwner);
  const removeOwner = useOwnerStore((state) => state.removeOwner);
  const addLease = useOwnerStore((state) => state.addLease);
  const updateLease = useOwnerStore((state) => state.updateLease);
  const removeLease = useOwnerStore((state) => state.removeLease);
  const addContact = useOwnerStore((state) => state.addContact);
  const updateContact = useOwnerStore((state) => state.updateContact);
  const removeContact = useOwnerStore((state) => state.removeContact);
  const addDoc = useOwnerStore((state) => state.addDoc);
  const updateDoc = useOwnerStore((state) => state.updateDoc);
  const removeDoc = useOwnerStore((state) => state.removeDoc);

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId) ?? null;

  useEffect(() => {
    if (!selectedOwnerId && owners.length > 0) {
      selectOwner(owners[0].id);
    }
  }, [owners, selectOwner, selectedOwnerId]);

  return (
    <div className="h-full grid grid-cols-[320px,1fr] gap-4 p-4 bg-parchment-dark/30">
      <aside className="rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-ledger-line bg-ledger flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-display font-bold text-ink">Owners</div>
            <div className="text-xs text-ink-light">{owners.length} records</div>
          </div>
          <button
            type="button"
            disabled={!workspaceId}
            onClick={async () => {
              if (!workspaceId) return;
              await addOwner(createBlankOwner(workspaceId, { name: 'New Owner' }));
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
          >
            + New Owner
          </button>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-10rem)]">
          {owners.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-light">
              No owner records yet. Create one here or from a desk map node.
            </div>
          ) : (
            owners.map((owner) => (
              <button
                key={owner.id}
                type="button"
                onClick={() => selectOwner(owner.id)}
                className={`w-full text-left px-4 py-3 border-b border-ledger-line transition-colors ${
                  selectedOwnerId === owner.id ? 'bg-leather/10' : 'hover:bg-ledger'
                }`}
              >
                <div className="text-sm font-semibold text-ink">
                  {owner.name || 'Unnamed Owner'}
                </div>
                <div className="text-xs text-ink-light">
                  {[owner.entityType, owner.county, owner.prospect]
                    .filter(Boolean)
                    .join(' • ') || 'No details yet'}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-w-0">
        {selectedOwner && workspaceId ? (
          <OwnerDetailPanel
            key={selectedOwner.id}
            workspaceId={workspaceId}
            owner={selectedOwner}
            leases={leases.filter((lease) => lease.ownerId === selectedOwner.id)}
            contacts={contacts.filter((contact) => contact.ownerId === selectedOwner.id)}
            docs={docs.filter((doc) => doc.ownerId === selectedOwner.id)}
            onSaveOwner={(fields) => updateOwner(selectedOwner.id, fields)}
            onDeleteOwner={() => removeOwner(selectedOwner.id)}
            onAddLease={addLease}
            onUpdateLease={updateLease}
            onRemoveLease={removeLease}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onRemoveContact={removeContact}
            onAddDoc={addDoc}
            onUpdateDoc={updateDoc}
            onRemoveDoc={removeDoc}
          />
        ) : (
          <div className="h-full rounded-xl border border-dashed border-ledger-line bg-parchment flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-xl font-display font-bold text-ink">
                No owner selected
              </div>
              <div className="text-sm text-ink-light mt-2">
                Choose an owner on the left, or create a new one to begin.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
