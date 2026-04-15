import { useEffect, useMemo, useState } from 'react';
import FormField from '../components/shared/FormField';
import {
  buildFederalLeaseSearchText,
  buildFederalLeaseSummary,
  federalLeaseMatchesSearch,
  getFederalLeaseExpirationBucket,
  isFederalLeasingRecord,
  isFederalTargetRecord,
  sortFederalLeaseRecordsByUrgency,
  type FederalLeaseSearchLabels,
} from '../federal-leasing/federal-lease-tracking';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  RESEARCH_PROJECT_RECORD_TYPE_OPTIONS,
  RESEARCH_PROJECT_STATUS_OPTIONS,
  createBlankResearchProjectRecord,
  type ResearchProjectRecord,
  type ResearchProjectRecordType,
  type ResearchProjectStatus,
} from '../types/research';

type FederalLeasingTab =
  | 'inventory'
  | 'targets'
  | 'expirations'
  | 'maps'
  | 'sources';

interface SelectOption {
  id: string;
  label: string;
}

const FEDERAL_LEASING_TABS: Array<{
  id: FederalLeasingTab;
  label: string;
  description: string;
}> = [
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'All federal leasing records in this workspace.',
  },
  {
    id: 'targets',
    label: 'Targets',
    description: 'Potential leases, nominated lands, and acquisition targets.',
  },
  {
    id: 'expirations',
    label: 'Expirations',
    description: 'Expired, upcoming, or missing expiration tracking.',
  },
  {
    id: 'maps',
    label: 'Map Evidence',
    description: 'Records tied to map assets, regions, Desk Maps, or title cards.',
  },
  {
    id: 'sources',
    label: 'Source Packets',
    description: 'Records with supporting sources, imports, or packet status notes.',
  },
];

function mapFromOptions(options: SelectOption[]) {
  return new Map(options.map((option) => [option.id, option.label]));
}

function labelFromMap(labels: Map<string, string>, id: string | null | undefined) {
  return id ? labels.get(id) ?? id : '';
}

function labelsFromIds(labels: Map<string, string>, ids: string[]) {
  return ids.map((id) => labelFromMap(labels, id)).filter(Boolean);
}

function labelForFederalRecord(record: ResearchProjectRecord) {
  return (
    record.name ||
    record.mlrsSerial ||
    record.legacySerial ||
    record.serialOrReference ||
    'Untitled Federal Record'
  );
}

