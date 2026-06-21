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
import { groupLeasesByInstrument } from './owner-lease-grouping';

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
  /** Distinct focused tracts whose cards link to this owner (quick stat). */
  tractCount?: number;
  readOnly?: boolean;
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
  tractCount,
  readOnly = false,
}: OwnerDetailPanelProps) {
  const tabBaseId = `owner-${owner.id}`;
  const activePanelId = `${tabBaseId}-${tab}-panel`;

  const initials = (() => {
    const words = (owner.name || '?').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  })();
  // Count distinct lease INSTRUMENTS, not records: one instrument spanning N
  // tracts is stored as N per-tract records but shows as one collapsed card.
  const leaseInstrumentCount = groupLeasesByInstrument(leases).length;
  const stats: { label: string; value: number }[] = [
    ...(typeof tractCount === 'number' ? [{ label: 'Tracts', value: tractCount }] : []),
    { label: 'Leases', value: leaseInstrumentCount },
    { label: 'Contacts', value: contacts.length },
    { label: 'Documents', value: docs.length },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* CRM profile header */}
      <div className="flex items-center gap-3.5 rounded-xl border border-ledger-line bg-parchment-light p-4">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] bg-leather font-display text-lg font-bold text-[#fff6ec]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] font-bold text-ink">
            {owner.name || 'Unnamed Owner'}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[owner.entityType, owner.county && `${owner.county} Co.`, owner.prospect]
              .filter(Boolean)
              .map((chip) => (
                <span
                  key={String(chip)}
                  className="rounded-md border border-ledger-line px-2 py-0.5 text-[10px] font-semibold text-ink-soft"
                >
                  {chip}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[10px] border border-ledger-line bg-parchment-light px-3 py-2.5"
          >
            <div className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-light">
              {stat.label}
            </div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums text-ink">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Underline tabs */}
      <div
        role="tablist"
        aria-label={`${owner.name || 'Owner'} sections`}
        className="mt-4 flex gap-0.5 border-b border-ledger-line"
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
            className={`-mb-px border-b-2 px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              tab === item.id
                ? 'border-leather text-ink'
                : 'border-transparent text-ink-light hover:text-ink'
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
        className="flex-1 overflow-auto py-4"
      >
        {tab === 'info' && (
          <OwnerInfoTab
            owner={owner}
            onSave={onSaveOwner}
            onDelete={onDeleteOwner}
            readOnly={readOnly}
          />
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
            readOnly={readOnly}
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
            readOnly={readOnly}
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
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
}
