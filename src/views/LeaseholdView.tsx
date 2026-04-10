import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import { isNpriNode } from '../types/node';
import {
  LEASEHOLD_ASSIGNMENT_SCOPE_OPTIONS,
  LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS,
  LEASEHOLD_ORRI_SCOPE_OPTIONS,
  LEASEHOLD_TRANSFER_ORDER_STATUS_OPTIONS,
  type LeaseholdAssignment,
  type LeaseholdOrri,
  type LeaseholdTransferOrderEntry,
  type LeaseholdTransferOrderStatus,
  type LeaseholdUnit,
} from '../types/leasehold';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import { parseInterestString, parseStrictInterestString } from '../utils/interest-string';
import {
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
  type LeaseholdAssignmentSummary,
  type LeaseholdDecimalRow,
  type LeaseholdNpriSummary,
  type LeaseholdOrriSummary,
  type LeaseholdTractSummary,
  type LeaseholdTransferOrderReview,
} from '../components/leasehold/leasehold-summary';
import type { LeaseCoverageOverlap } from '../components/deskmap/deskmap-coverage';

function formatAcres(value: string) {
  const acres = d(value);
  if (!acres.greaterThan(0)) {
    return '—';
  }
  return acres.decimalPlaces() === 0 ? acres.toFixed(0) : acres.toFixed(3);
}

function formatPercent(value: string) {
  return `${d(value).times(100).toFixed(2)}%`;
}

function formatDecimalValue(value: string) {
  return d(value).toFixed(8);
}

function normalizeGrossAcreInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toString() : '';
}

function formatOrriBasisLabel(value: LeaseholdOrri['burdenBasis']) {
  if (value === 'net_revenue_interest') {
    return 'Net Revenue Interest';
  }
  if (value === 'working_interest') {
    return 'Working Interest';
  }
  return 'Gross 8/8';
}

function formatNpriKindLabel(value: LeaseholdNpriSummary['royaltyKind']) {
  return value === 'floating' ? 'Floating NPRI' : 'Fixed NPRI';
}

export function getTransferOrderEntryDisplayStatus(
  status: LeaseholdTransferOrderStatus | null | undefined,
  payoutHold: boolean
): LeaseholdTransferOrderStatus {
  if (!status) {
    return payoutHold ? 'hold' : 'draft';
  }
  if (payoutHold && status === 'ready') {
    return 'hold';
  }
  return status;
}

function getTransferOrderEntryPersistedStatus(
  status: LeaseholdTransferOrderStatus,
  payoutHold: boolean
): LeaseholdTransferOrderStatus {
  return payoutHold && status === 'ready' ? 'hold' : status;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-ledger-line bg-parchment px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
        {label}
      </div>
      <div className="mt-2 text-2xl font-display font-bold text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-light">{detail}</div>
    </div>
  );
}

type LeaseholdMode = 'overview' | 'deck';

