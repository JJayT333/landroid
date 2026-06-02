import type {
  ContactLog,
  Lease,
  Owner,
  OwnerDoc,
  OwnerDocMeta,
  OwnerPanelTab,
} from '../../types/owner';
import OwnerContactsTab from './OwnerContactsTab';
import OwnerDocsTab from './OwnerDocsTab';
import OwnerInfoTab from './OwnerInfoTab';
import OwnerLeasesTab from './OwnerLeasesTab';
import type { OwnerLeaseDeskMapTarget } from './owner-lease-deskmap';

const tabs: { id: OwnerPanelTab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'leases', label: 'Leases' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'docs', label: 'Docs' },
];

interface OwnerDetailPanelProps {
  workspaceId: string;
  owner: Owner;
  leases: Lease[];
  contacts: ContactLog[];
  docs: OwnerDocMeta[];
  tab: OwnerPanelTab;
  onChangeTab: (tab: OwnerPanelTab) => void;
  onSaveOwner: (fields: Partial<Owner>) => Promise<void>;
  onDeleteOwner: () => Promise<void>;
  onAddLease: (lease: Lease) => Promise<void>;
  onUpdateLease: (id: string, fields: Partial<Lease>) => Promise<void>;
  onRemoveLease: (id: string) => Promise<void>;
  getDeskMapTargetsForLease: (leaseId: string) => OwnerLeaseDeskMapTarget[];
  onOpenDeskMapLeaseTarget: (
    lease: Lease,
    target: OwnerLeaseDeskMapTarget
  ) => void;
  onAddContact: (contact: ContactLog) => Promise<void>;
  onUpdateContact: (id: string, fields: Partial<ContactLog>) => Promise<void>;
  onRemoveContact: (id: string) => Promise<void>;
  onAddDoc: (doc: OwnerDoc) => Promise<void>;
  onUpdateDoc: (id: string, fields: Partial<OwnerDoc>) => Promise<void>;
  onRemoveDoc: (id: string) => Promise<void>;
}

export default function OwnerDetailPanel({
  workspaceId,
  owner,
  leases,
  contacts,
  docs,
  tab,
  onChangeTab,
  onSaveOwner,
  onDeleteOwner,
  onAddLease,
  onUpdateLease,
  onRemoveLease,
  getDeskMapTargetsForLease,
  onOpenDeskMapLeaseTarget,
  onAddContact,
  onUpdateContact,
  onRemoveContact,
  onAddDoc,
  onUpdateDoc,
  onRemoveDoc,
}: OwnerDetailPanelProps) {
  const tabBaseId = `owner-${owner.id}`;
  const activePanelId = `${tabBaseId}-${tab}-panel`;

  return (
    <div className="h-full flex flex-col rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-ledger-line bg-ledger">
        <div className="text-xl font-display font-bold text-ink">
          {owner.name || 'Unnamed Owner'}
        </div>
        <div className="text-sm text-ink-light">
          {[owner.entityType, owner.county, owner.prospect].filter(Boolean).join(' • ') || 'No owner details yet'}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={`${owner.name || 'Owner'} sections`}
        className="px-4 py-3 border-b border-ledger-line bg-parchment-dark/50 flex gap-2"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${tabBaseId}-${item.id}-tab`}
            aria-selected={tab === item.id}
            aria-controls={`${tabBaseId}-${item.id}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => onChangeTab(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === item.id
                ? 'bg-leather text-parchment'
                : 'text-ink-light hover:bg-ledger'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={`${tabBaseId}-${tab}-tab`}
        className="flex-1 overflow-auto p-5"
      >
        {tab === 'info' && (
          <OwnerInfoTab owner={owner} onSave={onSaveOwner} onDelete={onDeleteOwner} />
        )}
        {tab === 'leases' && (
          <OwnerLeasesTab
            workspaceId={workspaceId}
            ownerId={owner.id}
            leases={leases}
            onAdd={onAddLease}
            onUpdate={onUpdateLease}
            onRemove={onRemoveLease}
            getDeskMapTargetsForLease={getDeskMapTargetsForLease}
            onOpenDeskMapLeaseTarget={onOpenDeskMapLeaseTarget}
          />
        )}
        {tab === 'contacts' && (
          <OwnerContactsTab
            workspaceId={workspaceId}
            ownerId={owner.id}
            contacts={contacts}
            onAdd={onAddContact}
            onUpdate={onUpdateContact}
            onRemove={onRemoveContact}
          />
        )}
        {tab === 'docs' && (
          <OwnerDocsTab
            workspaceId={workspaceId}
            ownerId={owner.id}
            docs={docs}
            leases={leases}
            onAdd={onAddDoc}
            onUpdate={onUpdateDoc}
            onRemove={onRemoveDoc}
          />
        )}
      </div>
    </div>
  );
}
