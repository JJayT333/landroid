/**
 * Spreadsheet-to-Deskmap wizard — upload → preview → AI analyze → review →
 * validated apply.
 *
 * The apply step builds a deterministic plan, runs `validateOwnershipGraph`
 * on the existing nodes, surfaces collisions, then commits via the workspace
 * store. AI never writes to the store directly.
 */
import { useMemo, useState } from 'react';
import {
  parseWorkbook,
  renderWorkbookForPrompt,
  type ParsedWorkbook,
} from './parse-workbook';
import { analyzeWorkbook } from './analyze-workbook';
import type { WorkspaceImportProposal, SheetRole } from './schemas';
import {
  buildApplyPlan,
  executeApplyPlan,
  type ApplyPlan,
  type ApplyResult,
} from './apply-proposal';
import { useWorkspaceStore } from '../../store/workspace-store';
import type {
  FixedRoyaltyBasis,
  InterestClass,
  OwnershipNode,
  RoyaltyKind,
} from '../../types/node';
import {
  buildImportNodeId,
  buildStagedImportRows,
  parseImportFraction,
  stagedRowToNodeForm,
  suggestParentForRow,
  validateStagedImportRow,
  type StagedImportBuildResult,
  type StagedImportRow,
  type StagedImportRowStatus,
} from './row-staging';

type Status = 'idle' | 'parsing' | 'parsed' | 'staged' | 'analyzing' | 'analyzed' | 'error';

const ROLE_LABELS: Record<SheetRole, { label: string; tone: string }> = {
  'leasehold-runsheet': { label: 'Leasehold runsheet', tone: 'emerald' },
  'mineral-title': { label: 'Mineral title', tone: 'sky' },
  'npri-title': { label: 'NPRI title', tone: 'green' },
  'document-list': { label: 'Document list', tone: 'slate' },
  'status-summary': { label: 'Status / output', tone: 'amber' },
  'tract-map': { label: 'Tract map', tone: 'violet' },
  ignore: { label: 'Ignore', tone: 'zinc' },
  unknown: { label: 'Unknown', tone: 'rose' },
};