function serialSummary(record: ResearchProjectRecord) {
  return [
    record.mlrsSerial ? `MLRS ${record.mlrsSerial}` : '',
    record.legacySerial ? `Legacy ${record.legacySerial}` : '',
    record.serialOrReference && !record.mlrsSerial && !record.legacySerial
      ? record.serialOrReference
      : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

function recordMatchesTab(
  record: ResearchProjectRecord,
  tab: FederalLeasingTab,
  asOfDate: Date
) {
  if (tab === 'inventory') return true;
  if (tab === 'targets') return isFederalTargetRecord(record);
  if (tab === 'expirations') {
    return getFederalLeaseExpirationBucket(record, asOfDate) !== 'future';
  }
  if (tab === 'maps') {
    return Boolean(
      record.mapAssetId || record.mapRegionId || record.deskMapId || record.nodeId
    );
  }
  return Boolean(
    record.sourceIds.length > 0 ||
      record.importId ||
      record.sourcePacketStatus.trim().length > 0
  );
}

function formatExpiration(record: ResearchProjectRecord, asOfDate: Date) {
  const bucket = getFederalLeaseExpirationBucket(record, asOfDate);
  if (bucket === 'missing') return 'Expiration missing';
  if (bucket === 'expired') return `Expired ${record.expirationDate}`;
  if (bucket === 'upcoming') return `Upcoming ${record.expirationDate}`;
  return `Expires ${record.expirationDate}`;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NullableSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string | null;
  options: SelectOption[];
  emptyLabel: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
      />
    </label>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((candidate) => candidate !== id)
    : [...ids, id];
}

function LinkCheckboxes({
  title,
  ids,
  options,
  emptyText,
  onChange,
}: {
  title: string;
  ids: string[];
  options: SelectOption[];
  emptyText: string;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-ledger-line bg-parchment-dark/30 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-light">
        {title}
      </div>
      {options.length === 0 ? (
        <div className="mt-2 text-sm text-ink-light">{emptyText}</div>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ids.includes(option.id)}
                onChange={() => onChange(toggleId(ids, option.id))}
                className="h-4 w-4 rounded border-ledger-line text-leather focus:ring-leather"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-ledger-line bg-parchment px-3 py-3">
      <div className="text-2xl font-display font-bold text-ink">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
        {label}
      </div>
      <div className="mt-1 text-xs text-ink-light">{detail}</div>
    </div>
  );
}

export default function FederalLeasingView() {
  const workspaceId = useResearchStore((state) => state.workspaceId);
  const projectRecords = useResearchStore((state) => state.projectRecords);
  const sources = useResearchStore((state) => state.sources);
  const imports = useResearchStore((state) => state.imports);
  const addProjectRecord = useResearchStore((state) => state.addProjectRecord);
  const updateProjectRecord = useResearchStore((state) => state.updateProjectRecord);
  const removeProjectRecord = useResearchStore((state) => state.removeProjectRecord);

  const mapAssets = useMapStore((state) => state.mapAssets);
  const mapRegions = useMapStore((state) => state.mapRegions);
  const setFeaturedAsset = useMapStore((state) => state.setFeaturedAsset);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const selectOwner = useOwnerStore((state) => state.selectOwner);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const setActiveDeskMap = useWorkspaceStore((state) => state.setActiveDeskMap);
  const setActiveNode = useWorkspaceStore((state) => state.setActiveNode);
  const setView = useUIStore((state) => state.setView);

  const [tab, setTab] = useState<FederalLeasingTab>('inventory');
  const [search, setSearch] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const asOfDate = useMemo(() => new Date(), []);

  const sourceOptions = sources.map((source) => ({
    id: source.id,
    label: source.title || source.citation || source.id,
  }));
  const sourceLabelById = useMemo(() => mapFromOptions(sourceOptions), [sourceOptions]);
  const importOptions = imports.map((researchImport) => ({
    id: researchImport.id,
    label: researchImport.title || researchImport.fileName || researchImport.id,
  }));
  const importLabelById = useMemo(() => mapFromOptions(importOptions), [importOptions]);
  const mapAssetOptions = mapAssets.map((asset) => ({
    id: asset.id,
    label: [asset.title || asset.fileName || asset.id, asset.kind]
      .filter(Boolean)
      .join(' • '),
  }));
  const mapAssetLabelById = useMemo(
    () => mapFromOptions(mapAssetOptions),
    [mapAssetOptions]
  );
  const mapRegionOptions = mapRegions.map((region) => ({
    id: region.id,
    label: [
      mapAssets.find((asset) => asset.id === region.assetId)?.title ??
        mapAssets.find((asset) => asset.id === region.assetId)?.fileName ??
        'Unlinked map',
      region.title || region.shortLabel || region.id,
    ].join(' / '),
  }));
  const mapRegionLabelById = useMemo(
    () => mapFromOptions(mapRegionOptions),
    [mapRegionOptions]
  );
  const deskMapOptions = deskMaps.map((deskMap) => ({
    id: deskMap.id,
    label: deskMap.name || deskMap.id,
  }));
  const deskMapLabelById = useMemo(() => mapFromOptions(deskMapOptions), [deskMapOptions]);
  const nodeOptions = nodes.map((node) => ({
    id: node.id,
    label: node.grantee || node.docNo || node.id,
  }));
  const nodeLabelById = useMemo(() => mapFromOptions(nodeOptions), [nodeOptions]);
  const ownerOptions = owners.map((owner) => ({
    id: owner.id,
    label: owner.name || owner.id,
  }));
  const ownerLabelById = useMemo(() => mapFromOptions(ownerOptions), [ownerOptions]);
  const leaseOptions = leases.map((lease) => ({
    id: lease.id,
    label: lease.leaseName || lease.lessee || lease.docNo || lease.id,
  }));
  const leaseLabelById = useMemo(() => mapFromOptions(leaseOptions), [leaseOptions]);

  const labelsForRecord = (record: ResearchProjectRecord): FederalLeaseSearchLabels => ({
    sourceLabels: labelsFromIds(sourceLabelById, record.sourceIds),
    mapAssetLabel: labelFromMap(mapAssetLabelById, record.mapAssetId),
    mapRegionLabel: labelFromMap(mapRegionLabelById, record.mapRegionId),
    deskMapLabel: labelFromMap(deskMapLabelById, record.deskMapId),
    nodeLabel: labelFromMap(nodeLabelById, record.nodeId),
    ownerLabel: labelFromMap(ownerLabelById, record.ownerId),
    leaseLabel: labelFromMap(leaseLabelById, record.leaseId),
    importLabel: labelFromMap(importLabelById, record.importId),
  });

  const federalRecords = useMemo(
    () =>
      sortFederalLeaseRecordsByUrgency(
        projectRecords.filter(isFederalLeasingRecord),
        asOfDate
      ),
    [asOfDate, projectRecords]
  );
  const summary = useMemo(
    () => buildFederalLeaseSummary(federalRecords, asOfDate),
    [asOfDate, federalRecords]
  );
  const visibleRecords = useMemo(
    () =>
      federalRecords.filter(
        (record) =>
          recordMatchesTab(record, tab, asOfDate) &&
          federalLeaseMatchesSearch(record, search, labelsForRecord(record))
      ),
    [
      asOfDate,
      deskMapLabelById,
      federalRecords,
      importLabelById,
      leaseLabelById,
      mapAssetLabelById,
      mapRegionLabelById,
      nodeLabelById,
      ownerLabelById,
      search,
      sourceLabelById,
      tab,
    ]
  );

  useEffect(() => {
    if (visibleRecords.length === 0) {
      setSelectedRecordId(null);
      return;
    }
    if (
      selectedRecordId &&
      visibleRecords.some((record) => record.id === selectedRecordId)
    ) {
      return;
    }
    setSelectedRecordId(visibleRecords[0]?.id ?? null);
  }, [selectedRecordId, visibleRecords]);

  const selectedRecord =
    projectRecords.find((record) => record.id === selectedRecordId) ?? null;

  const createFederalRecord = async (
    overrides: Partial<ResearchProjectRecord>
  ) => {
    if (!workspaceId) return;
    const record = createBlankResearchProjectRecord(workspaceId, {
      jurisdiction: 'Federal / BLM',
      ...overrides,
    });
    await addProjectRecord(record);
    setSelectedRecordId(record.id);
  };

  const updateSelectedRecord = (
    fields: Partial<ResearchProjectRecord>
  ): Promise<void> => {
    if (!selectedRecord) return Promise.resolve();
    return updateProjectRecord(selectedRecord.id, fields);
  };

  const openDeskMapLink = () => {
    if (!selectedRecord?.deskMapId) return;
    setActiveDeskMap(selectedRecord.deskMapId);
    if (selectedRecord.nodeId) {
      setActiveNode(selectedRecord.nodeId);
    }
    setView('chart');
  };

  const openOwnerLink = () => {
    if (!selectedRecord?.ownerId) return;
    selectOwner(selectedRecord.ownerId);
    setView('owners');
  };

  const openMapLink = async () => {
    if (selectedRecord?.mapAssetId) {
      await setFeaturedAsset(selectedRecord.mapAssetId);
    }
    setView('maps');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-parchment-dark/30 p-4">
      <header className="rounded-xl border border-ledger-line bg-parchment shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ledger-line bg-ledger px-4 py-4">
          <div className="min-w-0">
            <div className="text-lg font-display font-bold text-ink">
              Federal Leasing
            </div>
            <div className="mt-1 max-w-3xl text-sm text-ink-light">
              Reference-only lease inventory, expiration tracking, potential targets,
              source packets, and map evidence for federal leasing work.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() =>
                createFederalRecord({
                  name: 'New Federal Lease',
                  recordType: 'Federal Lease',
                  status: 'Current',
                  sourcePacketStatus: 'Needs packet',
                })
              }
              className="rounded-lg border border-leather/30 px-3 py-2 text-xs font-semibold text-leather transition-colors hover:bg-leather/10 disabled:opacity-50"
            >
              Add Existing Federal Lease
            </button>
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() =>
                createFederalRecord({
                  name: 'New Federal Target',
                  recordType: 'Acquisition Target',
                  status: 'Target',
                  acquisitionStatus: 'Potential',
                  sourcePacketStatus: 'Needs review',
                })
              }
              className="rounded-lg border border-leather/30 px-3 py-2 text-xs font-semibold text-leather transition-colors hover:bg-leather/10 disabled:opacity-50"
            >
              Add Potential Target
            </button>
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() =>
                createFederalRecord({
                  name: 'New Unit / CA Reference',
                  recordType: 'Unit / CA',
                  status: 'Under Review',
                  sourcePacketStatus: 'Reference only',
                })
              }
              className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-parchment-dark disabled:opacity-50"
            >
              Add Unit / CA Reference
            </button>
            <button
              type="button"
              disabled={!workspaceId}
              onClick={() =>
                createFederalRecord({
                  name: 'New Mapped Federal Tract',
                  recordType: 'Mapped Tract',
                  status: 'Under Review',
                  sourcePacketStatus: 'Needs map/source link',
                })
              }
              className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-parchment-dark disabled:opacity-50"
            >
              Add Mapped Tract
            </button>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-7">
          <SummaryTile label="Current" value={summary.current} detail="Existing federal leases" />
          <SummaryTile label="Targets" value={summary.targets} detail="Potential or acquisition work" />
          <SummaryTile label="Under Review" value={summary.underReview} detail="Needs source/title review" />
          <SummaryTile label="Expired" value={summary.expired} detail="Past expiration date" />
          <SummaryTile label="Upcoming" value={summary.upcomingExpirations} detail="Expires within 180 days" />
          <SummaryTile label="Missing Dates" value={summary.missingExpirations} detail="No expiration entered" />
          <SummaryTile label="Next Actions" value={summary.nextActions} detail="Follow-up text or date" />
        </div>
        <div className="border-t border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Federal Leasing records are reference and tracking records only. They do not
          affect Texas title, leasehold, payout, or transfer-order math.
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ledger-line bg-parchment shadow-sm">
          <div className="border-b border-ledger-line bg-ledger px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">Federal Records</div>
                <div className="text-xs text-ink-light">
                  Showing {visibleRecords.length}/{federalRecords.length}
                </div>
              </div>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-lg border border-ledger-line px-3 py-1.5 text-xs font-semibold text-ink-light transition-colors hover:bg-parchment"
                >
                  Clear
                </button>
              )}
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Search Federal Leasing
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Serial, county, prospect, source..."
                className="w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-leather"
              />
            </label>
          </div>

          <div className="border-b border-ledger-line bg-parchment-dark/40 px-3 py-3">
            <div className="grid gap-2">
              {FEDERAL_LEASING_TABS.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setTab(candidate.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    tab === candidate.id
                      ? 'border-leather bg-leather/10'
                      : 'border-ledger-line bg-parchment hover:bg-ledger'
                  }`}
                >
                  <div className="text-sm font-semibold text-ink">{candidate.label}</div>
                  <div className="mt-0.5 text-xs text-ink-light">
                    {candidate.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {federalRecords.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-light">
                No federal leasing records yet. Add an existing lease or target to begin.
              </div>
            ) : visibleRecords.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-light">
                <div className="font-semibold text-ink">No matching records.</div>
                <div className="mt-1">
                  Try another tab or search by serial, county, prospect, party, source,
                  or map label.
                </div>
              </div>
            ) : (
              visibleRecords.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className={`w-full border-b border-ledger-line px-4 py-3 text-left transition-colors ${
                    selectedRecordId === record.id ? 'bg-leather/10' : 'hover:bg-ledger'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">
                        {labelForFederalRecord(record)}
                      </div>
                      <div className="mt-1 text-xs text-ink-light">
                        {[record.recordType, record.status].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-ledger-line bg-parchment px-2 py-0.5 text-[10px] font-semibold text-ink-light">
                      {getFederalLeaseExpirationBucket(record, asOfDate)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-ink-light">
                    {[serialSummary(record), record.county || record.prospectArea]
                      .filter(Boolean)
                      .join(' • ') || 'No serial or location yet'}
                  </div>
                  <div className="mt-1 text-xs text-ink-light">
                    {formatExpiration(record, asOfDate)}
                  </div>
                  {record.nextAction && (
                    <div className="mt-2 text-sm text-ink">
                      {record.nextAction}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-auto rounded-xl border border-ledger-line bg-parchment shadow-sm">
          {selectedRecord ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ledger-line pb-4">
                <div>
                  <div className="text-xl font-display font-bold text-ink">
                    {labelForFederalRecord(selectedRecord)}
                  </div>
                  <div className="mt-1 text-sm text-ink-light">
                    {[
                      selectedRecord.recordType,
                      selectedRecord.status,
                      serialSummary(selectedRecord),
                      formatExpiration(selectedRecord, asOfDate),
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!selectedRecord.deskMapId}
                    onClick={openDeskMapLink}
                    className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-ledger disabled:opacity-50"
                  >
                    Open Desk Map
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRecord.ownerId}
                    onClick={openOwnerLink}
                    className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-ledger disabled:opacity-50"
                  >
                    Open Owner
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRecord.mapAssetId}
                    onClick={() => void openMapLink()}
                    className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-ledger disabled:opacity-50"
                  >
                    Open Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('research')}
                    className="rounded-lg border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light transition-colors hover:bg-ledger"
                  >
                    Open Research
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this federal leasing record?')) return;
                      await removeProjectRecord(selectedRecord.id);
                    }}
                    className="rounded-lg border border-seal/30 px-3 py-2 text-xs font-semibold text-seal transition-colors hover:bg-seal/10"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Reference only: this record tracks lease facts, deadlines, maps, and
                source support without running federal royalty, ONRR, payout, or CA/TPF
                calculations.
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  label="Name"
                  value={selectedRecord.name}
                  onChange={(value) => void updateSelectedRecord({ name: value })}
                />
                <FormField
                  label="Serial / Reference"
                  value={selectedRecord.serialOrReference}
                  onChange={(value) =>
                    void updateSelectedRecord({ serialOrReference: value })
                  }
                />
                <FormField
                  label="Legacy Serial"
                  value={selectedRecord.legacySerial}
                  onChange={(value) => void updateSelectedRecord({ legacySerial: value })}
                />
                <FormField
                  label="MLRS Serial"
                  value={selectedRecord.mlrsSerial}
                  onChange={(value) => void updateSelectedRecord({ mlrsSerial: value })}
                />
                <SelectField<ResearchProjectRecordType>
                  label="Record Type"
                  value={selectedRecord.recordType}
                  options={RESEARCH_PROJECT_RECORD_TYPE_OPTIONS}
                  onChange={(value) => void updateSelectedRecord({ recordType: value })}
                />
                <SelectField<ResearchProjectStatus>
                  label="Status"
                  value={selectedRecord.status}
                  options={RESEARCH_PROJECT_STATUS_OPTIONS}
                  onChange={(value) => void updateSelectedRecord({ status: value })}
                />
                <FormField
                  label="Acquisition Status"
                  value={selectedRecord.acquisitionStatus}
                  onChange={(value) =>
                    void updateSelectedRecord({ acquisitionStatus: value })
                  }
                />
                <FormField
                  label="Priority"
                  value={selectedRecord.priority}
                  onChange={(value) => void updateSelectedRecord({ priority: value })}
                />
                <FormField
                  label="Source Packet Status"
                  value={selectedRecord.sourcePacketStatus}
                  onChange={(value) =>
                    void updateSelectedRecord({ sourcePacketStatus: value })
                  }
                />
                <FormField
                  label="Lessee / Applicant"
                  value={selectedRecord.lesseeOrApplicant}
                  onChange={(value) =>
                    void updateSelectedRecord({ lesseeOrApplicant: value })
                  }
                />
                <FormField
                  label="Operator"
                  value={selectedRecord.operator}
                  onChange={(value) => void updateSelectedRecord({ operator: value })}
                />
                <FormField
                  label="State"
                  value={selectedRecord.state}
                  onChange={(value) => void updateSelectedRecord({ state: value })}
                />
                <FormField
                  label="County"
                  value={selectedRecord.county}
                  onChange={(value) => void updateSelectedRecord({ county: value })}
                />
                <FormField
                  label="Prospect Area"
                  value={selectedRecord.prospectArea}
                  onChange={(value) =>
                    void updateSelectedRecord({ prospectArea: value })
                  }
                />
                <FormField
                  label="Acres"
                  value={selectedRecord.acres}
                  onChange={(value) => void updateSelectedRecord({ acres: value })}
                />
                <FormField
                  label="Effective Date"
                  type="date"
                  value={selectedRecord.effectiveDate}
                  onChange={(value) =>
                    void updateSelectedRecord({ effectiveDate: value })
                  }
                />
                <FormField
                  label="Expiration Date"
                  type="date"
                  value={selectedRecord.expirationDate}
                  onChange={(value) =>
                    void updateSelectedRecord({ expirationDate: value })
                  }
                />
                <FormField
                  label="Primary Term"
                  value={selectedRecord.primaryTerm}
                  onChange={(value) => void updateSelectedRecord({ primaryTerm: value })}
                />
                <FormField
                  label="Next Action Date"
                  type="date"
                  value={selectedRecord.nextActionDate}
                  onChange={(value) =>
                    void updateSelectedRecord({ nextActionDate: value })
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <TextAreaField
                  label="Legal Description / Tract Notes"
                  value={selectedRecord.legalDescription}
                  rows={5}
                  onChange={(value) =>
                    void updateSelectedRecord({ legalDescription: value })
                  }
                />
                <TextAreaField
                  label="Next Action"
                  value={selectedRecord.nextAction}
                  rows={5}
                  onChange={(value) => void updateSelectedRecord({ nextAction: value })}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <NullableSelect
                  label="Map Asset"
                  value={selectedRecord.mapAssetId}
                  options={mapAssetOptions}
                  emptyLabel="No map asset link"
                  onChange={(mapAssetId) =>
                    void updateSelectedRecord({ mapAssetId })
                  }
                />
                <NullableSelect
                  label="Map Region"
                  value={selectedRecord.mapRegionId}
                  options={mapRegionOptions}
                  emptyLabel="No map region link"
                  onChange={(mapRegionId) => {
                    const regionAssetId =
                      mapRegions.find((region) => region.id === mapRegionId)?.assetId ??
                      selectedRecord.mapAssetId;
                    void updateSelectedRecord({
                      mapAssetId: regionAssetId,
                      mapRegionId,
                    });
                  }}
                />
                <NullableSelect
                  label="Desk Map"
                  value={selectedRecord.deskMapId}
                  options={deskMapOptions}
                  emptyLabel="No desk map link"
                  onChange={(deskMapId) => void updateSelectedRecord({ deskMapId })}
                />
                <NullableSelect
                  label="Title / Lease Card"
                  value={selectedRecord.nodeId}
                  options={nodeOptions}
                  emptyLabel="No card link"
                  onChange={(nodeId) => void updateSelectedRecord({ nodeId })}
                />
                <NullableSelect
                  label="Owner"
                  value={selectedRecord.ownerId}
                  options={ownerOptions}
                  emptyLabel="No owner link"
                  onChange={(ownerId) => void updateSelectedRecord({ ownerId })}
                />
                <NullableSelect
                  label="Lease"
                  value={selectedRecord.leaseId}
                  options={leaseOptions}
                  emptyLabel="No lease link"
                  onChange={(leaseId) => void updateSelectedRecord({ leaseId })}
                />
                <NullableSelect
                  label="Import File"
                  value={selectedRecord.importId}
                  options={importOptions}
                  emptyLabel="No import link"
                  onChange={(importId) => void updateSelectedRecord({ importId })}
                />
              </div>

              <LinkCheckboxes
                title="Supporting Sources"
                ids={selectedRecord.sourceIds}
                options={sourceOptions}
                emptyText="No Research sources yet. Add source records in Research, then link them here."
                onChange={(sourceIds) => void updateSelectedRecord({ sourceIds })}
              />

              <TextAreaField
                label="Notes"
                value={selectedRecord.notes}
                rows={5}
                onChange={(value) => void updateSelectedRecord({ notes: value })}
              />

              {search.trim() && (
                <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-2 text-xs text-ink-light">
                  Search index preview:{' '}
                  {buildFederalLeaseSearchText(
                    selectedRecord,
                    labelsForRecord(selectedRecord)
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center">
              <div>
                <div className="text-xl font-display font-bold text-ink">
                  No federal leasing record selected
                </div>
                <div className="mt-2 max-w-lg text-sm text-ink-light">
                  Add an existing federal lease or target, or adjust the current
                  filter to select a record.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