function LeaseholdTractCard({
  tract,
  onUpdate,
}: {
  tract: LeaseholdTractSummary;
  onUpdate: (
    id: string,
    fields: { grossAcres?: string; pooledAcres?: string; description?: string }
  ) => void;
}) {
  const [grossAcresDraft, setGrossAcresDraft] = useState(tract.grossAcres);
  const [pooledAcresDraft, setPooledAcresDraft] = useState(tract.pooledAcres);
  const [descriptionDraft, setDescriptionDraft] = useState(tract.description);

  useEffect(() => {
    setGrossAcresDraft(tract.grossAcres);
  }, [tract.grossAcres]);

  useEffect(() => {
    setPooledAcresDraft(tract.pooledAcres);
  }, [tract.pooledAcres]);

  useEffect(() => {
    setDescriptionDraft(tract.description);
  }, [tract.description]);

  const commitGrossAcres = () => {
    const next = normalizeGrossAcreInput(grossAcresDraft);
    setGrossAcresDraft(next);
    if (next !== tract.grossAcres) {
      onUpdate(tract.deskMapId, { grossAcres: next });
    }
  };

  const commitPooledAcres = () => {
    const next = normalizeGrossAcreInput(pooledAcresDraft);
    setPooledAcresDraft(next);
    if (next !== tract.pooledAcres) {
      onUpdate(tract.deskMapId, { pooledAcres: next });
    }
  };

  const commitDescription = () => {
    const next = descriptionDraft.trim();
    setDescriptionDraft(next);
    if (next !== tract.description) {
      onUpdate(tract.deskMapId, { description: next });
    }
  };

  const handleGrossAcresKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitGrossAcres();
    }
  };

  const handlePooledAcresKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitPooledAcres();
    }
  };

  const handleDescriptionKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      commitDescription();
    }
  };

  const orriBurdenDetails = [
    {
      label: 'Gross 8/8 ORRI burden',
      value: tract.grossOrriBurdenRate,
    },
    {
      label: 'WI-basis ORRI burden',
      value: tract.workingInterestOrriBurdenRate,
    },
    {
      label: 'NRI-basis ORRI burden',
      value: tract.netRevenueInterestOrriBurdenRate,
    },
  ].filter((item) => d(item.value).greaterThan(0));

  return (
    <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-display font-bold text-ink">{tract.name}</h2>
            <span className="rounded-full bg-ink/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-light">
              {tract.code}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-light">
            Participation {formatPercent(tract.unitParticipation)} from{' '}
            {formatAcres(tract.pooledAcres)} pooled acres. Tract royalty total{' '}
            {formatPercent(tract.weightedRoyaltyRate)}. Current mineral coverage{' '}
            {formatPercent(tract.currentOwnership)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-leather/10 px-3 py-1.5 font-medium text-leather">
            {tract.currentOwnerCount} present owners
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
            Leased {formatPercent(tract.leasedOwnership)}
          </span>
          <span className="rounded-full bg-gold/10 px-3 py-1.5 font-medium text-gold-900">
            Unit royalty decimal {formatPercent(tract.unitRoyaltyDecimal)}
          </span>
          <span className="rounded-full bg-sky-50 px-3 py-1.5 font-medium text-sky-900">
            NPRIs {tract.trackedNpriCount}
          </span>
          <span className="rounded-full bg-seal/10 px-3 py-1.5 font-medium text-seal">
            ORRIs {tract.trackedOrriCount}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[13rem_13rem_minmax(0,1fr)]">
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Gross Acres
          </div>
          <input
            value={grossAcresDraft}
            onChange={(event) => setGrossAcresDraft(event.target.value)}
            onBlur={commitGrossAcres}
            onKeyDown={handleGrossAcresKeyDown}
            placeholder="100"
            inputMode="decimal"
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
          <div className="mt-1 text-[11px] text-ink-light">
            Title acreage for the full tract.
          </div>
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Pooled Acres
          </div>
          <input
            value={pooledAcresDraft}
            onChange={(event) => setPooledAcresDraft(event.target.value)}
            onBlur={commitPooledAcres}
            onKeyDown={handlePooledAcresKeyDown}
            placeholder="100"
            inputMode="decimal"
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
          <div className="mt-1 text-[11px] text-ink-light">
            Drives unit participation and payout decimals.
          </div>
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Description
          </div>
          <textarea
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={commitDescription}
            onKeyDown={handleDescriptionKeyDown}
            rows={3}
            placeholder="Brief tract description"
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
          <div className="mt-1 text-[11px] text-ink-light">
            Short unit-facing note for this tract. Use Cmd/Ctrl + Enter to save from the keyboard.
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-light">
        <span>Gross acres {formatAcres(tract.grossAcres)}</span>
        <span>Pooled acres {formatAcres(tract.pooledAcres)}</span>
        <span>NRI before ORRI {formatPercent(tract.nriBeforeOrriRate)}</span>
        <span>Unit royalty decimal {formatPercent(tract.unitRoyaltyDecimal)}</span>
        <span>Floating NPRI burden {formatPercent(tract.floatingNpriBurdenRate)}</span>
        <span>Fixed NPRI burden {formatPercent(tract.fixedNpriBurdenRate)}</span>
        <span>Unit NPRI decimal {formatPercent(tract.unitNpriDecimal)}</span>
        {orriBurdenDetails.map((item) => (
          <span key={item.label}>
            {item.label} {formatPercent(item.value)}
          </span>
        ))}
        <span>Total ORRI burden {formatPercent(tract.totalOrriBurdenRate)}</span>
        <span>Unit ORRI decimal {formatPercent(tract.unitOrriDecimal)}</span>
        <span>Pre-assignment NRI {formatPercent(tract.preWorkingInterestDecimal)}</span>
        <span>Assigned WI {formatPercent(tract.assignedWorkingInterestDecimal)}</span>
        <span>Retained WI {formatPercent(tract.retainedWorkingInterestDecimal)}</span>
        <span>
          Lessee{tract.uniqueLessees.length === 1 ? '' : 's'}{' '}
          {tract.uniqueLessees.length > 0 ? tract.uniqueLessees.join(', ') : 'not set'}
        </span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-ledger-line">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-parchment-dark/80">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Present Owner
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Undivided
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Net Mineral Acres
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Net Pooled Acres
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Lessee
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Lease Royalty
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Owner Tract Royalty
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                NPRI Burden
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Net Unit Royalty
              </th>
            </tr>
          </thead>
          <tbody>
            {tract.owners.map((owner) => (
              <tr key={owner.nodeId} className="border-t border-ledger-line bg-parchment">
                <td className="px-3 py-2">
                  <div className="font-semibold text-ink">{owner.ownerName}</div>
                  <div className="text-xs text-ink-light">
                    {owner.activeLeaseCount > 1
                      ? `${owner.activeLeaseCount} active leases`
                      : owner.leaseSlices[0]?.leaseName || 'Lease record not named'}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatAsFraction(d(owner.fraction))}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatAcres(owner.netMineralAcres)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatAcres(owner.netPooledAcres)}
                </td>
                <td className="px-3 py-2 text-xs text-ink">
                  {owner.lesseeNames.length > 0 ? owner.lesseeNames.join(', ') : 'Open'}
                </td>
                <td className="px-3 py-2 text-xs text-ink">
                  {owner.leaseSlices.length > 0 ? (
                    <div className="space-y-1">
                      {owner.leaseSlices.map((lease) => (
                        <div key={lease.leaseId}>
                          <div>{lease.leaseRoyaltyRate || '—'}</div>
                          <div className="text-[11px] text-ink-light">
                            {lease.leaseName || lease.lessee || 'Lease record'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatPercent(owner.ownerTractRoyalty)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  <div>{formatPercent(owner.totalNpriUnitDecimal)}</div>
                  {(d(owner.fixedNpriUnitDecimal).greaterThan(0)
                    || d(owner.floatingNpriUnitDecimal).greaterThan(0)) && (
                    <div className="text-[11px] text-ink-light">
                      Fixed {formatPercent(owner.fixedNpriUnitDecimal)} • Floating{' '}
                      {formatPercent(owner.floatingNpriUnitDecimal)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatPercent(owner.netOwnerUnitRoyaltyDecimal)}
                </td>
              </tr>
            ))}
            {tract.owners.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-sm text-ink-light">
                  No current mineral owners are present on this tract yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeaseholdUnitEditor({
  unit,
  onUpdate,
}: {
  unit: LeaseholdUnit;
  onUpdate: (fields: Partial<LeaseholdUnit>) => void;
}) {
  const [nameDraft, setNameDraft] = useState(unit.name);
  const [descriptionDraft, setDescriptionDraft] = useState(unit.description);
  const [operatorDraft, setOperatorDraft] = useState(unit.operator);
  const [effectiveDateDraft, setEffectiveDateDraft] = useState(unit.effectiveDate);

  useEffect(() => {
    setNameDraft(unit.name);
  }, [unit.name]);

  useEffect(() => {
    setDescriptionDraft(unit.description);
  }, [unit.description]);

  useEffect(() => {
    setOperatorDraft(unit.operator);
  }, [unit.operator]);

  useEffect(() => {
    setEffectiveDateDraft(unit.effectiveDate);
  }, [unit.effectiveDate]);

  const commitField = <K extends keyof LeaseholdUnit>(key: K, value: LeaseholdUnit[K]) => {
    if (value !== unit[key]) {
      onUpdate({ [key]: value } as Pick<LeaseholdUnit, K>);
    }
  };

  return (
    <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
            Unit Setup
          </div>
          <h2 className="mt-1 text-2xl font-display font-bold text-ink">
            {unit.name || 'Unnamed Unit'}
          </h2>
          <p className="mt-1 text-sm text-ink-light">
            Lock these unit-level inputs before WI splits and division-order math.
          </p>
        </div>
        <div className="rounded-2xl bg-ink/5 px-4 py-3 text-xs text-ink-light">
          Current framework assumes payout decimals are acreage-allocated by pooled acres.
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Unit Name
          </div>
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => {
              const next = nameDraft.trim();
              setNameDraft(next);
              commitField('name', next);
            }}
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Operator / Lessee
          </div>
          <input
            value={operatorDraft}
            onChange={(event) => setOperatorDraft(event.target.value)}
            onBlur={() => {
              const next = operatorDraft.trim();
              setOperatorDraft(next);
              commitField('operator', next);
            }}
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Effective Date
          </div>
          <input
            type="date"
            value={effectiveDateDraft}
            onChange={(event) => setEffectiveDateDraft(event.target.value)}
            onBlur={() => commitField('effectiveDate', effectiveDateDraft)}
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Unit Description
          </div>
          <textarea
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={() => {
              const next = descriptionDraft.trim();
              setDescriptionDraft(next);
              commitField('description', next);
            }}
            rows={3}
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>
      </div>
    </section>
  );
}

function LeaseholdDeckModeToggle({
  mode,
  onChange,
}: {
  mode: LeaseholdMode;
  onChange: (mode: LeaseholdMode) => void;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-ledger-line bg-parchment-dark p-1 shadow-sm">
      {(['overview', 'deck'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mode === option
              ? 'bg-parchment text-ink shadow-sm'
              : 'text-ink-light hover:text-ink'
          }`}
        >
          {option === 'overview' ? 'Overview' : 'Deck'}
        </button>
      ))}
    </div>
  );
}

function LeaseholdDeckLesseeCard({
  title,
  lessees,
  note,
  royaltyDecimal,
  npriDecimal,
  orriDecimal,
  preWorkingInterestDecimal,
}: {
  title: string;
  lessees: string[];
  note: string;
  royaltyDecimal: string;
  npriDecimal: string;
  orriDecimal: string;
  preWorkingInterestDecimal: string;
}) {
  return (
    <div className="w-80 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-ink shadow-[0_8px_18px_rgba(5,150,105,0.14)]">
      <div className="rounded-t-lg border-b border-emerald-200 bg-emerald-100/80 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            Leasehold Estate
          </span>
          <span className="rounded-full border border-emerald-300 bg-emerald-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-950">
            Lessee
          </span>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-emerald-900/75">{title}</div>
        <div className="text-sm font-bold font-display text-emerald-950">
          {lessees.length > 0 ? lessees.join(', ') : 'Lessee not set'}
        </div>
        <div className="text-[10px] leading-5 text-emerald-900/75">{note}</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[9px] text-emerald-900/85">
            Unit royalty {formatPercent(royaltyDecimal)}
          </span>
          <span className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] text-sky-900/85">
            NPRI decimal {formatPercent(npriDecimal)}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[9px] text-emerald-900/85">
            ORRI decimal {formatPercent(orriDecimal)}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[9px] text-emerald-900/85">
            Pre-assignment NRI {formatPercent(preWorkingInterestDecimal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaseholdDeckPlaceholderCard({
  title,
  tone,
  body,
}: {
  title: string;
  tone: 'amber' | 'leather';
  body: string;
}) {
  const toneClasses = tone === 'amber'
    ? {
        border: 'border-amber-200',
        bg: 'bg-amber-50',
        header: 'bg-amber-100/80 border-amber-200 text-amber-900',
        body: 'text-amber-900/75',
      }
    : {
        border: 'border-ledger-line',
        bg: 'bg-parchment',
        header: 'bg-parchment-dark border-ledger-line text-ink-light',
        body: 'text-ink-light',
      };

  return (
    <div className={`w-80 rounded-lg border-2 ${toneClasses.border} ${toneClasses.bg} shadow-sm`}>
      <div className={`rounded-t-lg border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses.header}`}>
        {title}
      </div>
      <div className={`px-3 py-3 text-sm leading-6 ${toneClasses.body}`}>{body}</div>
    </div>
  );
}

function LeaseholdNpriDeckCard({
  summary,
}: {
  summary: LeaseholdNpriSummary;
}) {
  return (
    <div className="w-80 rounded-lg border-2 border-sky-200 bg-sky-50 text-ink shadow-[0_8px_18px_rgba(14,165,233,0.12)]">
      <div className="rounded-t-lg border-b border-sky-200 bg-sky-100/80 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-sky-900">
            NPRI
          </span>
          <span className="rounded-full border border-sky-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-900">
            {formatNpriKindLabel(summary.royaltyKind)}
          </span>
        </div>
        <div className="mt-0.5 text-[9px] font-mono text-sky-900/75">
          {[summary.effectiveDate || '', summary.sourceDocNo ? `Doc# ${summary.sourceDocNo}` : '']
            .filter(Boolean)
            .join(' • ')}
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-sky-900/75">
          {summary.tractName} ({summary.tractCode})
        </div>
        <div className="text-sm font-bold font-display text-sky-950">
          {summary.payee || 'Unnamed NPRI'}
        </div>
        <div className="text-[10px] leading-5 text-sky-900/75">
          Burdens the {summary.burdenedBranchOwner} mineral branch and its current descendants.
          Edit the underlying deed terms on Desk Map.
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] text-sky-900/85">
            Burden {summary.burdenFraction || '—'}
          </span>
          {summary.includedInMath ? (
            <>
              <span className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] text-sky-900/85">
                Tract burden {formatPercent(summary.tractBurdenRate)}
              </span>
              <span className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] text-sky-900/85">
                Unit decimal {formatPercent(summary.unitDecimal)}
              </span>
            </>
          ) : (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[9px] text-gold-900">
              Tracked only until the burdened branch is leased
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaseholdOrriDeckCard({
  orri,
  summary,
  deskMaps,
  onUpdate,
  onRemove,
}: {
  orri: LeaseholdOrri;
  summary: LeaseholdOrriSummary | null;
  deskMaps: Array<Pick<LeaseholdTractSummary, 'deskMapId' | 'name' | 'code'>>;
  onUpdate: (id: string, fields: Partial<LeaseholdOrri>) => void;
  onRemove: (id: string) => void;
}) {
  const [payeeDraft, setPayeeDraft] = useState(orri.payee);
  const [burdenFractionDraft, setBurdenFractionDraft] = useState(orri.burdenFraction);
  const [burdenFractionError, setBurdenFractionError] = useState<string | null>(null);
  const [sourceDocNoDraft, setSourceDocNoDraft] = useState(orri.sourceDocNo);
  const [notesDraft, setNotesDraft] = useState(orri.notes);

  useEffect(() => {
    setPayeeDraft(orri.payee);
  }, [orri.payee]);

  useEffect(() => {
    setBurdenFractionDraft(orri.burdenFraction);
    setBurdenFractionError(null);
  }, [orri.burdenFraction]);

  useEffect(() => {
    setSourceDocNoDraft(orri.sourceDocNo);
  }, [orri.sourceDocNo]);

  useEffect(() => {
    setNotesDraft(orri.notes);
  }, [orri.notes]);

  return (
    <div className="w-80 rounded-lg border-2 border-amber-200 bg-amber-50 text-ink shadow-[0_8px_18px_rgba(217,119,6,0.14)]">
      <div className="rounded-t-lg border-b border-amber-200 bg-amber-100/80 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            ORRI
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-amber-300 bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950">
              {orri.scope === 'unit' ? 'Unit' : 'Tract'}
            </span>
            <span className="rounded-full border border-amber-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
              {formatOrriBasisLabel(orri.burdenBasis)}
            </span>
          </div>
        </div>
        <div className="mt-0.5 text-[9px] font-mono text-amber-900/75">
          {[orri.effectiveDate || '', sourceDocNoDraft.trim() ? `Doc# ${sourceDocNoDraft.trim()}` : '']
            .filter(Boolean)
            .join(' • ')}
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
            Payee
          </div>
          <input
            value={payeeDraft}
            onChange={(event) => setPayeeDraft(event.target.value)}
            onBlur={() => {
              const next = payeeDraft.trim();
              setPayeeDraft(next);
              if (next !== orri.payee) {
                onUpdate(orri.id, { payee: next });
              }
            }}
            placeholder="Override payee"
            className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Burden
            </div>
            <input
              value={burdenFractionDraft}
              onChange={(event) => {
                setBurdenFractionDraft(event.target.value);
                if (burdenFractionError) setBurdenFractionError(null);
              }}
              onBlur={() => {
                const next = burdenFractionDraft.trim();
                // Strict-parse the burden fraction before saving. A blank value is a
                // legal "not entered yet" state; malformed input returns null and is
                // rejected with an inline error — the previous saved value stays in
                // the store so the math keeps running on the last good number.
                const parsed = parseStrictInterestString(next);
                if (parsed === null) {
                  setBurdenFractionError(
                    'Enter a fraction (e.g. 1/64), a decimal (e.g. 0.015625), or leave blank.'
                  );
                  setBurdenFractionDraft(orri.burdenFraction);
                  return;
                }
                setBurdenFractionError(null);
                setBurdenFractionDraft(next);
                if (next !== orri.burdenFraction) {
                  onUpdate(orri.id, { burdenFraction: next });
                }
              }}
              placeholder="1/64"
              className={`w-full rounded-xl border bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors ${
                burdenFractionError
                  ? 'border-seal/50 focus:border-seal'
                  : 'border-amber-200 focus:border-amber-400'
              }`}
            />
            {burdenFractionError && (
              <div className="mt-1 text-[10px] text-seal">{burdenFractionError}</div>
            )}
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Effective Date
            </div>
            <input
              type="date"
              value={orri.effectiveDate}
              onChange={(event) =>
                onUpdate(orri.id, { effectiveDate: event.target.value })
              }
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Scope
            </div>
            <select
              value={orri.scope}
              onChange={(event) =>
                onUpdate(orri.id, {
                  scope: event.target.value as LeaseholdOrri['scope'],
                  deskMapId: event.target.value === 'tract' ? orri.deskMapId : null,
                })
              }
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
            >
              {LEASEHOLD_ORRI_SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'unit' ? 'Unit-wide' : 'Single tract'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Burden Basis
            </div>
            <select
              value={orri.burdenBasis}
              onChange={(event) =>
                onUpdate(orri.id, {
                  burdenBasis: event.target.value as LeaseholdOrri['burdenBasis'],
                })
              }
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
            >
              {LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatOrriBasisLabel(option)}
                </option>
              ))}
            </select>
            {orri.burdenBasis === 'net_revenue_interest' && (
              <div className="mt-1 text-[10px] leading-4 text-amber-900/75">
                Multiple NRI-basis ORRIs now stack in effective-date order on the same tract.
                Fill the effective date carefully when more than one NRI carve is in play.
              </div>
            )}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Tract
            </div>
            <select
              value={orri.deskMapId ?? ''}
              disabled={orri.scope !== 'tract'}
              onChange={(event) =>
                onUpdate(orri.id, {
                  deskMapId: event.target.value || null,
                })
              }
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400 disabled:bg-amber-50/60 disabled:text-amber-900/50"
            >
              <option value="">{orri.scope === 'tract' ? 'Select tract' : 'Not used'}</option>
              {deskMaps.map((deskMap) => (
                <option key={deskMap.deskMapId} value={deskMap.deskMapId}>
                  {deskMap.name} ({deskMap.code})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
              Source Doc No.
            </div>
            <input
              value={sourceDocNoDraft}
              onChange={(event) => setSourceDocNoDraft(event.target.value)}
              onBlur={() => {
                const next = sourceDocNoDraft.trim();
                setSourceDocNoDraft(next);
                if (next !== orri.sourceDocNo) {
                  onUpdate(orri.id, { sourceDocNo: next });
                }
              }}
              placeholder="Book / file / doc no."
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/75">
            Notes
          </div>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={() => {
              const next = notesDraft.trim();
              setNotesDraft(next);
              if (next !== orri.notes) {
                onUpdate(orri.id, { notes: next });
              }
            }}
            rows={3}
            placeholder="Optional remarks about this burden"
            className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-sm text-amber-950 outline-none transition-colors focus:border-amber-400"
          />
        </label>
      </div>

      <div className="rounded-b-lg border-t border-amber-200 bg-amber-100/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-amber-900">
            {orri.scope === 'unit' ? 'Unit-wide burden' : summary?.tractName ?? 'Single tract burden'}
          </span>
          {summary?.includedInMath ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800">
              Unit decimal {formatPercent(summary.unitDecimal)}
            </span>
          ) : (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold-900">
              Tracked only until gross 8/8 math applies
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(orri.id)}
            className="ml-auto rounded px-2 py-1 text-[10px] font-semibold text-seal transition-colors hover:bg-seal/10"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaseholdDeckRetainedCard({
  title,
  holder,
  note,
  retainedDecimal,
  assignedDecimal,
  overAssigned,
  overBurdened,
  overFloatingNpriBurdened,
  leaseOverlapCount,
}: {
  title: string;
  holder: string;
  note: string;
  retainedDecimal: string;
  assignedDecimal: string;
  overAssigned: boolean;
  overBurdened: boolean;
  overFloatingNpriBurdened: boolean;
  leaseOverlapCount: number;
}) {
  return (
    <div className="w-80 rounded-lg border-2 border-ledger-line bg-parchment text-ink shadow-sm">
      <div className="rounded-t-lg border-b border-ledger-line bg-parchment-dark px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink-light">
            Working Interest
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">
            Retained WI
          </span>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="text-[10px] uppercase tracking-wider text-ink-light">{title}</div>
        <div className="text-sm font-bold font-display text-ink">
          {holder || 'Operator / lessee not set'}
        </div>
        <div className="text-[10px] leading-5 text-ink-light">{note}</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[9px] text-ink">
            Retained {formatPercent(retainedDecimal)}
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[9px] text-ink">
            Assigned {formatPercent(assignedDecimal)}
          </span>
          {overAssigned && (
            <span className="rounded-full border border-seal/30 bg-seal/10 px-2 py-0.5 text-[9px] text-seal">
              Over-assigned
            </span>
          )}
          {overBurdened && (
            <span className="rounded-full border border-seal/30 bg-seal/10 px-2 py-0.5 text-[9px] text-seal">
              Over-burdened
            </span>
          )}
          {overFloatingNpriBurdened && (
            <span className="rounded-full border border-seal/30 bg-seal/10 px-2 py-0.5 text-[9px] text-seal">
              Floating NPRI over-carve
            </span>
          )}
          {leaseOverlapCount > 0 && (
            <span className="rounded-full border border-seal/30 bg-seal/10 px-2 py-0.5 text-[9px] text-seal">
              Lease overlap ({leaseOverlapCount})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaseholdAssignmentDeckCard({
  assignment,
  summary,
  deskMaps,
  focusDetail,
  onUpdate,
  onRemove,
}: {
  assignment: LeaseholdAssignment;
  summary: LeaseholdAssignmentSummary | null;
  deskMaps: Array<Pick<LeaseholdTractSummary, 'deskMapId' | 'name' | 'code'>>;
  focusDetail: { label: string; decimal: string } | null;
  onUpdate: (id: string, fields: Partial<LeaseholdAssignment>) => void;
  onRemove: (id: string) => void;
}) {
  const [assignorDraft, setAssignorDraft] = useState(assignment.assignor);
  const [assigneeDraft, setAssigneeDraft] = useState(assignment.assignee);
  const [workingInterestDraft, setWorkingInterestDraft] = useState(
    assignment.workingInterestFraction
  );
  const [workingInterestError, setWorkingInterestError] = useState<string | null>(null);
  const [sourceDocNoDraft, setSourceDocNoDraft] = useState(assignment.sourceDocNo);
  const [notesDraft, setNotesDraft] = useState(assignment.notes);

  useEffect(() => {
    setAssignorDraft(assignment.assignor);
  }, [assignment.assignor]);

  useEffect(() => {
    setAssigneeDraft(assignment.assignee);
  }, [assignment.assignee]);

  useEffect(() => {
    setWorkingInterestDraft(assignment.workingInterestFraction);
    setWorkingInterestError(null);
  }, [assignment.workingInterestFraction]);

  useEffect(() => {
    setSourceDocNoDraft(assignment.sourceDocNo);
  }, [assignment.sourceDocNo]);

  useEffect(() => {
    setNotesDraft(assignment.notes);
  }, [assignment.notes]);

  return (
    <div className="w-80 rounded-lg border-2 border-leather/25 bg-leather/5 text-ink shadow-[0_8px_18px_rgba(120,53,15,0.14)]">
      <div className="rounded-t-lg border-b border-leather/20 bg-leather/10 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-leather">
            Assignment
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-leather/30 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-leather">
              {assignment.scope === 'unit' ? 'Unit' : 'Tract'}
            </span>
            <span className="rounded-full border border-leather/30 bg-leather/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-leather">
              WI
            </span>
          </div>
        </div>
        <div className="mt-0.5 text-[9px] font-mono text-leather/75">
          {[
            assignment.effectiveDate || '',
            sourceDocNoDraft.trim() ? `Doc# ${sourceDocNoDraft.trim()}` : '',
          ]
            .filter(Boolean)
            .join(' • ')}
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Assignor
            </div>
            <input
              value={assignorDraft}
              onChange={(event) => setAssignorDraft(event.target.value)}
              onBlur={() => {
                const next = assignorDraft.trim();
                setAssignorDraft(next);
                if (next !== assignment.assignor) {
                  onUpdate(assignment.id, { assignor: next });
                }
              }}
              placeholder="Assignor"
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Assignee
            </div>
            <input
              value={assigneeDraft}
              onChange={(event) => setAssigneeDraft(event.target.value)}
              onBlur={() => {
                const next = assigneeDraft.trim();
                setAssigneeDraft(next);
                if (next !== assignment.assignee) {
                  onUpdate(assignment.id, { assignee: next });
                }
              }}
              placeholder="Assignee"
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              WI Share
            </div>
            <input
              value={workingInterestDraft}
              onChange={(event) => {
                setWorkingInterestDraft(event.target.value);
                if (workingInterestError) setWorkingInterestError(null);
              }}
              onBlur={() => {
                const next = workingInterestDraft.trim();
                // Strict-parse the WI assignment fraction before saving. Closes the
                // silent-zero path for audit finding #4 on the assignment deck.
                const parsed = parseStrictInterestString(next);
                if (parsed === null) {
                  setWorkingInterestError(
                    'Enter a fraction (e.g. 1/2), a decimal (e.g. 0.5), or leave blank.'
                  );
                  setWorkingInterestDraft(assignment.workingInterestFraction);
                  return;
                }
                setWorkingInterestError(null);
                setWorkingInterestDraft(next);
                if (next !== assignment.workingInterestFraction) {
                  onUpdate(assignment.id, { workingInterestFraction: next });
                }
              }}
              placeholder="1/2"
              className={`w-full rounded-xl border bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors ${
                workingInterestError
                  ? 'border-seal/50 focus:border-seal'
                  : 'border-leather/20 focus:border-leather'
              }`}
            />
            {workingInterestError && (
              <div className="mt-1 text-[10px] text-seal">{workingInterestError}</div>
            )}
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Effective Date
            </div>
            <input
              type="date"
              value={assignment.effectiveDate}
              onChange={(event) =>
                onUpdate(assignment.id, { effectiveDate: event.target.value })
              }
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Scope
            </div>
            <select
              value={assignment.scope}
              onChange={(event) =>
                onUpdate(assignment.id, {
                  scope: event.target.value as LeaseholdAssignment['scope'],
                  deskMapId:
                    event.target.value === 'tract' ? assignment.deskMapId : null,
                })
              }
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            >
              {LEASEHOLD_ASSIGNMENT_SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'unit' ? 'Unit-wide' : 'Single tract'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Tract
            </div>
            <select
              value={assignment.deskMapId ?? ''}
              disabled={assignment.scope !== 'tract'}
              onChange={(event) =>
                onUpdate(assignment.id, {
                  deskMapId: event.target.value || null,
                })
              }
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather disabled:bg-parchment-dark/70 disabled:text-ink-light"
            >
              <option value="">
                {assignment.scope === 'tract' ? 'Select tract' : 'Not used'}
              </option>
              {deskMaps.map((deskMap) => (
                <option key={deskMap.deskMapId} value={deskMap.deskMapId}>
                  {deskMap.name} ({deskMap.code})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
              Source Doc No.
            </div>
            <input
              value={sourceDocNoDraft}
              onChange={(event) => setSourceDocNoDraft(event.target.value)}
              onBlur={() => {
                const next = sourceDocNoDraft.trim();
                setSourceDocNoDraft(next);
                if (next !== assignment.sourceDocNo) {
                  onUpdate(assignment.id, { sourceDocNo: next });
                }
              }}
              placeholder="Book / file / doc no."
              className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-leather">
            Notes
          </div>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={() => {
              const next = notesDraft.trim();
              setNotesDraft(next);
              if (next !== assignment.notes) {
                onUpdate(assignment.id, { notes: next });
              }
            }}
            rows={3}
            placeholder="Optional remarks about this assignment"
            className="w-full rounded-xl border border-leather/20 bg-white/90 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>
      </div>

      <div className="rounded-b-lg border-t border-leather/20 bg-leather/5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-leather/30 bg-white/80 px-2 py-0.5 text-leather">
            {assignment.scope === 'unit'
              ? 'Unit-wide split'
              : summary?.tractName ?? 'Single tract split'}
          </span>
          {summary?.includedInMath ? (
            <>
              <span className="rounded-full border border-leather/30 bg-white/80 px-2 py-0.5 text-leather">
                Unit decimal {formatPercent(summary.unitDecimal)}
              </span>
              {focusDetail && (
                <span className="rounded-full border border-leather/30 bg-white/80 px-2 py-0.5 text-leather">
                  {focusDetail.label} {formatPercent(focusDetail.decimal)}
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold-900">
              Tracked only until a valid tract is linked
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(assignment.id)}
            className="ml-auto rounded px-2 py-1 text-[10px] font-semibold text-seal transition-colors hover:bg-seal/10"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDecimalCategoryLabel(category: LeaseholdDecimalRow['category']) {
  switch (category) {
    case 'royalty':
      return 'Royalty';
    case 'npri':
      return 'NPRI';
    case 'orri':
      return 'ORRI';
    case 'retained_wi':
      return 'Retained WI';
    case 'assigned_wi':
      return 'Assigned WI';
    default:
      return 'Decimal';
  }
}

function decimalCategoryClasses(category: LeaseholdDecimalRow['category']) {
  switch (category) {
    case 'royalty':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'npri':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'orri':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'retained_wi':
      return 'border-ledger-line bg-parchment-dark text-ink';
    case 'assigned_wi':
      return 'border-leather/30 bg-leather/10 text-leather';
    default:
      return 'border-ledger-line bg-parchment text-ink';
  }
}

function TransferOrderMetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'success' | 'alert';
}) {
  const toneClasses = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50'
    : tone === 'alert'
      ? 'border-seal/25 bg-seal/5'
      : 'border-ledger-line bg-parchment';

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClasses}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
        {label}
      </div>
      <div className="mt-2 text-2xl font-display font-bold text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-light">{detail}</div>
    </div>
  );
}

function transferOrderRowStatus(row: LeaseholdDecimalRow) {
  if (row.category === 'retained_wi') {
    return {
      label: 'Derived remainder',
      classes: 'border-ledger-line bg-parchment-dark/80 text-ink',
    };
  }

  const missingEffectiveDate = row.effectiveDate.trim().length === 0;
  const missingSourceDocNo = row.sourceDocNo.trim().length === 0;

  if (!missingEffectiveDate && !missingSourceDocNo) {
    return {
      label: 'Source ready',
      classes: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    };
  }

  if (missingEffectiveDate && missingSourceDocNo) {
    return {
      label: 'Need date + doc',
      classes: 'border-seal/30 bg-seal/10 text-seal',
    };
  }

  if (missingEffectiveDate) {
    return {
      label: 'Need date',
      classes: 'border-gold/40 bg-gold/10 text-gold-900',
    };
  }

  return {
    label: 'Need doc no',
    classes: 'border-gold/40 bg-gold/10 text-gold-900',
  };
}

function formatTransferOrderEntryStatusLabel(status: LeaseholdTransferOrderStatus) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'hold':
      return 'Hold';
    default:
      return 'Draft';
  }
}

function LeaseholdTransferOrderEntryEditor({
  row,
  entry,
  editable,
  payoutHold,
  onUpsert,
  onRemove,
}: {
  row: LeaseholdDecimalRow;
  entry: LeaseholdTransferOrderEntry | null;
  editable: boolean;
  payoutHold: boolean;
  onUpsert: (
    entry: Pick<LeaseholdTransferOrderEntry, 'sourceRowId'>
      & Partial<Omit<LeaseholdTransferOrderEntry, 'sourceRowId'>>
  ) => void;
  onRemove: (sourceRowId: string) => void;
}) {
  const [ownerNumberDraft, setOwnerNumberDraft] = useState(entry?.ownerNumber ?? '');
  const [statusDraft, setStatusDraft] = useState<LeaseholdTransferOrderStatus>(
    getTransferOrderEntryDisplayStatus(entry?.status, payoutHold)
  );
  const [notesDraft, setNotesDraft] = useState(entry?.notes ?? '');

  useEffect(() => {
    setOwnerNumberDraft(entry?.ownerNumber ?? '');
  }, [entry?.ownerNumber]);

  useEffect(() => {
    setStatusDraft(getTransferOrderEntryDisplayStatus(entry?.status, payoutHold));
  }, [entry?.status, payoutHold]);

  useEffect(() => {
    setNotesDraft(entry?.notes ?? '');
  }, [entry?.notes]);

  if (!editable) {
    return (
      <div className="rounded-xl border border-ledger-line bg-parchment-dark/60 px-2.5 py-2 text-[11px] text-ink-light">
        Edit in unit focus.
      </div>
    );
  }

  const commit = (overrides: Partial<Omit<LeaseholdTransferOrderEntry, 'id' | 'sourceRowId'>>) => {
    const nextOwnerNumber = (overrides.ownerNumber ?? ownerNumberDraft).trim();
    const nextNotes = (overrides.notes ?? notesDraft).trim();
    const nextStatus = getTransferOrderEntryPersistedStatus(
      overrides.status ?? statusDraft,
      payoutHold
    );

    setOwnerNumberDraft(nextOwnerNumber);
    setNotesDraft(nextNotes);
    setStatusDraft(nextStatus);
    onUpsert({
      sourceRowId: row.id,
      ownerNumber: nextOwnerNumber,
      status: nextStatus,
      notes: nextNotes,
    });
  };

  return (
    <div className="min-w-[15rem] space-y-2">
      <input
        value={ownerNumberDraft}
        onChange={(event) => setOwnerNumberDraft(event.target.value)}
        onBlur={() => commit({ ownerNumber: ownerNumberDraft })}
        placeholder="Owner no. / pay code"
        className="w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-leather"
      />
      <div className="flex items-center gap-2">
        <select
          value={statusDraft}
          onChange={(event) =>
            commit({ status: event.target.value as LeaseholdTransferOrderStatus })
          }
          className="min-w-0 flex-1 rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-leather"
        >
          {LEASEHOLD_TRANSFER_ORDER_STATUS_OPTIONS.filter(
            (status) => !payoutHold || status !== 'ready'
          ).map((status) => (
            <option key={status} value={status}>
              {formatTransferOrderEntryStatusLabel(status)}
            </option>
          ))}
        </select>
        {entry && (
          <button
            type="button"
            onClick={() => {
              setOwnerNumberDraft('');
              setStatusDraft('draft');
              setNotesDraft('');
              onRemove(row.id);
            }}
            className="rounded px-2 py-1 text-[10px] font-semibold text-seal transition-colors hover:bg-seal/10"
          >
            Clear
          </button>
        )}
      </div>
      {payoutHold && (
        <div className="rounded-lg border border-seal/20 bg-seal/5 px-2.5 py-2 text-[11px] leading-5 text-seal">
          Floating NPRI over-carve keeps payout readiness on hold. Owner numbers and notes can
          still be saved, but `Ready` stays unavailable until the royalty burden is corrected.
        </div>
      )}
      <textarea
        value={notesDraft}
        onChange={(event) => setNotesDraft(event.target.value)}
        onBlur={() => commit({ notes: notesDraft })}
        rows={2}
        placeholder="Transfer-order note"
        className="w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-leather resize-y"
      />
    </div>
  );
}

function LeaseholdDecimalLedger({
  title,
  review,
  focusCoverageDetail,
  overAssignedFocus,
  overBurdenedFocus,
  overFloatingNpriBurdenedFocus,
  leaseOverlapsFocus,
  editable,
  entriesBySourceRowId,
  onUpsertEntry,
  onRemoveEntry,
}: {
  title: string;
  review: LeaseholdTransferOrderReview;
  focusCoverageDetail: string;
  overAssignedFocus: boolean;
  overBurdenedFocus: boolean;
  overFloatingNpriBurdenedFocus: boolean;
  leaseOverlapsFocus: LeaseCoverageOverlap[];
  editable: boolean;
  entriesBySourceRowId: Map<string, LeaseholdTransferOrderEntry>;
  onUpsertEntry: (
    entry: Pick<LeaseholdTransferOrderEntry, 'sourceRowId'>
      & Partial<Omit<LeaseholdTransferOrderEntry, 'sourceRowId'>>
  ) => void;
  onRemoveEntry: (sourceRowId: string) => void;
}) {
  const varianceTone = d(review.varianceDecimal).greaterThan(0) ? 'alert' : 'success';
  const missingDateTone = review.rowsMissingEffectiveDate > 0 ? 'alert' : 'success';
  const missingDocTone = review.rowsMissingSourceDocNo > 0 ? 'alert' : 'success';
  const sourceReadyTone =
    review.reviewableRowCount > 0
    && review.rowsWithCompleteSource === review.reviewableRowCount
      ? 'success'
      : 'default';
  const payoutHold = editable && overFloatingNpriBurdenedFocus;
  const visibleEntries = editable
    ? review.rows.flatMap((row) => {
        const entry = entriesBySourceRowId.get(row.id);
        return entry ? [entry] : [];
      })
    : [];
  const visibleEntryStatuses = visibleEntries.map((entry) =>
    getTransferOrderEntryDisplayStatus(entry.status, payoutHold)
  );
  const readyCount = visibleEntryStatuses.filter((status) => status === 'ready').length;
  const holdCount = visibleEntryStatuses.filter((status) => status === 'hold').length;

  return (
    <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
            Decimals / Transfer Order
          </div>
          <h3 className="mt-1 text-xl font-display font-bold text-ink">
            Transfer Order Review
          </h3>
          <p className="mt-1 text-sm text-ink-light">
            {editable
              ? `Editable unit-level payout-entry rows for ${title}. Decimals stay derived; owner number, row status, and notes now save on top of the review rows below.`
              : `Read-only review surface for ${title}. This tract view shows partial slices only, so editable transfer-order rows stay in unit focus.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-ink/5 px-3 py-1.5 font-medium text-ink-light">
            {review.rows.length} row{review.rows.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-leather/10 px-3 py-1.5 font-medium text-leather">
            Visible total {formatDecimalValue(review.totalDecimal)}
          </span>
          {editable && (
            <>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
                Saved rows {visibleEntries.length}/{review.rows.length}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 font-medium ${
                  payoutHold
                    ? 'bg-seal/10 text-seal'
                    : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                {payoutHold ? 'Payout hold' : 'Payout open'}
              </span>
              <span className="rounded-full bg-gold/10 px-3 py-1.5 font-medium text-gold-900">
                Ready {readyCount}
              </span>
              <span className="rounded-full bg-seal/10 px-3 py-1.5 font-medium text-seal">
                Hold {holdCount}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <TransferOrderMetricCard
          label="Focus Total"
          value={formatDecimalValue(review.totalDecimal)}
          detail="Sum of the visible decimal rows in this focus."
        />
        <TransferOrderMetricCard
          label="Expected Coverage"
          value={formatDecimalValue(review.expectedDecimal)}
          detail={focusCoverageDetail}
        />
        <TransferOrderMetricCard
          label="Variance"
          value={formatDecimalValue(review.varianceDecimal)}
          detail={
            d(review.varianceDecimal).greaterThan(0)
              ? 'Review this mismatch before payout entry.'
              : 'Balanced against the expected leased coverage.'
          }
          tone={varianceTone}
        />
        <TransferOrderMetricCard
          label="Recorded Source"
          value={
            review.reviewableRowCount > 0
              ? `${review.rowsWithCompleteSource}/${review.reviewableRowCount}`
              : '—'
          }
          detail="Rows with both effective date and doc no."
          tone={sourceReadyTone}
        />
        <TransferOrderMetricCard
          label="Source Gaps"
          value={review.rowsWithSourceGap.toString()}
          detail={`Missing dates: ${review.rowsMissingEffectiveDate}. Missing doc nos: ${review.rowsMissingSourceDocNo}.`}
          tone={missingDateTone === 'alert' || missingDocTone === 'alert' ? 'alert' : 'success'}
        />
      </div>

      {overAssignedFocus && (
        <div className="mt-4 rounded-2xl border border-seal/25 bg-seal/5 px-4 py-3 text-sm text-seal">
          <div className="font-semibold">Warning-only over-assignment in v1</div>
          <div className="mt-1">
            Assignment rows stay visible for review even when they exceed 100% of the available
            WI in this focus. Retained WI is clamped at zero, and the variance above shows the
            overage until the split is corrected.
          </div>
        </div>
      )}

      {overBurdenedFocus && (
        <div className="mt-4 rounded-2xl border border-seal/25 bg-seal/5 px-4 py-3 text-sm text-seal">
          <div className="font-semibold">Non-cost-bearing burdens exceed available NRI</div>
          <div className="mt-1">
            Fixed NPRIs plus the ORRI stack on this focus exceed the lessee's available NRI before
            any WI assignment. Pre-WI is clamped at zero, so retained and assigned WI rows read as
            zero until the burden mix is revised. This is warning-only — the math still runs, it
            just cannot honor every burden as entered.
          </div>
        </div>
      )}

      {overFloatingNpriBurdenedFocus && (
        <div className="mt-4 rounded-2xl border border-seal/25 bg-seal/5 px-4 py-3 text-sm text-seal">
          <div className="font-semibold">Floating NPRIs exceed available lease royalty</div>
          <div className="mt-1">
            One or more floating NPRIs in this focus claim more than 100% of the lease royalty on
            a burdened branch. Mineral-owner royalty rows are clamped at zero, and the positive
            variance above should be resolved before treating the payout sheet as final. Editing
            still stays available, but unit-focus payout readiness now stays on hold until the
            over-carve is corrected.
          </div>
        </div>
      )}

      {leaseOverlapsFocus.length > 0 && (
        <div className="mt-4 rounded-2xl border border-seal/25 bg-seal/5 px-4 py-3 text-sm text-seal">
          <div className="font-semibold">
            Lease overlap ({leaseOverlapsFocus.length}
            {leaseOverlapsFocus.length === 1 ? ' lease' : ' leases'} clipped)
          </div>
          <div className="mt-1">
            One or more active leases on this focus claim more of the owner's interest than the
            owner holds. The later-effective lease is silently clipped in the allocation math, so
            a chain-of-title or top-lease scenario is likely — review the leases below before
            relying on this focus' decimals.
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {leaseOverlapsFocus.map((overlap) => (
              <li key={overlap.leaseId}>
                <span className="font-semibold">{overlap.leaseName || 'Unnamed lease'}</span>
                {overlap.lessee ? ` — ${overlap.lessee}` : ''}: requested{' '}
                {formatDecimalValue(overlap.requestedFraction)}, allocated{' '}
                {formatDecimalValue(overlap.allocatedFraction)}, clipped{' '}
                {formatDecimalValue(overlap.clippedFraction)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {!editable && (
        <div className="mt-4 rounded-2xl border border-ledger-line bg-parchment-dark/70 px-4 py-3 text-sm text-ink-light">
          Unit focus is the editable payout-entry surface. Tract focus stays review-only because
          those decimals are partial tract contributions, not final unit payout rows.
        </div>
      )}

      {review.categorySummaries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {review.categorySummaries.map((summary) => (
            <span
              key={summary.category}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${decimalCategoryClasses(summary.category)}`}
            >
              <span className="font-semibold uppercase tracking-wide">
                {formatDecimalCategoryLabel(summary.category)}
              </span>
              <span>
                {summary.rowCount} row{summary.rowCount === 1 ? '' : 's'}
              </span>
              <span className="font-mono">{formatDecimalValue(summary.totalDecimal)}</span>
            </span>
          ))}
        </div>
      )}

      {review.rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ledger-line">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-parchment-dark/80">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Payee
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Source
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Tract
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Review
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Payout Entry
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                  Decimal
                </th>
              </tr>
            </thead>
            <tbody>
              {review.rows.map((row) => {
                const status = transferOrderRowStatus(row);
                return (
                  <tr key={row.id} className="border-t border-ledger-line bg-parchment">
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${decimalCategoryClasses(row.category)}`}
                      >
                        {formatDecimalCategoryLabel(row.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top font-semibold text-ink">{row.payee}</td>
                    <td className="px-3 py-2 align-top text-xs text-ink">
                      <div>{row.sourceLabel}</div>
                      {(row.effectiveDate || row.sourceDocNo) && (
                        <div className="mt-1 text-[11px] text-ink-light">
                          {[row.effectiveDate, row.sourceDocNo ? `Doc# ${row.sourceDocNo}` : '']
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-ink-light">
                      {row.tractCode ? `${row.tractCode} • ${row.tractName}` : row.tractName}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.classes}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <LeaseholdTransferOrderEntryEditor
                        row={row}
                        entry={editable ? entriesBySourceRowId.get(row.id) ?? null : null}
                        editable={editable}
                        payoutHold={payoutHold}
                        onUpsert={onUpsertEntry}
                        onRemove={onRemoveEntry}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-ink">
                      {formatDecimalValue(row.decimal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-ledger-line bg-parchment-dark/70 px-4 py-6 text-sm text-ink-light">
          No decimal rows are available for this focus yet.
        </div>
      )}
    </section>
  );
}

function LeaseholdDeck({
  deskMaps,
  unit,
  unitSummary,
  unitUniqueLessees,
  assignments,
  assignmentSummaries,
  npriSummaries,
  orris,
  orriSummaries,
  totalRoyaltyDecimal,
  totalNpriDecimal,
  totalOrriDecimal,
  preWorkingInterestDecimal,
  totalAssignedWorkingInterestDecimal,
  retainedWorkingInterestDecimal,
  overAssignedTractCount,
  overBurdenedTractCount,
  overFloatingNpriBurdenedTractCount,
  transferOrderEntries,
  onAddAssignment,
  onUpdateAssignment,
  onRemoveAssignment,
  onAddOrri,
  onUpdateOrri,
  onRemoveOrri,
  onUpsertTransferOrderEntry,
  onRemoveTransferOrderEntry,
}: {
  deskMaps: LeaseholdTractSummary[];
  unit: LeaseholdUnit;
  unitSummary: ReturnType<typeof buildLeaseholdUnitSummary>;
  unitUniqueLessees: string[];
  assignments: LeaseholdAssignment[];
  assignmentSummaries: LeaseholdAssignmentSummary[];
  npriSummaries: LeaseholdNpriSummary[];
  orris: LeaseholdOrri[];
  orriSummaries: LeaseholdOrriSummary[];
  totalRoyaltyDecimal: string;
  totalNpriDecimal: string;
  totalOrriDecimal: string;
  preWorkingInterestDecimal: string;
  totalAssignedWorkingInterestDecimal: string;
  retainedWorkingInterestDecimal: string;
  overAssignedTractCount: number;
  overBurdenedTractCount: number;
  overFloatingNpriBurdenedTractCount: number;
  transferOrderEntries: LeaseholdTransferOrderEntry[];
  onAddAssignment: (assignment?: Partial<LeaseholdAssignment>) => void;
  onUpdateAssignment: (id: string, fields: Partial<LeaseholdAssignment>) => void;
  onRemoveAssignment: (id: string) => void;
  onAddOrri: (focusDeskMapId: string | null) => void;
  onUpdateOrri: (id: string, fields: Partial<LeaseholdOrri>) => void;
  onRemoveOrri: (id: string) => void;
  onUpsertTransferOrderEntry: (
    entry: Pick<LeaseholdTransferOrderEntry, 'sourceRowId'>
      & Partial<Omit<LeaseholdTransferOrderEntry, 'sourceRowId'>>
  ) => void;
  onRemoveTransferOrderEntry: (sourceRowId: string) => void;
}) {
  const [focusedDeskMapId, setFocusedDeskMapId] = useState<string | null>(deskMaps[0]?.deskMapId ?? null);
  const transferOrderReview = useMemo(
    () =>
      buildLeaseholdTransferOrderReview({
        unit,
        unitSummary,
        focusedDeskMapId,
      }),
    [focusedDeskMapId, unit, unitSummary]
  );

  useEffect(() => {
    if (!focusedDeskMapId) {
      return;
    }
    if (!deskMaps.some((tract) => tract.deskMapId === focusedDeskMapId)) {
      setFocusedDeskMapId(deskMaps[0]?.deskMapId ?? null);
    }
  }, [deskMaps, focusedDeskMapId]);

  const focusedTract = focusedDeskMapId
    ? deskMaps.find((tract) => tract.deskMapId === focusedDeskMapId) ?? null
    : null;

  const relevantAssignments = assignments.filter((assignment) =>
    focusedDeskMapId
      ? assignment.scope === 'unit' || assignment.deskMapId === focusedDeskMapId
      : assignment.scope === 'unit'
  );
  const relevantAssignmentSummaries = assignmentSummaries.filter((summary) =>
    focusedDeskMapId
      ? summary.scope === 'unit' || summary.deskMapId === focusedDeskMapId
      : summary.scope === 'unit'
  );
  const relevantNpriSummaries = npriSummaries.filter((summary) =>
    focusedDeskMapId ? summary.deskMapId === focusedDeskMapId : summary.includedInMath
  );
  const relevantOrris = orris.filter((orri) =>
    focusedDeskMapId
      ? orri.scope === 'unit' || orri.deskMapId === focusedDeskMapId
      : orri.scope === 'unit'
  );
  const relevantOrriSummaries = orriSummaries.filter((summary) =>
    focusedDeskMapId
      ? summary.scope === 'unit' || summary.deskMapId === focusedDeskMapId
      : summary.scope === 'unit'
  );
  const assignmentSummaryById = new Map(
    relevantAssignmentSummaries.map((summary) => [summary.id, summary])
  );
  const summaryById = new Map(relevantOrriSummaries.map((summary) => [summary.id, summary]));
  const activeLessees = focusedTract?.uniqueLessees.length
    ? focusedTract.uniqueLessees
    : unitUniqueLessees;
  const activeTitle = focusedTract
    ? `${focusedTract.name} (${focusedTract.code})`
    : unit.name || 'Unit-wide Leasehold';
  const activeNote = focusedTract
    ? `${focusedTract.description || 'No tract note yet.'} ${formatAcres(focusedTract.pooledAcres)} pooled acres with ${focusedTract.currentOwnerCount} present owners feeding this leasehold deck.`
    : `${unit.description || 'No unit note yet.'} Switch to a tract to focus the burdens that sit under that leasehold estate.`;
  const activeRoyaltyDecimal = focusedTract?.unitRoyaltyDecimal ?? totalRoyaltyDecimal;
  const activeNpriDecimal = focusedTract?.unitNpriDecimal ?? totalNpriDecimal;
  const activeOrriDecimal = focusedTract?.unitOrriDecimal ?? totalOrriDecimal;
  const activePreWorkingInterestDecimal =
    focusedTract?.preWorkingInterestDecimal ?? preWorkingInterestDecimal;
  const activeAssignedWorkingInterestDecimal = focusedTract?.assignedWorkingInterestDecimal
    ?? totalAssignedWorkingInterestDecimal;
  const activeRetainedWorkingInterestDecimal = focusedTract?.retainedWorkingInterestDecimal
    ?? retainedWorkingInterestDecimal;
  const activeTrackedAssignmentCount = focusedTract?.trackedAssignmentCount
    ?? relevantAssignments.length;
  const activeTrackedNpriCount = focusedTract?.trackedNpriCount ?? relevantNpriSummaries.length;
  const activeTrackedOrriCount = focusedTract?.trackedOrriCount ?? relevantOrris.length;
  const activeOverAssigned = focusedTract?.overAssigned ?? overAssignedTractCount > 0;
  const activeOverBurdened = focusedTract?.overBurdened ?? overBurdenedTractCount > 0;
  const activeOverFloatingNpriBurdened = focusedTract?.overFloatingNpriBurdened
    ?? overFloatingNpriBurdenedTractCount > 0;
  const activeLeaseOverlaps: LeaseCoverageOverlap[] = focusedTract
    ? focusedTract.leaseOverlaps
    : unitSummary.tracts.flatMap((tract) => tract.leaseOverlaps);
  const activeRetainedHolder = activeLessees[0] || unit.operator;
  const focusCoverageDetail = focusedTract
    ? `${formatPercent(focusedTract.unitParticipation)} participation x ${formatPercent(focusedTract.leasedOwnership)} leased ownership for ${focusedTract.code}.`
    : 'Sum of each tract participation multiplied by current leased ownership.';
  const transferOrderEntriesBySourceRowId = useMemo(
    () => new Map(transferOrderEntries.map((entry) => [entry.sourceRowId, entry])),
    [transferOrderEntries]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
              Leasehold Deck
            </div>
            <h2 className="mt-1 text-2xl font-display font-bold text-ink">
              Card-Based Leasehold
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-light">
              This keeps Desk Map clean while giving the leasehold side its own visual board.
              The selected tract stays front and center, and unit-wide burdens follow it down.
            </p>
          </div>
          <div className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-950">
            Title stays in Desk Map. Leasehold burdens, WI, and assignments live here.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFocusedDeskMapId(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              focusedDeskMapId === null
                ? 'bg-ink text-parchment'
                : 'bg-ink/5 text-ink-light hover:text-ink'
            }`}
          >
            Unit
          </button>
          {deskMaps.map((tract) => (
            <button
              key={tract.deskMapId}
              type="button"
              onClick={() => setFocusedDeskMapId(tract.deskMapId)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                focusedDeskMapId === tract.deskMapId
                  ? 'bg-leather text-parchment'
                  : 'bg-leather/10 text-leather hover:bg-leather/15'
              }`}
            >
              {tract.code}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <SummaryCard
            label="Active Focus"
            value={focusedTract ? focusedTract.code : 'UNIT'}
            detail={activeTitle}
          />
          <SummaryCard
            label="Unit Royalty"
            value={formatPercent(activeRoyaltyDecimal)}
            detail="Current unit royalty decimal from active leases"
          />
          <SummaryCard
            label="NPRI Decimal"
            value={formatPercent(activeNpriDecimal)}
            detail={`${activeTrackedNpriCount} NPRI branch${activeTrackedNpriCount === 1 ? '' : 'es'} in focus`}
          />
          <SummaryCard
            label="ORRI Decimal"
            value={formatPercent(activeOrriDecimal)}
            detail={`${activeTrackedOrriCount} ORRI card${activeTrackedOrriCount === 1 ? '' : 's'} in focus`}
          />
          <SummaryCard
            label="Pre-Assign NRI"
            value={formatPercent(activePreWorkingInterestDecimal)}
            detail="Net revenue remaining before WI splits and assignments"
          />
          <SummaryCard
            label="Assigned WI"
            value={formatPercent(activeAssignedWorkingInterestDecimal)}
            detail={`${activeTrackedAssignmentCount} assignment card${activeTrackedAssignmentCount === 1 ? '' : 's'} in focus`}
          />
          <SummaryCard
            label="Retained WI"
            value={formatPercent(activeRetainedWorkingInterestDecimal)}
            detail={activeOverAssigned ? 'At least one focused tract is over-assigned' : 'Remaining WI after assignments'}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
          Leasehold Estate
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <LeaseholdDeckLesseeCard
            title={activeTitle}
            lessees={activeLessees}
            note={activeNote}
            royaltyDecimal={activeRoyaltyDecimal}
            npriDecimal={activeNpriDecimal}
            orriDecimal={activeOrriDecimal}
            preWorkingInterestDecimal={activePreWorkingInterestDecimal}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
              Mineral-Side Royalty
            </div>
            <h3 className="mt-1 text-xl font-display font-bold text-ink">NPRI Lane</h3>
            <p className="mt-1 text-sm text-ink-light">
              These royalty burdens come from Desk Map title branches. Fixed NPRIs burden gross
              leased production; floating NPRIs burden lease royalty. Edit the deed terms on Desk
              Map, then review the payout decimals here.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {relevantNpriSummaries.length > 0 ? (
            relevantNpriSummaries.map((summary) => (
              <LeaseholdNpriDeckCard key={summary.id} summary={summary} />
            ))
          ) : (
            <LeaseholdDeckPlaceholderCard
              title="NPRI"
              tone="leather"
              body="No NPRI burdens are active in this focus yet. Add or edit NPRI branches on Desk Map and their payout decimals will appear here automatically."
            />
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
              Burdens
            </div>
            <h3 className="mt-1 text-xl font-display font-bold text-ink">ORRI Lane</h3>
            <p className="mt-1 text-sm text-ink-light">
              Unit ORRIs always stay visible in tract focus. Tract ORRIs join them only when they
              burden the selected tract.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAddOrri(focusedDeskMapId)}
            className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-200/80"
          >
            + Add ORRI
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {relevantOrris.length > 0 ? (
            relevantOrris.map((orri) => (
              <LeaseholdOrriDeckCard
                key={orri.id}
                orri={orri}
                summary={summaryById.get(orri.id) ?? null}
                deskMaps={deskMaps}
                onUpdate={onUpdateOrri}
                onRemove={onRemoveOrri}
              />
            ))
          ) : (
            <LeaseholdDeckPlaceholderCard
              title="ORRI"
              tone="amber"
              body="No ORRIs are attached to this focus yet. Add one here and it will stay on the leasehold side instead of cluttering the Desk Map title tree."
            />
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
              Working Interest
            </div>
            <h3 className="mt-1 text-xl font-display font-bold text-ink">Assignments / WI Lane</h3>
            <p className="mt-1 text-sm text-ink-light">
              Unit assignments stay visible in tract focus. Tract assignments join them only when
              they split the selected tract.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onAddAssignment({
                scope: focusedDeskMapId ? 'tract' : 'unit',
                deskMapId: focusedDeskMapId,
                assignor: activeRetainedHolder,
              })
            }
            className="rounded-xl border border-leather/30 bg-leather/10 px-4 py-2 text-sm font-semibold text-leather transition-colors hover:bg-leather/15"
          >
            + Add Assignment
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <LeaseholdDeckRetainedCard
            title={activeTitle}
            holder={activeRetainedHolder}
            note={
              activeOverAssigned
                ? 'Assignments in this focus exceed 100% of the available WI. Retained WI is clamped at zero until the split is corrected.'
                : activeOverFloatingNpriBurdened
                  ? 'At least one floating NPRI in this focus exceeds the available lease royalty. Owner-side royalty rows are clamped at zero and the transfer-order review stays on hold until the royalty burden is corrected.'
                  : activeOverBurdened
                    ? 'ORRI burdens in this focus exceed the lessee\u2019s NRI, so pre-WI is clamped at zero. Review the ORRI stack below.'
                  : 'This is the remaining WI still held by the lessee/operator after the visible assignments below.'
            }
            retainedDecimal={activeRetainedWorkingInterestDecimal}
            assignedDecimal={activeAssignedWorkingInterestDecimal}
            overAssigned={activeOverAssigned}
            overBurdened={activeOverBurdened}
            overFloatingNpriBurdened={activeOverFloatingNpriBurdened}
            leaseOverlapCount={activeLeaseOverlaps.length}
          />

          {relevantAssignments.length > 0 ? (
            relevantAssignments.map((assignment) => {
              const summary = assignmentSummaryById.get(assignment.id) ?? null;
              return (
                <LeaseholdAssignmentDeckCard
                  key={assignment.id}
                  assignment={assignment}
                  summary={summary}
                  deskMaps={deskMaps}
                  focusDetail={
                    focusedTract && assignment.scope === 'unit'
                      ? {
                          label: 'This tract',
                          decimal: d(focusedTract.preWorkingInterestDecimal)
                            .times(parseInterestString(assignment.workingInterestFraction))
                            .toString(),
                        }
                      : null
                  }
                  onUpdate={onUpdateAssignment}
                  onRemove={onRemoveAssignment}
                />
              );
            })
          ) : (
            <LeaseholdDeckPlaceholderCard
              title="Assignments / WI"
              tone="leather"
              body="No WI assignments are attached to this focus yet. Add one here to start splitting the leasehold side without pushing those records back into Desk Map."
            />
          )}
        </div>
      </section>

      <LeaseholdDecimalLedger
        title={activeTitle}
        review={transferOrderReview}
        focusCoverageDetail={focusCoverageDetail}
        overAssignedFocus={activeOverAssigned}
        overBurdenedFocus={activeOverBurdened}
        overFloatingNpriBurdenedFocus={activeOverFloatingNpriBurdened}
        leaseOverlapsFocus={activeLeaseOverlaps}
        editable={focusedDeskMapId === null}
        entriesBySourceRowId={transferOrderEntriesBySourceRowId}
        onUpsertEntry={onUpsertTransferOrderEntry}
        onRemoveEntry={onRemoveTransferOrderEntry}
      />
    </div>
  );
}

export default function LeaseholdView() {
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const leaseholdUnit = useWorkspaceStore((state) => state.leaseholdUnit);
  const leaseholdAssignments = useWorkspaceStore((state) => state.leaseholdAssignments);
  const leaseholdOrris = useWorkspaceStore((state) => state.leaseholdOrris);
  const leaseholdTransferOrderEntries = useWorkspaceStore(
    (state) => state.leaseholdTransferOrderEntries
  );
  const nodes = useWorkspaceStore((state) => state.nodes);
  const updateLeaseholdUnit = useWorkspaceStore((state) => state.updateLeaseholdUnit);
  const addLeaseholdAssignment = useWorkspaceStore(
    (state) => state.addLeaseholdAssignment
  );
  const updateLeaseholdAssignment = useWorkspaceStore(
    (state) => state.updateLeaseholdAssignment
  );
  const removeLeaseholdAssignment = useWorkspaceStore(
    (state) => state.removeLeaseholdAssignment
  );
  const addLeaseholdOrri = useWorkspaceStore((state) => state.addLeaseholdOrri);
  const updateLeaseholdOrri = useWorkspaceStore((state) => state.updateLeaseholdOrri);
  const removeLeaseholdOrri = useWorkspaceStore((state) => state.removeLeaseholdOrri);
  const upsertLeaseholdTransferOrderEntry = useWorkspaceStore(
    (state) => state.upsertLeaseholdTransferOrderEntry
  );
  const removeLeaseholdTransferOrderEntry = useWorkspaceStore(
    (state) => state.removeLeaseholdTransferOrderEntry
  );
  const updateDeskMapDetails = useWorkspaceStore((state) => state.updateDeskMapDetails);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const [mode, setMode] = useState<LeaseholdMode>('overview');

  const summary = useMemo(
    () =>
      buildLeaseholdUnitSummary({
        deskMaps,
        nodes,
        owners,
        leases,
        leaseholdAssignments,
        leaseholdOrris,
      }),
    [deskMaps, leaseholdAssignments, leaseholdOrris, leases, nodes, owners]
  );
  const npriSummary = useMemo(() => {
    const trackedNpriNodes = nodes.filter(
      (node) => isNpriNode(node) && d(node.fraction).greaterThan(0)
    );
    const floatingCount = trackedNpriNodes.filter(
      (node) => node.royaltyKind === 'floating'
    ).length;

    return {
      total: trackedNpriNodes.length,
      floatingCount,
      fixedCount: trackedNpriNodes.length - floatingCount,
    };
  }, [nodes]);

  if (deskMaps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-display font-bold text-ink">No tracts yet</h2>
          <p className="text-sm text-ink-light">
            Add Desk Maps first so Leasehold can derive tract acreage and royalty coverage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-canvas-bg px-5 py-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-ledger-line bg-parchment/95 p-6 shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
                Leasehold Template
              </div>
              <h1 className="mt-2 text-3xl font-display font-bold text-ink">Leasehold</h1>
              <p className="mt-2 text-sm leading-6 text-ink-light">
                Pooled acres now drive participation here. Leasehold derives tract participation,
                owner net mineral acres, lease royalty, fixed and floating NPRI payout burdens,
                ORRI burdens, and working-interest splits from the current Desk Map title chain
                plus active lease records. Use `Overview` for setup and numeric review, and `Deck`
                for the card-based leasehold side with NPRIs, ORRIs, retained WI, and assignments.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3">
              <LeaseholdDeckModeToggle mode={mode} onChange={setMode} />
              <div className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-950">
              <div className="font-semibold">Current v1 assumption</div>
              <div className="mt-1">
                  Royalty, NPRI, ORRI, and WI payout decimals are acreage-weighted by pooled acres.
                  Gross-acre NMA and pooled-acre participation acres are both shown so the tract view
                  makes the base acreage explicit.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <SummaryCard
              label="Tracts"
              value={summary.tractCount.toString()}
              detail={`${summary.currentOwnerCount} present owners across the unit`}
            />
            <SummaryCard
              label="Gross Acres"
              value={formatAcres(summary.totalGrossAcres)}
              detail={`${summary.configuredGrossAcresCount}/${summary.tractCount} tracts configured`}
            />
            <SummaryCard
              label="Pooled Acres"
              value={formatAcres(summary.totalPooledAcres)}
              detail={`${summary.configuredPooledAcresCount}/${summary.tractCount} tracts configured`}
            />
            <SummaryCard
              label="Unit Royalty"
              value={formatPercent(summary.totalRoyaltyDecimal)}
              detail="Total unit royalty decimal from all active owner leases"
            />
            <SummaryCard
              label="Unit NPRI"
              value={formatPercent(summary.totalNpriDecimal)}
              detail={`${summary.includedNpriCount}/${summary.trackedNpriCount} NPRI branches currently in payout math`}
            />
            <SummaryCard
              label="Fully Leased"
              value={`${summary.fullyLeasedTractCount}/${summary.tractCount}`}
              detail="Based on current owner lease coverage"
            />
            <SummaryCard
              label="Lessee Set"
              value={summary.uniqueLessees.length.toString()}
              detail={
                summary.uniqueLessees.length > 0
                  ? summary.uniqueLessees.join(', ')
                  : 'No active lessees linked yet'
              }
            />
          </div>

          {npriSummary.total > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="font-semibold">NPRI payout layer active</div>
              <div className="mt-1 leading-6">
                {npriSummary.total} NPRI branch{npriSummary.total === 1 ? '' : 'es'} on file
                ({npriSummary.fixedCount} fixed, {npriSummary.floatingCount} floating). Fixed
                NPRIs now burden gross leased production; floating NPRIs now burden lease royalty.
                Review the NPRI lane and transfer-order ledger before treating the deck as final
                payout support.
              </div>
            </div>
          )}
        </header>

        {mode === 'overview' ? (
          <>
            <LeaseholdUnitEditor unit={leaseholdUnit} onUpdate={updateLeaseholdUnit} />

            <div className="space-y-4">
              {summary.tracts.map((tract) => (
                <LeaseholdTractCard
                  key={tract.deskMapId}
                  tract={tract}
                  onUpdate={updateDeskMapDetails}
                />
              ))}
            </div>
          </>
        ) : (
          <LeaseholdDeck
            deskMaps={summary.tracts}
            unit={leaseholdUnit}
            unitSummary={summary}
            unitUniqueLessees={summary.uniqueLessees}
            assignments={leaseholdAssignments}
            assignmentSummaries={summary.assignments}
            npriSummaries={summary.npris}
            orris={leaseholdOrris}
            orriSummaries={summary.orris}
            totalRoyaltyDecimal={summary.totalRoyaltyDecimal}
            totalNpriDecimal={summary.totalNpriDecimal}
            totalOrriDecimal={summary.totalOrriDecimal}
            preWorkingInterestDecimal={summary.preWorkingInterestDecimal}
            totalAssignedWorkingInterestDecimal={summary.totalAssignedWorkingInterestDecimal}
            retainedWorkingInterestDecimal={summary.retainedWorkingInterestDecimal}
            overAssignedTractCount={summary.overAssignedTractCount}
            overBurdenedTractCount={summary.overBurdenedTractCount}
            overFloatingNpriBurdenedTractCount={summary.overFloatingNpriBurdenedTractCount}
            transferOrderEntries={leaseholdTransferOrderEntries}
            onAddAssignment={addLeaseholdAssignment}
            onUpdateAssignment={updateLeaseholdAssignment}
            onRemoveAssignment={removeLeaseholdAssignment}
            onAddOrri={(focusDeskMapId) =>
              addLeaseholdOrri(
                focusDeskMapId
                  ? { scope: 'tract', deskMapId: focusDeskMapId }
                  : { scope: 'unit', deskMapId: null }
              )
            }
            onUpdateOrri={updateLeaseholdOrri}
            onRemoveOrri={removeLeaseholdOrri}
            onUpsertTransferOrderEntry={upsertLeaseholdTransferOrderEntry}
            onRemoveTransferOrderEntry={removeLeaseholdTransferOrderEntry}
          />
        )}
      </div>
    </div>
  );
}
