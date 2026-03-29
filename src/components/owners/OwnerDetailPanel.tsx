/** Right detail panel — owner header + tabbed content. */
import { useOwnerStore, type DetailTab } from '../../store/owner-store';
import type { Owner } from '../../types/owner';
import OwnerDetailHeader from './OwnerDetailHeader';
import OwnerInfoTab from './OwnerInfoTab';
import OwnerLeasesTab from './OwnerLeasesTab';
import OwnerContactsTab from './OwnerContactsTab';
import OwnerDocsTab from './OwnerDocsTab';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'leases', label: 'Leases' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'documents', label: 'Documents' },
];

interface Props {
  owner: Owner;
}

export default function OwnerDetailPanel({ owner }: Props) {
  const detailTab = useOwnerStore((s) => s.detailTab);
  const setDetailTab = useOwnerStore((s) => s.setDetailTab);
  const leaseCount = useOwnerStore((s) => s.activeLeases.length);
  const contactCount = useOwnerStore((s) => s.activeContacts.length);
  const docCount = useOwnerStore((s) => s.activeDocs.length);

  const badgeCounts: Record<DetailTab, number | null> = {
    info: null,
    leases: leaseCount || null,
    contacts: contactCount || null,
    documents: docCount || null,
  };

  return (
    <div className="flex flex-col h-full bg-parchment">
      <OwnerDetailHeader owner={owner} />

      {/* Tab bar */}
      <div className="flex border-b border-ledger-line px-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDetailTab(tab.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors relative
              ${detailTab === tab.id
                ? 'text-leather'
                : 'text-ink-light hover:text-ink'}
            `}
          >
            {tab.label}
            {badgeCounts[tab.id] != null && (
              <span className="ml-1.5 text-[10px] font-semibold bg-leather/10 text-leather px-1.5 py-0.5 rounded-full">
                {badgeCounts[tab.id]}
              </span>
            )}
            {detailTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-leather rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {detailTab === 'info' && <OwnerInfoTab owner={owner} />}
        {detailTab === 'leases' && <OwnerLeasesTab ownerId={owner.id} />}
        {detailTab === 'contacts' && <OwnerContactsTab ownerId={owner.id} />}
        {detailTab === 'documents' && <OwnerDocsTab ownerId={owner.id} />}
      </div>
    </div>
  );
}
