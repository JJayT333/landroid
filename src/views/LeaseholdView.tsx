import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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
  type LeaseholdOwnerLeaseSummary,
  type LeaseholdOwnerSummary,
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

function formatFixedNpriBasisLabel(value: LeaseholdNpriSummary['fixedRoyaltyBasis']) {
  if (value === 'whole_tract') {
    return 'Whole tract basis';
  }
  return 'Branch basis';
}

interface LeaseholdGraphOwnerBranch {
  owner: LeaseholdOwnerSummary;
  leaseSlices: LeaseholdOwnerLeaseSummary[];
  npris: LeaseholdNpriSummary[];
}

interface LeaseholdGraphTractDetail {
  ownerBranches: LeaseholdGraphOwnerBranch[];
  orris: LeaseholdOrriSummary[];
  assignments: LeaseholdAssignmentSummary[];
}

function compareLeaseholdGraphText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareDecimalStringsDesc(left: string, right: string) {
  return d(right).comparedTo(d(left));
}

function sortLeaseholdGraphLeaseSlices(leaseSlices: LeaseholdOwnerLeaseSummary[]) {
  return [...leaseSlices].sort((left, right) => {
    const leasedFractionDiff = compareDecimalStringsDesc(
      left.leasedFraction,
      right.leasedFraction
    );
    if (leasedFractionDiff !== 0) {
      return leasedFractionDiff;
    }

    const effectiveDateDiff = right.leaseEffectiveDate.localeCompare(left.leaseEffectiveDate);
    if (effectiveDateDiff !== 0) {
      return effectiveDateDiff;
    }

    return compareLeaseholdGraphText(
      left.leaseName || left.lessee,
      right.leaseName || right.lessee
    );
  });
}

export function buildLeaseholdGraphTractDetail({
  tract,
  unitSummary,
}: {
  tract: LeaseholdTractSummary;
  unitSummary: ReturnType<typeof buildLeaseholdUnitSummary>;
}): LeaseholdGraphTractDetail {
  const nprisByBranchNodeId = new Map<string, LeaseholdNpriSummary[]>();

  unitSummary.npris
    .filter((npri) => npri.deskMapId === tract.deskMapId)
    .forEach((npri) => {
      if (!npri.burdenedBranchNodeId) {
        return;
      }

      const current = nprisByBranchNodeId.get(npri.burdenedBranchNodeId) ?? [];
      current.push(npri);
      nprisByBranchNodeId.set(npri.burdenedBranchNodeId, current);
    });

  const ownerBranches = [...tract.owners]
    .map((owner) => ({
      owner,
      leaseSlices: sortLeaseholdGraphLeaseSlices(owner.leaseSlices),
      npris: [...(nprisByBranchNodeId.get(owner.nodeId) ?? [])].sort((left, right) => {
        const includedDiff = Number(right.includedInMath) - Number(left.includedInMath);
        if (includedDiff !== 0) {
          return includedDiff;
        }

        const burdenDiff = compareDecimalStringsDesc(
          left.tractBurdenRate,
          right.tractBurdenRate
        );
        if (burdenDiff !== 0) {
          return burdenDiff;
        }

        return compareLeaseholdGraphText(left.payee, right.payee);
      }),
    }))
    .sort((left, right) => {
      const leasedFractionDiff = compareDecimalStringsDesc(
        left.owner.leasedFraction,
        right.owner.leasedFraction
      );
      if (leasedFractionDiff !== 0) {
        return leasedFractionDiff;
      }

      const fractionDiff = compareDecimalStringsDesc(left.owner.fraction, right.owner.fraction);
      if (fractionDiff !== 0) {
        return fractionDiff;
      }

      return compareLeaseholdGraphText(left.owner.ownerName, right.owner.ownerName);
    });

  const orris = unitSummary.orris
    .filter(
      (orri) =>
        orri.includedInMath && (orri.scope === 'unit' || orri.deskMapId === tract.deskMapId)
    )
    .sort((left, right) => {
      if (left.scope !== right.scope) {
        return left.scope === 'tract' ? -1 : 1;
      }

      const decimalDiff = compareDecimalStringsDesc(left.unitDecimal, right.unitDecimal);
      if (decimalDiff !== 0) {
        return decimalDiff;
      }

      return compareLeaseholdGraphText(left.payee, right.payee);
    });

  const assignments = unitSummary.assignments
    .filter(
      (assignment) =>
        assignment.includedInMath
        && (assignment.scope === 'unit' || assignment.deskMapId === tract.deskMapId)
    )
    .sort((left, right) => {
      if (left.scope !== right.scope) {
        return left.scope === 'tract' ? -1 : 1;
      }

      const decimalDiff = compareDecimalStringsDesc(left.unitDecimal, right.unitDecimal);
      if (decimalDiff !== 0) {
        return decimalDiff;
      }

      return compareLeaseholdGraphText(left.assignee, right.assignee);
    });

  return {
    ownerBranches,
    orris,
    assignments,
  };
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

type LeaseholdMode = 'overview' | 'map' | 'deck';

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
      {(['overview', 'map', 'deck'] as const).map((option) => (
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
          {option === 'overview' ? 'Overview' : option === 'map' ? 'Map' : 'Deck'}
        </button>
      ))}
    </div>
  );
}

