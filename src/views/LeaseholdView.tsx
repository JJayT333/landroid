import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { d } from '../engine/decimal';
import { formatAsFraction } from '../engine/fraction-display';
import {
  LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS,
  LEASEHOLD_ORRI_SCOPE_OPTIONS,
  type LeaseholdOrri,
  type LeaseholdUnit,
} from '../types/leasehold';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  buildLeaseholdUnitSummary,
  type LeaseholdOrriSummary,
  type LeaseholdTractSummary,
} from '../components/leasehold/leasehold-summary';

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
            {formatAcres(tract.pooledAcres)} pooled acres. Weighted royalty{' '}
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
            Unit royalty {formatPercent(tract.unitRoyaltyDecimal)}
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
        <span>Unit royalty contribution {formatPercent(tract.unitRoyaltyDecimal)}</span>
        <span>Gross ORRI rate {formatPercent(tract.grossOrriRate)}</span>
        <span>Unit ORRI contribution {formatPercent(tract.unitOrriDecimal)}</span>
        <span>Pre-WI unit NRI {formatPercent(tract.preWorkingInterestDecimal)}</span>
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
                Net Pooled Acres
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Lessee
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Royalty
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Unit Royalty
              </th>
            </tr>
          </thead>
          <tbody>
            {tract.owners.map((owner) => (
              <tr key={owner.nodeId} className="border-t border-ledger-line bg-parchment">
                <td className="px-3 py-2">
                  <div className="font-semibold text-ink">{owner.ownerName}</div>
                  <div className="text-xs text-ink-light">
                    {owner.leaseName || 'Lease record not named'}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatAsFraction(d(owner.fraction))}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatAcres(owner.netMineralAcres)}
                </td>
                <td className="px-3 py-2 text-xs text-ink">
                  {owner.lessee || 'Open'}
                </td>
                <td className="px-3 py-2 text-xs text-ink">
                  {owner.royaltyRate ? `${owner.royaltyRate} (${formatPercent(owner.royaltyBurden)})` : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">
                  {formatPercent(owner.unitRoyaltyDecimal)}
                </td>
              </tr>
            ))}
            {tract.owners.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-ink-light">
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

function LeaseholdOrriRow({
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
  const [sourceDocNoDraft, setSourceDocNoDraft] = useState(orri.sourceDocNo);

  useEffect(() => {
    setPayeeDraft(orri.payee);
  }, [orri.payee]);

  useEffect(() => {
    setBurdenFractionDraft(orri.burdenFraction);
  }, [orri.burdenFraction]);

  useEffect(() => {
    setSourceDocNoDraft(orri.sourceDocNo);
  }, [orri.sourceDocNo]);

  return (
    <div className="rounded-2xl border border-ledger-line bg-parchment p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_10rem_13rem_10rem_11rem_11rem_auto]">
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
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
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
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
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          >
            {LEASEHOLD_ORRI_SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'unit' ? 'Unit-wide' : 'Single tract'}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
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
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather disabled:bg-parchment-dark/60 disabled:text-ink-light"
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
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Burden
          </div>
          <input
            value={burdenFractionDraft}
            onChange={(event) => setBurdenFractionDraft(event.target.value)}
            onBlur={() => {
              const next = burdenFractionDraft.trim();
              setBurdenFractionDraft(next);
              if (next !== orri.burdenFraction) {
                onUpdate(orri.id, { burdenFraction: next });
              }
            }}
            placeholder="1/64"
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Burden Basis
          </div>
          <select
            value={orri.burdenBasis}
            onChange={(event) =>
              onUpdate(orri.id, {
                burdenBasis: event.target.value as LeaseholdOrri['burdenBasis'],
              })
            }
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          >
            {LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatOrriBasisLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
            Effective Date
          </div>
          <input
            type="date"
            value={orri.effectiveDate}
            onChange={(event) =>
              onUpdate(orri.id, { effectiveDate: event.target.value })
            }
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onRemove(orri.id)}
            className="w-full rounded-xl border border-seal/20 bg-seal/10 px-3 py-2 text-sm font-medium text-seal transition-colors hover:bg-seal/15"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
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
            className="w-full rounded-xl border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
          />
        </label>

        <div className="flex flex-wrap items-end gap-2 text-xs">
          <span className="rounded-full bg-ink/5 px-3 py-1.5 font-medium text-ink-light">
            {orri.scope === 'unit' ? 'Unit-wide burden' : summary?.tractName ?? 'Single tract burden'}
          </span>
          <span className="rounded-full bg-leather/10 px-3 py-1.5 font-medium text-leather">
            {formatOrriBasisLabel(orri.burdenBasis)}
          </span>
          {summary?.includedInMath ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
              Unit decimal {formatPercent(summary.unitDecimal)}
            </span>
          ) : (
            <span className="rounded-full bg-gold/10 px-3 py-1.5 font-medium text-gold-900">
              Tracked only until gross 8/8 math applies
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaseholdOrriEditor({
  deskMaps,
  orris,
  orriSummaries,
  totalOrriDecimal,
  preWorkingInterestDecimal,
  includedOrriCount,
  excludedOrriCount,
  onAdd,
  onUpdate,
  onRemove,
}: {
  deskMaps: Array<Pick<LeaseholdTractSummary, 'deskMapId' | 'name' | 'code'>>;
  orris: LeaseholdOrri[];
  orriSummaries: LeaseholdOrriSummary[];
  totalOrriDecimal: string;
  preWorkingInterestDecimal: string;
  includedOrriCount: number;
  excludedOrriCount: number;
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<LeaseholdOrri>) => void;
  onRemove: (id: string) => void;
}) {
  const summaryById = new Map(orriSummaries.map((summary) => [summary.id, summary]));

  return (
    <section className="rounded-3xl border border-ledger-line bg-parchment/95 p-5 shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-light">
            Leasehold Burdens
          </div>
          <h2 className="mt-1 text-2xl font-display font-bold text-ink">ORRI</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-light">
            ORRIs stay on the leasehold side. This first pass includes only gross `8/8`
            burdens in the math; NRI- and WI-based burdens are tracked here but excluded
            from totals until the later WI layer exists.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-leather/20 bg-leather px-4 py-2 text-sm font-semibold text-parchment shadow-sm transition-colors hover:bg-leather/90"
        >
          + Add ORRI
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Tracked ORRIs"
          value={orris.length.toString()}
          detail={`${includedOrriCount} included in current math`}
        />
        <SummaryCard
          label="Excluded"
          value={excludedOrriCount.toString()}
          detail="Tracked only because the burden basis is not gross 8/8"
        />
        <SummaryCard
          label="Total ORRI"
          value={formatPercent(totalOrriDecimal)}
          detail="Current unit burden from included ORRIs"
        />
        <SummaryCard
          label="Pre-WI NRI"
          value={formatPercent(preWorkingInterestDecimal)}
          detail="Unit net revenue before any WI splits"
        />
      </div>

      <div className="mt-4 space-y-3">
        {orris.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ledger-line bg-parchment-dark/40 px-4 py-5 text-sm text-ink-light">
            No ORRIs recorded yet. Add a unit-wide or tract-specific burden to start checking the
            leasehold side before WI splits.
          </div>
        ) : (
          orris.map((orri) => (
            <LeaseholdOrriRow
              key={orri.id}
              orri={orri}
              summary={summaryById.get(orri.id) ?? null}
              deskMaps={deskMaps}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function LeaseholdView() {
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const leaseholdUnit = useWorkspaceStore((state) => state.leaseholdUnit);
  const leaseholdOrris = useWorkspaceStore((state) => state.leaseholdOrris);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const updateLeaseholdUnit = useWorkspaceStore((state) => state.updateLeaseholdUnit);
  const addLeaseholdOrri = useWorkspaceStore((state) => state.addLeaseholdOrri);
  const updateLeaseholdOrri = useWorkspaceStore((state) => state.updateLeaseholdOrri);
  const removeLeaseholdOrri = useWorkspaceStore((state) => state.removeLeaseholdOrri);
  const updateDeskMapDetails = useWorkspaceStore((state) => state.updateDeskMapDetails);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);

  const summary = useMemo(
    () =>
      buildLeaseholdUnitSummary({
        deskMaps,
        nodes,
        owners,
        leases,
        leaseholdOrris,
      }),
    [deskMaps, leaseholdOrris, leases, nodes, owners]
  );

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
                Pooled acres now drive participation here. This first framework slice derives tract
                participation, owner net mineral acres, total royalty, and gross-basis ORRI burden
                from the current Desk Map title chain plus active lease records. WI,
                division-order rows, and payout math stay for the next phase.
              </p>
            </div>
            <div className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-950">
              <div className="font-semibold">Current v1 assumption</div>
              <div className="mt-1">
                Royalty and gross-basis ORRI burdens are acreage-weighted by pooled acres, and the
                5-tract demo is fully leased at 1/8 for easy audit checks.
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
              label="Total Royalty"
              value={formatPercent(summary.totalRoyaltyDecimal)}
              detail="Weighted from all active owner lease rates"
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
        </header>

        <LeaseholdUnitEditor unit={leaseholdUnit} onUpdate={updateLeaseholdUnit} />

        <LeaseholdOrriEditor
          deskMaps={summary.tracts}
          orris={leaseholdOrris}
          orriSummaries={summary.orris}
          totalOrriDecimal={summary.totalOrriDecimal}
          preWorkingInterestDecimal={summary.preWorkingInterestDecimal}
          includedOrriCount={summary.includedOrriCount}
          excludedOrriCount={summary.excludedOrriCount}
          onAdd={() => {
            const defaultDeskMapId = summary.tracts[0]?.deskMapId ?? null;
            addLeaseholdOrri({
              scope: defaultDeskMapId ? 'tract' : 'unit',
              deskMapId: defaultDeskMapId,
            });
          }}
          onUpdate={updateLeaseholdOrri}
          onRemove={removeLeaseholdOrri}
        />

        <div className="space-y-4">
          {summary.tracts.map((tract) => (
            <LeaseholdTractCard
              key={tract.deskMapId}
              tract={tract}
              onUpdate={updateDeskMapDetails}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