export default function WizardPanel({
  onStartGuided,
}: {
  onStartGuided?: (workbookText: string) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [proposal, setProposal] = useState<WorkspaceImportProposal | null>(null);
  const [stageResult, setStageResult] = useState<StagedImportBuildResult | null>(null);

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setError(null);
    setProposal(null);
    setStageResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseWorkbook(file.name, buffer);
      setParsed(result);
      setStatus('parsed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const handleAnalyze = async () => {
    if (!parsed) return;
    setStatus('analyzing');
    setError(null);
    setStageResult(null);
    try {
      const result = await analyzeWorkbook(parsed);
      setProposal(result);
      setStatus('analyzed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const handleStageRows = () => {
    if (!parsed) return;
    setProposal(null);
    setStageResult(buildStagedImportRows(parsed));
    setStatus('staged');
  };

  const handleReset = () => {
    setParsed(null);
    setProposal(null);
    setStageResult(null);
    setError(null);
    setStatus('idle');
  };

  return (
    <div className="space-y-3 text-sm text-ink">
      {status === 'idle' && <UploadZone onFile={handleFile} />}

      {(status === 'parsing' || status === 'analyzing') && (
        <div className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs text-ink-light">
          {status === 'parsing' ? 'Parsing workbook…' : 'AI is analyzing sheets…'}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-rose-400 bg-rose-50 p-3 text-xs text-rose-900">
          <div className="mb-1 font-semibold">Error</div>
          {error}
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 rounded border border-rose-400 px-2 py-0.5 text-[10px] hover:bg-rose-100"
          >
            Start over
          </button>
        </div>
      )}

      {parsed && status !== 'idle' && (
        <WorkbookSummary parsed={parsed} />
      )}

      {status === 'parsed' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStageRows}
              className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light"
            >
              Review rows
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              className="rounded border border-leather/40 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-leather/10"
            >
              Analyze with AI
            </button>
            {onStartGuided && parsed && (
              <button
                type="button"
                onClick={() => onStartGuided(renderWorkbookForPrompt(parsed))}
                className="rounded border-2 border-gold bg-gold/10 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gold/20"
                title="Switch to chat and walk through the import row-by-row with the AI, using mutating tools."
              >
                Walk me through it ↗
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10"
            >
              Choose different file
            </button>
          </div>
          <p className="text-[10px] italic text-ink-light">
            <strong>Review rows</strong> — stage spreadsheet lines as editable node drafts and attach them one at a time.
            <br />
            <strong>Analyze with AI</strong> — deterministic apply plan (creates desk maps only).
            <br />
            <strong>Walk me through it</strong> — conversational import: AI proposes, asks clarifying
            questions, creates owners as standalone trees you can graft later.
          </p>
        </div>
      )}

      {status === 'staged' && stageResult && (
        <StagedImportReview
          result={stageResult}
          onRowsChange={(rows) =>
            setStageResult((current) => current ? { ...current, rows } : current)
          }
          onReset={handleReset}
        />
      )}

      {proposal && <ProposalView proposal={proposal} onReset={handleReset} />}
    </div>
  );
}

function ApplySection({ proposal }: { proposal: WorkspaceImportProposal }) {
  const projectName = useWorkspaceStore((s) => s.projectName);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const createDeskMap = useWorkspaceStore((s) => s.createDeskMap);
  const updateDeskMapDetails = useWorkspaceStore((s) => s.updateDeskMapDetails);

  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan: ApplyPlan = useMemo(
    () => buildApplyPlan(proposal, { projectName, deskMaps, nodes }),
    [proposal, projectName, deskMaps, nodes]
  );

  const onApply = () => {
    setError(null);
    try {
      const result = executeApplyPlan(plan, {
        setProjectName,
        createDeskMap,
        updateDeskMapDetails,
      });
      setApplied(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (applied) {
    return (
      <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
        <div className="font-semibold">Applied to workspace.</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {applied.projectRenamed && (
            <li>Project renamed to "{plan.projectNameChange}"</li>
          )}
          {applied.createdDeskMapIds.length > 0 && (
            <li>{applied.createdDeskMapIds.length} desk map(s) created</li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border-2 border-gold/50 bg-parchment p-3 text-xs">
      <h4 className="font-semibold uppercase tracking-wide text-ink">
        Apply plan
      </h4>

      <ul className="space-y-1 text-[11px] text-ink">
        {plan.projectNameChange && (
          <li>
            <strong>Rename project</strong> →{' '}
            <span className="font-mono">{plan.projectNameChange}</span>
          </li>
        )}
        <li>
          <strong>Create desk maps:</strong> {plan.deskMapsToCreate.length}
          {plan.deskMapsToCreate.length > 0 && (
            <span className="ml-1 font-mono text-ink-light">
              ({plan.deskMapsToCreate.map((d) => d.code).join(', ')})
            </span>
          )}
        </li>
        {plan.collisions.length > 0 && (
          <li className="text-amber-800">
            <strong>Skip (already exist):</strong> {plan.collisions.length}{' '}
            <span className="font-mono">
              ({plan.collisions.map((c) => c.code).join(', ')})
            </span>
          </li>
        )}
      </ul>

      {plan.existingGraphIssues.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
          <strong>{plan.existingGraphIssues.length} pre-existing graph issue(s)</strong>{' '}
          in the current workspace. Apply is allowed but you should fix these
          first.
        </div>
      )}

      {plan.blockers.length > 0 && (
        <div className="rounded border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-900">
          {plan.blockers.map((b, i) => (
            <div key={i}>{b}</div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-400 bg-rose-50 p-2 text-[10px] text-rose-900">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onApply}
        disabled={plan.blockers.length > 0}
        className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
      >
        Apply to workspace
      </button>
    </section>
  );
}

function StagedImportReview({
  result,
  onRowsChange,
  onReset,
}: {
  result: StagedImportBuildResult;
  onRowsChange: (rows: StagedImportRow[]) => void;
  onReset: () => void;
}) {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const activeDeskMapId = useWorkspaceStore((s) => s.activeDeskMapId);
  const createRootNode = useWorkspaceStore((s) => s.createRootNode);
  const convey = useWorkspaceStore((s) => s.convey);
  const createNpri = useWorkspaceStore((s) => s.createNpri);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetDeskMapId, setTargetDeskMapId] = useState(
    activeDeskMapId ?? deskMaps[0]?.id ?? ''
  );
  const [parentSelections, setParentSelections] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = result.rows;
  const currentRow = rows[currentIndex] ?? rows[0] ?? null;
  const suggestion = useMemo(
    () => currentRow ? suggestParentForRow(currentRow, nodes) : null,
    [currentRow, nodes]
  );
  const selectedParentId = currentRow
    ? parentSelections[currentRow.id] ?? suggestion?.nodeId ?? ''
    : '';
  const currentWarnings = currentRow ? validateStagedImportRow(currentRow) : [];
  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const completedCount = rows.filter((row) => row.status !== 'pending').length;
  const parentOptions = useMemo(
    () => nodes
      .filter((node) => {
        if (!currentRow || node.type === 'related') return false;
        if (currentRow.interestClass === 'mineral') {
          return node.interestClass === 'mineral';
        }
        return node.interestClass === 'mineral' || node.interestClass === 'npri';
      })
      .sort((a, b) =>
        (a.grantee || a.grantor || a.id).localeCompare(b.grantee || b.grantor || b.id)
      ),
    [currentRow, nodes]
  );

  const updateRows = (updater: (rows: StagedImportRow[]) => StagedImportRow[]) => {
    onRowsChange(updater(rows));
  };

  const updateCurrentRow = (fields: Partial<StagedImportRow>) => {
    if (!currentRow || currentRow.status !== 'pending') return;
    updateRows((existingRows) =>
      existingRows.map((row) => {
        if (row.id !== currentRow.id) return row;
        const next = { ...row, ...fields };
        return { ...next, warnings: validateStagedImportRow(next) };
      })
    );
  };

  const advanceAfter = (rowId: string, nextRows: StagedImportRow[]) => {
    const current = nextRows.findIndex((row) => row.id === rowId);
    const laterPending = nextRows.findIndex(
      (row, index) => index > current && row.status === 'pending'
    );
    if (laterPending >= 0) {
      setCurrentIndex(laterPending);
      return;
    }
    const firstPending = nextRows.findIndex((row) => row.status === 'pending');
    if (firstPending >= 0) {
      setCurrentIndex(firstPending);
      return;
    }
    setCurrentIndex(Math.max(0, current));
  };

  const markRow = (
    rowId: string,
    status: StagedImportRowStatus,
    createdNodeId: string | null
  ) => {
    const nextRows = rows.map((row) =>
      row.id === rowId ? { ...row, status, createdNodeId } : row
    );
    onRowsChange(nextRows);
    advanceAfter(rowId, nextRows);
  };

  const setSelectedParent = (rowId: string, nodeId: string) => {
    setParentSelections((current) => ({ ...current, [rowId]: nodeId }));
  };

  const createFromCurrentRow = (mode: 'root' | 'attach') => {
    if (!currentRow) return;
    setActionError(null);

    const parsedFraction = parseImportFraction(currentRow.fractionInput);
    if (!parsedFraction.ok) {
      setActionError(parsedFraction.error);
      return;
    }
    if (!currentRow.grantee.trim()) {
      setActionError('Grantee is required before creating a node.');
      return;
    }

    const store = useWorkspaceStore.getState();
    const nodeId = buildImportNodeId(
      currentRow,
      new Set(store.nodes.map((node) => node.id))
    );
    const form = stagedRowToNodeForm(currentRow, parsedFraction.value);
    let ok = false;

    if (mode === 'root') {
      ok = createRootNode(
        nodeId,
        parsedFraction.value,
        form,
        targetDeskMapId || undefined
      );
      if (ok) {
        markRow(currentRow.id, 'created_root', nodeId);
      }
    } else {
      const parent = store.nodes.find((node) => node.id === selectedParentId);
      if (!parent) {
        setActionError('Choose a parent before attaching this row.');
        return;
      }
      if (currentRow.interestClass === 'npri' && parent.interestClass === 'mineral') {
        ok = createNpri(parent.id, nodeId, parsedFraction.value, form);
      } else if (parent.interestClass === currentRow.interestClass) {
        ok = convey(parent.id, nodeId, parsedFraction.value, form);
      } else {
        setActionError('Mineral rows can only attach to mineral parents. NPRI rows can attach to mineral or NPRI parents.');
        return;
      }
      if (ok) {
        markRow(currentRow.id, 'attached', nodeId);
      }
    }

    if (!ok) {
      setActionError(useWorkspaceStore.getState().lastError ?? 'Node creation failed.');
    }
  };

  const skipCurrentRow = () => {
    if (!currentRow) return;
    setActionError(null);
    markRow(currentRow.id, 'skipped', null);
  };

  if (!currentRow) {
    return (
      <section className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
        <div className="font-semibold">No rows ready for review.</div>
        {result.warnings.map((warning) => (
          <div key={warning} className="mt-1">{warning}</div>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="mt-2 rounded border border-rose-400 px-2 py-0.5 text-[10px] hover:bg-rose-100"
        >
          Start over
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-display font-bold text-ink">Row Review</h3>
          <p className="text-[10px] text-ink-light">
            {rows.length} staged · {pendingCount} pending · {completedCount} handled
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-leather/40 px-2 py-0.5 text-[10px] text-ink-light hover:bg-leather/10"
        >
          Start over
        </button>
      </div>

      {(result.warnings.length > 0 || result.sheetSummaries.length > 0) && (
        <details className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-ink">
            Sheet mapping
          </summary>
          <ul className="mt-2 space-y-1 text-[10px] text-ink-light">
            {result.sheetSummaries.map((summary) => (
              <li key={summary.sheetName}>
                <span className="font-mono text-ink">{summary.sheetName}</span> ·{' '}
                {summary.headerRowNumber
                  ? `header row ${summary.headerRowNumber}, ${summary.stagedRowCount} row(s)`
                  : 'no title header found'}
                {summary.mappedFields.length > 0 && (
                  <span> · {summary.mappedFields.join(', ')}</span>
                )}
              </li>
            ))}
            {result.warnings.map((warning) => (
              <li key={warning} className="text-amber-800">{warning}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              setActionError(null);
              setCurrentIndex(index);
            }}
            className={`rounded border px-2 py-1 font-mono ${
              index === currentIndex
                ? 'border-ink bg-ink text-parchment'
                : row.status === 'pending'
                  ? 'border-leather/30 bg-parchment text-ink'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900'
            }`}
          >
            {row.rowNumber} · {rowStatusLabel(row.status)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border-2 border-gold/50 bg-parchment p-3 text-xs">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-ink">
              {currentRow.sheetName} row {currentRow.rowNumber}
            </div>
            <div className="text-[10px] text-ink-light">
              {currentRow.status === 'pending'
                ? 'Review, edit, then create or attach.'
                : `Handled as ${rowStatusLabel(currentRow.status)}${currentRow.createdNodeId ? ` (${currentRow.createdNodeId})` : ''}.`}
            </div>
          </div>
          <div className="rounded border border-leather/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-light">
            {currentRow.interestClass}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <StageTextField label="Grantor" value={currentRow.grantor} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ grantor: value })} />
          <StageTextField label="Grantee" value={currentRow.grantee} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ grantee: value })} />
          <StageTextField label="Instrument" value={currentRow.instrument} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ instrument: value })} />
          <StageTextField label="Fraction" value={currentRow.fractionInput} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ fractionInput: value })} />
          <StageTextField label="Doc #" value={currentRow.docNo} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ docNo: value })} />
          <div className="grid grid-cols-2 gap-2">
            <StageTextField label="Volume" value={currentRow.vol} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ vol: value })} />
            <StageTextField label="Page" value={currentRow.page} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ page: value })} />
          </div>
          <StageTextField label="Instrument Date" value={currentRow.date} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ date: value })} />
          <StageTextField label="File Date" value={currentRow.fileDate} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ fileDate: value })} />
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
            Interest Class
            <select
              value={currentRow.interestClass}
              disabled={currentRow.status !== 'pending'}
              onChange={(event) => {
                const interestClass = event.target.value as InterestClass;
                updateCurrentRow({
                  interestClass,
                  royaltyKind: interestClass === 'npri' ? currentRow.royaltyKind ?? 'fixed' : null,
                  fixedRoyaltyBasis:
                    interestClass === 'npri'
                      ? currentRow.fixedRoyaltyBasis ?? 'burdened_branch'
                      : null,
                });
              }}
              className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
            >
              <option value="mineral">Mineral</option>
              <option value="npri">NPRI</option>
            </select>
          </label>
          {currentRow.interestClass === 'npri' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
                Royalty Kind
                <select
                  value={currentRow.royaltyKind ?? 'fixed'}
                  disabled={currentRow.status !== 'pending'}
                  onChange={(event) => {
                    const royaltyKind = event.target.value as Exclude<RoyaltyKind, null>;
                    updateCurrentRow({
                      royaltyKind,
                      fixedRoyaltyBasis:
                        royaltyKind === 'fixed'
                          ? currentRow.fixedRoyaltyBasis ?? 'burdened_branch'
                          : null,
                    });
                  }}
                  className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
                >
                  <option value="fixed">Fixed</option>
                  <option value="floating">Floating</option>
                </select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
                Fixed Basis
                <select
                  value={currentRow.fixedRoyaltyBasis ?? 'burdened_branch'}
                  disabled={currentRow.status !== 'pending' || currentRow.royaltyKind === 'floating'}
                  onChange={(event) =>
                    updateCurrentRow({
                      fixedRoyaltyBasis: event.target.value as FixedRoyaltyBasis,
                    })
                  }
                  className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
                >
                  <option value="burdened_branch">Burdened branch</option>
                  <option value="whole_tract">Whole tract</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <StageTextArea label="Land Description" value={currentRow.landDesc} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ landDesc: value })} />
          <StageTextArea label="Remarks" value={currentRow.remarks} disabled={currentRow.status !== 'pending'} onChange={(value) => updateCurrentRow({ remarks: value })} />
        </div>

        {currentWarnings.length > 0 && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
            {currentWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}

        {suggestion && currentRow.status === 'pending' && (
          <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-2 text-[10px] text-emerald-900">
            Suggested parent: <span className="font-semibold">{suggestion.label}</span>{' '}
            ({suggestion.confidence}, {suggestion.reason})
          </div>
        )}

        {currentRow.status === 'pending' && (
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr]">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
              Root Desk Map
              <select
                value={targetDeskMapId}
                onChange={(event) => setTargetDeskMapId(event.target.value)}
                className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink"
              >
                {deskMaps.length === 0 && <option value="">No desk map selected</option>}
                {deskMaps.map((deskMap) => (
                  <option key={deskMap.id} value={deskMap.id}>
                    {deskMap.name} {deskMap.code ? `(${deskMap.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
              Parent
              <select
                value={selectedParentId}
                onChange={(event) => setSelectedParent(currentRow.id, event.target.value)}
                className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink"
              >
                <option value="">Choose parent...</option>
                {parentOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {nodeLabel(node)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {actionError && (
          <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-900">
            {actionError}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={currentRow.status !== 'pending'}
            onClick={() => createFromCurrentRow('attach')}
            className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
          >
            Attach to parent
          </button>
          <button
            type="button"
            disabled={currentRow.status !== 'pending'}
            onClick={() => createFromCurrentRow('root')}
            className="rounded border border-leather/40 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-leather/10 disabled:opacity-40"
          >
            Create root
          </button>
          <button
            type="button"
            disabled={currentRow.status !== 'pending'}
            onClick={skipCurrentRow}
            className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10 disabled:opacity-40"
          >
            Skip row
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(Math.min(rows.length - 1, currentIndex + 1))}
            className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function StageTextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
      {label}
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
      />
    </label>
  );
}

function StageTextArea({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
      {label}
      <textarea
        value={value}
        disabled={disabled}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
      />
    </label>
  );
}

function rowStatusLabel(status: StagedImportRowStatus): string {
  if (status === 'created_root') return 'root';
  if (status === 'attached') return 'attached';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function nodeLabel(node: OwnershipNode): string {
  const name = node.grantee || node.grantor || node.id;
  const doc = node.docNo ? ` · Doc ${node.docNo}` : '';
  return `${name}${doc} · ${node.interestClass} · ${node.fraction}`;
}

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  return (
    <label className="block cursor-pointer rounded-lg border-2 border-dashed border-leather/40 bg-parchment/40 p-6 text-center text-xs text-ink-light hover:border-gold hover:bg-parchment">
      <div className="mb-1 font-semibold text-ink">Upload a spreadsheet</div>
      <div>.xlsx or .csv — landman runsheet, NRI status, document list</div>
      <div className="mt-2 text-[10px] uppercase tracking-wide">
        click to choose a file
      </div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function WorkbookSummary({ parsed }: { parsed: ParsedWorkbook }) {
  return (
    <details open className="rounded-lg border border-leather/30 bg-parchment">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink">
        {parsed.fileName} · {parsed.sheets.length} sheet
        {parsed.sheets.length === 1 ? '' : 's'}
      </summary>
      <ul className="divide-y divide-leather/20 border-t border-leather/20 text-[11px] text-ink-light">
        {parsed.sheets.map((s) => (
          <li key={s.name} className="flex items-center justify-between px-3 py-1.5">
            <span className="truncate font-mono">{s.name}</span>
            <span className="ml-2 shrink-0">
              {s.rawRowCount}r × {s.rawColCount}c
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ProposalView({
  proposal,
  onReset,
}: {
  proposal: WorkspaceImportProposal;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-bold text-ink">AI Proposal</h3>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-leather/40 px-2 py-0.5 text-[10px] text-ink-light hover:bg-leather/10"
        >
          Start over
        </button>
      </div>

      {Object.keys(proposal.project).length > 0 && (
        <section className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs">
          <h4 className="mb-1 font-semibold uppercase tracking-wide text-ink-light">
            Project header
          </h4>
          <ul className="space-y-0.5 font-mono text-[11px] text-ink">
            {proposal.project.unitName && <li>unit: {proposal.project.unitName}</li>}
            {proposal.project.operator && <li>operator: {proposal.project.operator}</li>}
            {proposal.project.county && <li>county: {proposal.project.county}</li>}
            {proposal.project.state && <li>state: {proposal.project.state}</li>}
            {proposal.project.totalAcres && <li>total acres: {proposal.project.totalAcres}</li>}
            {proposal.project.effectiveDate && (
              <li>effective: {proposal.project.effectiveDate}</li>
            )}
          </ul>
        </section>
      )}

      {proposal.tracts.length > 0 && (
        <section className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs">
          <h4 className="mb-1 font-semibold uppercase tracking-wide text-ink-light">
            Tracts
          </h4>
          <ul className="space-y-1 font-mono text-[11px]">
            {proposal.tracts.map((t) => (
              <li key={t.code} className="flex items-center gap-2">
                <span className="rounded bg-ink/80 px-1.5 py-0.5 text-parchment">
                  {t.code}
                </span>
                {t.grossAcres && <span>{t.grossAcres} ac</span>}
                {t.nprGroups && t.nprGroups.length > 0 && (
                  <span className="text-ink-light">
                    NPR: {t.nprGroups.join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">
          Sheet classifications
        </h4>
        {proposal.sheets.map((s) => (
          <SheetProposalCard key={s.sheetName} sheet={s} />
        ))}
      </section>

      {proposal.clarifyingQuestions.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <h4 className="mb-1 font-semibold uppercase tracking-wide">
            Clarifying questions
          </h4>
          <ul className="list-disc space-y-1 pl-4">
            {proposal.clarifyingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {proposal.warnings.length > 0 && (
        <section className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
          <h4 className="mb-1 font-semibold uppercase tracking-wide">Warnings</h4>
          <ul className="list-disc space-y-1 pl-4">
            {proposal.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <ApplySection proposal={proposal} />
    </div>
  );
}

function SheetProposalCard({ sheet }: { sheet: WorkspaceImportProposal['sheets'][number] }) {
  const meta = ROLE_LABELS[sheet.role];
  return (
    <div className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-ink" title={sheet.sheetName}>
          {sheet.sheetName}
        </span>
        <span
          className={`shrink-0 rounded border border-${meta.tone}-300 bg-${meta.tone}-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-${meta.tone}-900`}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-light">
        <span>confidence: {sheet.confidence}</span>
        {sheet.tractCode && <span>· tract: {sheet.tractCode}</span>}
        {sheet.tractCodes && sheet.tractCodes.length > 0 && (
          <span>· tracts: {sheet.tractCodes.join(',')}</span>
        )}
      </div>
      {sheet.columnMap && Object.keys(sheet.columnMap).length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-ink-light">
            column map ({Object.keys(sheet.columnMap).length})
          </summary>
          <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
            {Object.entries(sheet.columnMap).map(([col, field]) => (
              <li key={col}>
                <span className="text-ink-light">{col}</span> →{' '}
                <span className="text-ink">{field}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {sheet.notes && (
        <p className="mt-1 text-[10px] italic text-ink-light">{sheet.notes}</p>
      )}
    </div>
  );
}