function LeaseholdMapPanZoomContainer({ children }: { children: ReactNode }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const pendingPointerId = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) {
      return;
    }

    dragging.current = true;
    hasDragged.current = false;
    pendingPointerId.current = e.pointerId;
    startPos.current = { x: e.clientX, y: e.clientY };
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) {
      return;
    }

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (!hasDragged.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      hasDragged.current = true;
      if (pendingPointerId.current !== null) {
        const element = containerRef.current;
        if (element) {
          element.setPointerCapture(pendingPointerId.current);
        }
        pendingPointerId.current = null;
      }
    }

    if (!hasDragged.current) {
      return;
    }

    const moveX = e.clientX - lastPos.current.x;
    const moveY = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((currentPan) => ({ x: currentPan.x + moveX, y: currentPan.y + moveY }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    pendingPointerId.current = null;
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      setZoom((currentZoom) => {
        const factor = event.deltaY > 0 ? 0.92 : 1.08;
        const nextZoom = Math.max(0.1, Math.min(3, currentZoom * factor));

        setPan((currentPan) => ({
          x: mouseX - ((mouseX - currentPan.x) / currentZoom) * nextZoom,
          y: mouseY - ((mouseY - currentPan.y) / currentZoom) * nextZoom,
        }));

        return nextZoom;
      });
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged.current = false;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-10 h-full w-full cursor-grab overflow-hidden select-none touch-none active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="inline-block p-12"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function LeaseholdGraphUnitCard({
  unit,
  unitSummary,
}: {
  unit: LeaseholdUnit;
  unitSummary: ReturnType<typeof buildLeaseholdUnitSummary>;
}) {
  return (
    <div className="w-80 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-ink shadow-[0_8px_18px_rgba(5,150,105,0.14)]">
      <div className="rounded-t-lg border-b border-emerald-200 bg-emerald-100/80 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
            Leasehold Unit
          </span>
          <span className="rounded-full border border-emerald-300 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-900">
            Root
          </span>
        </div>
        <div className="mt-1 text-lg font-display font-bold text-emerald-950">
          {unit.name || 'Unit-wide Leasehold'}
        </div>
        <div className="mt-1 text-xs text-emerald-900/80">
          {unit.operator || unitSummary.uniqueLessees[0] || 'Operator / lessee not set'}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4 text-sm">
        <div className="text-[11px] leading-5 text-emerald-900/85">
          Unit overview only. Click a tract below to open the owner-branch and lease-slice detail
          tree.
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            {unitSummary.tractCount} tract{unitSummary.tractCount === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            Pooled {formatAcres(unitSummary.totalPooledAcres)} ac
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            Royalty {formatPercent(unitSummary.totalRoyaltyDecimal)}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            NPRI {formatPercent(unitSummary.totalNpriDecimal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphOverviewTractCard({
  tract,
  selected,
  onSelect,
}: {
  tract: LeaseholdTractSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasWarnings =
    tract.overAssigned || tract.overBurdened || tract.overFloatingNpriBurdened
    || tract.leaseOverlaps.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-72 rounded-lg border-2 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${
        selected
          ? 'border-leather bg-leather/10'
          : 'border-ledger-line bg-parchment hover:border-leather/40'
      }`}
    >
      <div className="rounded-t-lg border-b border-ledger-line bg-parchment-dark/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
              {tract.code}
            </div>
            <div className="mt-1 text-base font-display font-bold text-ink">
              {tract.name}
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              selected
                ? 'bg-leather text-parchment'
                : 'border border-ledger-line bg-white/80 text-ink-light'
            }`}
          >
            {selected ? 'Focused' : 'Open'}
          </span>
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-light">
          <div>
            <div className="font-semibold uppercase tracking-wide text-ink/70">Pooled Acres</div>
            <div className="mt-1 text-sm font-semibold text-ink">{formatAcres(tract.pooledAcres)}</div>
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wide text-ink/70">TPF</div>
            <div className="mt-1 text-sm font-semibold text-ink">{formatPercent(tract.unitParticipation)}</div>
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wide text-ink/70">Leased</div>
            <div className="mt-1 text-sm font-semibold text-ink">{formatPercent(tract.leasedOwnership)}</div>
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wide text-ink/70">Royalty</div>
            <div className="mt-1 text-sm font-semibold text-ink">{formatPercent(tract.unitRoyaltyDecimal)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            {tract.currentOwnerCount} owner{tract.currentOwnerCount === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            {tract.trackedNpriCount} NPRI
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            {tract.trackedOrriCount} ORRI
          </span>
          {tract.trackedAssignmentCount > 0 && (
            <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
              {tract.trackedAssignmentCount} WI split
            </span>
          )}
          {hasWarnings && (
            <span className="rounded-full border border-seal/25 bg-seal/10 px-2 py-0.5 text-[10px] text-seal">
              Needs review
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function LeaseholdGraphTractRootCard({
  tract,
}: {
  tract: LeaseholdTractSummary;
}) {
  return (
    <div className="w-80 rounded-lg border-2 border-leather/30 bg-leather/5 text-ink shadow-[0_8px_18px_rgba(120,53,15,0.12)]">
      <div className="rounded-t-lg border-b border-leather/20 bg-leather/10 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leather">
              Tract Focus
            </div>
            <div className="mt-1 text-lg font-display font-bold text-ink">
              {tract.name} ({tract.code})
            </div>
          </div>
          <span className="rounded-full border border-leather/20 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-leather">
            Detail
          </span>
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="text-[11px] leading-5 text-ink-light">
          {tract.description || 'No tract note yet.'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Gross {formatAcres(tract.grossAcres)} ac
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Pooled {formatAcres(tract.pooledAcres)} ac
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            TPF {formatPercent(tract.unitParticipation)}
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Leased {formatPercent(tract.leasedOwnership)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphOwnerBranchCard({
  branch,
}: {
  branch: LeaseholdGraphOwnerBranch;
}) {
  const { owner, leaseSlices, npris } = branch;

  return (
    <div className="w-72 rounded-lg border-2 border-ledger-line bg-parchment text-ink shadow-sm">
      <div className="rounded-t-lg border-b border-ledger-line bg-parchment-dark/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
            Owner Branch
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-light">
            {leaseSlices.length > 0 ? `${leaseSlices.length} lease${leaseSlices.length === 1 ? '' : 's'}` : 'Unleased'}
          </span>
        </div>
        <div className="mt-1 text-base font-display font-bold text-ink">
          {owner.ownerName || 'Unnamed owner'}
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Mineral {formatPercent(owner.fraction)}
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Leased {formatPercent(owner.leasedFraction)}
          </span>
          <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
            Net royalty {formatPercent(owner.netOwnerUnitRoyaltyDecimal)}
          </span>
          {npris.length > 0 && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] text-sky-900">
              {npris.length} NPRI
            </span>
          )}
          {owner.overFloatingNpriBurdened && (
            <span className="rounded-full border border-seal/25 bg-seal/10 px-2 py-0.5 text-[10px] text-seal">
              Floating over-carve
            </span>
          )}
        </div>
        <div className="text-[11px] leading-5 text-ink-light">
          {leaseSlices.length > 0
            ? 'Lease slices show how this branch currently pays under active leases. NPRIs stay attached to the branch they burden.'
            : 'No active lease slice on this branch yet. NPRIs below stay tracked here until the branch is leased.'}
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphLeaseSliceCard({
  leaseSlice,
}: {
  leaseSlice: LeaseholdOwnerLeaseSummary;
}) {
  return (
    <div className="w-64 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-ink shadow-[0_8px_18px_rgba(5,150,105,0.12)]">
      <div className="rounded-t-lg border-b border-emerald-200 bg-emerald-100/80 px-3 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
          Lease Slice
        </div>
        <div className="mt-1 text-sm font-display font-bold text-emerald-950">
          {leaseSlice.leaseName || leaseSlice.lessee || 'Unnamed lease'}
        </div>
        <div className="mt-1 text-[10px] text-emerald-900/80">
          {[leaseSlice.lessee, leaseSlice.leaseEffectiveDate, leaseSlice.leaseDocNo ? `Doc# ${leaseSlice.leaseDocNo}` : '']
            .filter(Boolean)
            .join(' • ')}
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            Royalty {leaseSlice.leaseRoyaltyRate || '—'}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white/80 px-2 py-0.5 text-[10px] text-emerald-900">
            Leased {formatPercent(leaseSlice.leasedFraction)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900/85">
          <div>
            <div className="font-semibold uppercase tracking-wide">Owner royalty</div>
            <div className="mt-1 text-sm font-semibold text-emerald-950">
              {formatPercent(leaseSlice.ownerTractRoyalty)}
            </div>
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wide">Net after floating NPRI</div>
            <div className="mt-1 text-sm font-semibold text-emerald-950">
              {formatPercent(leaseSlice.netOwnerTractRoyalty)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphUnleasedBranchCard({
  ownerName,
}: {
  ownerName: string;
}) {
  return (
    <div className="w-60 rounded-lg border-2 border-gold/35 bg-gold/10 text-gold-950 shadow-sm">
      <div className="rounded-t-lg border-b border-gold/30 bg-gold/15 px-3 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">
          Unleased Branch
        </div>
      </div>
      <div className="px-3 py-3 text-sm leading-6">
        {ownerName || 'This branch'} has no active lease slice yet. Any NPRIs below stay tracked
        on this branch until a lease actually covers it.
      </div>
    </div>
  );
}

function LeaseholdGraphNpriLeafCard({
  npri,
}: {
  npri: LeaseholdNpriSummary;
}) {
  const toneClasses = npri.royaltyKind === 'floating'
    ? 'border-sky-300 bg-sky-50 text-sky-950'
    : 'border-amber-300 bg-amber-50 text-amber-950';

  return (
    <div className={`w-60 rounded-lg border-2 shadow-sm ${toneClasses}`}>
      <div className="rounded-t-lg border-b border-current/20 bg-white/40 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">NPRI</span>
          <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
            {formatNpriKindLabel(npri.royaltyKind)}
          </span>
        </div>
        <div className="mt-1 text-sm font-display font-bold">
          {npri.payee || 'Unnamed NPRI'}
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="text-[11px] leading-5 opacity-85">
          Burden {npri.burdenFraction || '—'} on the {npri.burdenedBranchOwner} branch.
        </div>
        {npri.royaltyKind === 'fixed' && (
          <div className="text-[10px] uppercase tracking-wide opacity-75">
            {formatFixedNpriBasisLabel(npri.fixedRoyaltyBasis)}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {npri.includedInMath ? (
            <>
              <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px]">
                Tract burden {formatPercent(npri.tractBurdenRate)}
              </span>
              <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px]">
                Unit dec {formatPercent(npri.unitDecimal)}
              </span>
            </>
          ) : (
            <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px]">
              Tracked only until this branch is leased
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphOwnerBranchTree({
  branch,
}: {
  branch: LeaseholdGraphOwnerBranch;
}) {
  const childNodes = [
    ...branch.leaseSlices.map((leaseSlice) => ({
      key: `lease-${leaseSlice.leaseId}`,
      element: <LeaseholdGraphLeaseSliceCard leaseSlice={leaseSlice} />,
    })),
    ...branch.npris.map((npri) => ({
      key: `npri-${npri.id}`,
      element: <LeaseholdGraphNpriLeafCard npri={npri} />,
    })),
  ];

  if (childNodes.length === 0) {
    childNodes.push({
      key: `unleased-${branch.owner.nodeId}`,
      element: <LeaseholdGraphUnleasedBranchCard ownerName={branch.owner.ownerName} />,
    });
  }

  return (
    <div className="tree-branch">
      <LeaseholdGraphOwnerBranchCard branch={branch} />
      <div className="tree-children">
        {childNodes.map((child) => (
          <div key={child.key} className="tree-branch">
            {child.element}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaseholdGraphEmptyLeafCard({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="w-60 rounded-lg border-2 border-ledger-line bg-parchment-dark/70 px-3 py-3 text-sm text-ink-light shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
        {title}
      </div>
      <div className="mt-2 leading-6">{note}</div>
    </div>
  );
}

function LeaseholdGraphOrriBranchCard({
  tract,
  orris,
}: {
  tract: LeaseholdTractSummary;
  orris: LeaseholdOrriSummary[];
}) {
  const totalDecimal = orris.reduce((sum, orri) => sum.plus(orri.unitDecimal), d(0));

  return (
    <div className="w-72 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-950 shadow-[0_8px_18px_rgba(217,119,6,0.14)]">
      <div className="rounded-t-lg border-b border-amber-300 bg-amber-100/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
            ORRI Branch
          </span>
          <span className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
            {orris.length} burden{orris.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-1 text-base font-display font-bold text-amber-950">
          {tract.code} Leasehold Burdens
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[10px] text-amber-900">
            Total {formatPercent(totalDecimal.toString())}
          </span>
          <span className="rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[10px] text-amber-900">
            Pre-WI base {formatPercent(tract.npriAdjustedNriBeforeOrriRate)}
          </span>
        </div>
        <div className="text-[11px] leading-5 text-amber-900/85">
          ORRIs stay on the leasehold side. Tract-only burdens hit this tract only; unit burdens
          remain visible here because they still reduce this tract&apos;s pre-WI base.
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphOrriLeafCard({
  orri,
  tractCode,
}: {
  orri: LeaseholdOrriSummary;
  tractCode: string;
}) {
  return (
    <div className="w-60 rounded-lg border-2 border-amber-200 bg-amber-50/80 px-3 py-3 text-amber-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
            ORRI
          </div>
          <div className="mt-1 text-sm font-display font-bold text-amber-950">
            {orri.payee || 'Unnamed ORRI'}
          </div>
        </div>
        <span className="rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[10px] text-amber-900">
          {formatPercent(orri.unitDecimal)}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-[11px] leading-5 text-amber-900/85">
        <div>
          {formatOrriBasisLabel(orri.burdenBasis)} on{' '}
          {orri.scope === 'unit' ? 'the whole unit' : tractCode}.
        </div>
        <div>
          {[orri.effectiveDate, orri.sourceDocNo ? `Doc# ${orri.sourceDocNo}` : '']
            .filter(Boolean)
            .join(' • ') || 'No source date/doc yet'}
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphOrriBranchTree({
  tract,
  orris,
}: {
  tract: LeaseholdTractSummary;
  orris: LeaseholdOrriSummary[];
}) {
  const childNodes = orris.length > 0
    ? orris.map((orri) => ({
        key: `orri-${orri.id}`,
        element: <LeaseholdGraphOrriLeafCard orri={orri} tractCode={tract.code} />,
      }))
    : [
        {
          key: 'orri-empty',
          element: (
            <LeaseholdGraphEmptyLeafCard
              title="No ORRIs"
              note="No leasehold overrides currently burden this tract."
            />
          ),
        },
      ];

  return (
    <div className="tree-branch">
      <LeaseholdGraphOrriBranchCard tract={tract} orris={orris} />
      <div className="tree-children">
        {childNodes.map((child) => (
          <div key={child.key} className="tree-branch">
            {child.element}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaseholdGraphWorkingInterestBranchCard({
  tract,
  assignmentCount,
}: {
  tract: LeaseholdTractSummary;
  assignmentCount: number;
}) {
  return (
    <div className="w-72 rounded-lg border-2 border-leather/30 bg-leather/5 text-ink shadow-[0_8px_18px_rgba(120,53,15,0.12)]">
      <div className="rounded-t-lg border-b border-leather/20 bg-leather/10 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leather">
            Working Interest
          </span>
          <span className="rounded-full border border-leather/20 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-leather">
            {assignmentCount} split{assignmentCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-1 text-base font-display font-bold text-ink">
          {tract.code} WI Stack
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-leather/20 bg-white/80 px-2 py-0.5 text-[10px] text-leather">
            Pre-WI {formatPercent(tract.preWorkingInterestDecimal)}
          </span>
          <span className="rounded-full border border-leather/20 bg-white/80 px-2 py-0.5 text-[10px] text-leather">
            Retained {formatPercent(tract.retainedWorkingInterestDecimal)}
          </span>
        </div>
        <div className="text-[11px] leading-5 text-ink-light">
          WI stays downstream of royalty, NPRI, and ORRI burdens. Retained WI remains visible even
          when there are no assignment splits yet.
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphRetainedWorkingInterestLeafCard({
  tract,
}: {
  tract: LeaseholdTractSummary;
}) {
  return (
    <div className="w-60 rounded-lg border-2 border-ledger-line bg-parchment px-3 py-3 text-ink shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
        Retained WI
      </div>
      <div className="mt-2 text-lg font-display font-bold text-ink">
        {formatPercent(tract.retainedWorkingInterestDecimal)}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-ink-light">
        Assigned {formatPercent(tract.assignedWorkingInterestDecimal)} from a pre-WI base of{' '}
        {formatPercent(tract.preWorkingInterestDecimal)}.
      </div>
    </div>
  );
}

function LeaseholdGraphAssignmentLeafCard({
  assignment,
  tractCode,
}: {
  assignment: LeaseholdAssignmentSummary;
  tractCode: string;
}) {
  return (
    <div className="w-60 rounded-lg border-2 border-leather/20 bg-leather/5 px-3 py-3 text-ink shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leather">
            WI Assignment
          </div>
          <div className="mt-1 text-sm font-display font-bold text-ink">
            {assignment.assignee || 'Unnamed assignee'}
          </div>
        </div>
        <span className="rounded-full border border-leather/20 bg-white/80 px-2 py-0.5 text-[10px] text-leather">
          {formatPercent(assignment.unitDecimal)}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-[11px] leading-5 text-ink-light">
        <div>
          {assignment.assignor || 'WI assignment'} •{' '}
          {assignment.scope === 'unit' ? 'Unit-wide' : tractCode}
        </div>
        <div>
          {[assignment.effectiveDate, assignment.sourceDocNo ? `Doc# ${assignment.sourceDocNo}` : '']
            .filter(Boolean)
            .join(' • ') || 'No source date/doc yet'}
        </div>
      </div>
    </div>
  );
}

function LeaseholdGraphWorkingInterestTree({
  tract,
  assignments,
}: {
  tract: LeaseholdTractSummary;
  assignments: LeaseholdAssignmentSummary[];
}) {
  const childNodes = [
    {
      key: 'retained-wi',
      element: <LeaseholdGraphRetainedWorkingInterestLeafCard tract={tract} />,
    },
    ...(
      assignments.length > 0
        ? assignments.map((assignment) => ({
            key: `assignment-${assignment.id}`,
            element: (
              <LeaseholdGraphAssignmentLeafCard
                assignment={assignment}
                tractCode={tract.code}
              />
            ),
          }))
        : [
            {
              key: 'assignment-empty',
              element: (
                <LeaseholdGraphEmptyLeafCard
                  title="No WI Split"
                  note="No unit or tract assignments currently split this tract's working interest."
                />
              ),
            },
          ]
    ),
  ];

  return (
    <div className="tree-branch">
      <LeaseholdGraphWorkingInterestBranchCard
        tract={tract}
        assignmentCount={assignments.length}
      />
      <div className="tree-children">
        {childNodes.map((child) => (
          <div key={child.key} className="tree-branch">
            {child.element}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaseholdGraphMode({
  unit,
  unitSummary,
}: {
  unit: LeaseholdUnit;
  unitSummary: ReturnType<typeof buildLeaseholdUnitSummary>;
}) {
  const [focusedDeskMapId, setFocusedDeskMapId] = useState<string | null>(null);

  useEffect(() => {
    if (focusedDeskMapId && !unitSummary.tracts.some((tract) => tract.deskMapId === focusedDeskMapId)) {
      setFocusedDeskMapId(null);
    }
  }, [focusedDeskMapId, unitSummary.tracts]);

  const focusedTract = focusedDeskMapId
    ? unitSummary.tracts.find((tract) => tract.deskMapId === focusedDeskMapId) ?? null
    : null;
  const tractDetail = useMemo(
    () =>
      focusedTract
        ? buildLeaseholdGraphTractDetail({
            tract: focusedTract,
            unitSummary,
          })
        : null,
    [focusedTract, unitSummary]
  );

  return (
    <section className="relative h-full min-h-[42rem] overflow-hidden rounded-3xl border border-ledger-line bg-canvas-bg shadow-md">
      <div className="absolute left-3 top-3 z-20 w-[22rem] max-w-[calc(100%-1.5rem)] space-y-2.5 rounded-xl border border-ledger-line bg-parchment/92 p-3 shadow-md backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-light">
              Leasehold Map
            </div>
            <div className="mt-1 text-lg font-display font-bold text-ink">
              {focusedTract ? `${focusedTract.name} (${focusedTract.code})` : unit.name || 'Unit Overview'}
            </div>
          </div>
          {focusedTract ? (
            <button
              type="button"
              onClick={() => setFocusedDeskMapId(null)}
              className="rounded-lg border border-ledger-line bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-light transition-colors hover:border-leather/40 hover:text-ink"
            >
              Unit View
            </button>
          ) : (
            <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-light">
              Full Canvas
            </span>
          )}
        </div>
        <div className="text-[11px] leading-5 text-ink-light">
          Desk Map stays mineral title. Leasehold Map stays payout-side and uses the same tracts
          without changing the legal meaning of the title chain.
        </div>
        <div className="flex flex-wrap gap-1.5">
          {focusedTract ? (
            <>
              <span className="rounded-full border border-leather/20 bg-leather/10 px-2 py-0.5 text-[10px] text-leather">
                Royalty {formatPercent(focusedTract.unitRoyaltyDecimal)}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] text-sky-900">
                NPRI {formatPercent(focusedTract.unitNpriDecimal)}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-900">
                ORRI {formatPercent(focusedTract.unitOrriDecimal)}
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                WI {formatPercent(focusedTract.retainedWorkingInterestDecimal)}
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                {unitSummary.tractCount} tract{unitSummary.tractCount === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                Pooled {formatAcres(unitSummary.totalPooledAcres)} ac
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                Royalty {formatPercent(unitSummary.totalRoyaltyDecimal)}
              </span>
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-light">
            {focusedTract ? 'Switch Tract Focus' : 'Open Tract Detail'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unitSummary.tracts.map((tract) => {
              const isFocused = tract.deskMapId === focusedDeskMapId;

              return (
                <button
                  key={tract.deskMapId}
                  type="button"
                  onClick={() => setFocusedDeskMapId(tract.deskMapId)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    isFocused
                      ? 'bg-leather text-parchment'
                      : 'bg-leather/10 text-leather hover:bg-leather/15'
                  }`}
                >
                  {tract.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 w-[19rem] max-w-[calc(100%-1.5rem)] rounded-xl border border-ledger-line bg-parchment/92 p-3 shadow-md backdrop-blur">
        {focusedTract && tractDetail ? (
          <div className="space-y-2.5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-light">
                Tract Map Notes
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {tractDetail.ownerBranches.length} owner branch
                {tractDetail.ownerBranches.length === 1 ? '' : 'es'}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                Gross {formatAcres(focusedTract.grossAcres)} ac
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                TPF {formatPercent(focusedTract.unitParticipation)}
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                Leased {formatPercent(focusedTract.leasedOwnership)}
              </span>
            </div>
            {focusedTract.overFloatingNpriBurdened && (
              <div className="rounded-lg border border-seal/25 bg-seal/5 px-3 py-2 text-[11px] leading-5 text-seal">
                Floating NPRIs exceed available lease royalty on at least one branch. Editing stays
                open, but payout review remains on hold until the burden mix is corrected.
              </div>
            )}
            {focusedTract.leaseOverlaps.length > 0 && (
              <div className="rounded-lg border border-seal/25 bg-seal/5 px-3 py-2 text-[11px] leading-5 text-seal">
                {focusedTract.leaseOverlaps.length} lease overlap warning
                {focusedTract.leaseOverlaps.length === 1 ? '' : 's'} still need landman review.
              </div>
            )}
            <div className="rounded-lg border border-ledger-line bg-white/80 px-3 py-2 text-[11px] leading-5 text-ink-light">
              Owner branches stay separate. Lease slices and NPRIs remain attached to the branch
              they burden, while ORRI and WI stay as tract-level leasehold branches.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-light">
                Unit Map Notes
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                Click a tract card to open its full leasehold branch map.
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                {unitSummary.currentOwnerCount} owners
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                {unitSummary.trackedNpriCount} NPRI
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-2 py-0.5 text-[10px] text-ink">
                {unitSummary.trackedOrriCount} ORRI
              </span>
            </div>
            <div className="rounded-lg border border-ledger-line bg-white/80 px-3 py-2 text-[11px] leading-5 text-ink-light">
              Map mode is full-size and visual-first. Overview is still the setup surface, and Deck
              remains the editable payout and transfer-order review surface.
            </div>
          </div>
        )}
      </div>

      <LeaseholdMapPanZoomContainer>
        {focusedTract && tractDetail ? (
          <div className="tree-branch">
            <LeaseholdGraphTractRootCard tract={focusedTract} />
            <div className="tree-children">
              {tractDetail.ownerBranches.map((branch) => (
                <LeaseholdGraphOwnerBranchTree
                  key={branch.owner.nodeId}
                  branch={branch}
                />
              ))}
              <LeaseholdGraphOrriBranchTree tract={focusedTract} orris={tractDetail.orris} />
              <LeaseholdGraphWorkingInterestTree
                tract={focusedTract}
                assignments={tractDetail.assignments}
              />
            </div>
          </div>
        ) : (
          <div className="tree-branch">
            <LeaseholdGraphUnitCard unit={unit} unitSummary={unitSummary} />
            <div className="tree-children">
              {unitSummary.tracts.map((tract) => (
                <div key={tract.deskMapId} className="tree-branch">
                  <LeaseholdGraphOverviewTractCard
                    tract={tract}
                    selected={tract.deskMapId === focusedDeskMapId}
                    onSelect={() => setFocusedDeskMapId(tract.deskMapId)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </LeaseholdMapPanZoomContainer>
    </section>
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
          {summary.royaltyKind === 'fixed' && (
            <span className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] text-sky-900/85">
              {formatFixedNpriBasisLabel(summary.fixedRoyaltyBasis)}
            </span>
          )}
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
              These royalty burdens come from Desk Map title branches. Floating NPRIs burden lease
              royalty. Fixed NPRIs can now be tracked either as a burdened-branch fraction or as a
              whole-tract fixed burden, depending on the deed. Edit the deed terms on Desk Map,
              then review the payout decimals here.
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
  const isMapMode = mode === 'map';

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
    <div
      className={`h-full bg-canvas-bg px-5 py-5 ${
        isMapMode ? 'overflow-hidden' : 'overflow-auto'
      }`}
    >
      <div
        className={
          isMapMode ? 'flex h-full flex-col space-y-5' : 'mx-auto max-w-7xl space-y-5'
        }
      >
        <header className="shrink-0 rounded-3xl border border-ledger-line bg-parchment/95 p-6 shadow-md">
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
                plus active lease records. Use `Overview` for setup and numeric review, `Map` for
                the full-size leasehold canvas, and `Deck` for the card-based leasehold side with
                NPRIs, ORRIs, retained WI, and assignments.
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

          {isMapMode ? (
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-ledger-line bg-white/80 px-3 py-1.5 font-medium text-ink">
                {summary.tractCount} tract{summary.tractCount === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-3 py-1.5 font-medium text-ink">
                Gross {formatAcres(summary.totalGrossAcres)} ac
              </span>
              <span className="rounded-full border border-ledger-line bg-white/80 px-3 py-1.5 font-medium text-ink">
                Pooled {formatAcres(summary.totalPooledAcres)} ac
              </span>
              <span className="rounded-full border border-leather/20 bg-leather/10 px-3 py-1.5 font-medium text-leather">
                Royalty {formatPercent(summary.totalRoyaltyDecimal)}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 font-medium text-sky-900">
                NPRI {formatPercent(summary.totalNpriDecimal)}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900">
                ORRI {formatPercent(summary.totalOrriDecimal)}
              </span>
            </div>
          ) : (
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
          )}

          {npriSummary.total > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="font-semibold">NPRI payout layer active</div>
              <div className="mt-1 leading-6">
                {npriSummary.total} NPRI branch{npriSummary.total === 1 ? '' : 'es'} on file
                ({npriSummary.fixedCount} fixed, {npriSummary.floatingCount} floating). Fixed
                NPRIs now carry a deed-basis choice, so LANDroid can distinguish whole-tract fixed
                burdens from branch-based fixed burdens; floating NPRIs still burden lease royalty.
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
        ) : isMapMode ? (
          <div className="min-h-0 flex-1">
            <LeaseholdGraphMode unit={leaseholdUnit} unitSummary={summary} />
          </div>
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
