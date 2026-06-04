/**
 * Spreadsheet-to-Deskmap wizard — upload → preview → AI analyze or row review
 * → staged ActionPlan → explicit approval.
 *
 * AI workbook analysis is preview-only. Workbook-driven workspace mutation
 * runs only after the user approves a staged ImportSession ActionPlan.
 */
import { useState } from 'react';
import {
  parseWorkbookInWorker,
  type ParsedWorkbook,
} from './parse-workbook';
import { analyzeWorkbook } from './analyze-workbook';
import type { WorkspaceImportProposal, SheetRole } from './schemas';
import { useWorkspaceStore } from '../../store/workspace-store';
import type {
  FixedRoyaltyBasis,
  InterestClass,
  RoyaltyKind,
} from '../../types/node';
import InstrumentSelect from '../../components/shared/InstrumentSelect';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
import {
  buildStagedImportRows,
  stagedImportRowNeedsQuestion,
  validateStagedImportRow,
  type StagedImportBuildResult,
  type StagedImportRow,
  type StagedImportRowStatus,
} from './row-staging';
import {
  buildStagedImportActionPlanPreview,
  MAX_STAGED_IMPORT_PROPOSALS,
  type StagedImportActionPlanPreview,
} from './import-session-preview';
import {
  applyApprovedStagedImportActionPlan,
  type ApprovedStagedImportApplyResult,
} from './staged-apply';

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

export default function WizardPanel() {
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
      assertFileSize(file, FILE_SIZE_LIMITS.SPREADSHEET, 'Spreadsheet');
      const buffer = await file.arrayBuffer();
      // Parse off-thread so larger CSVs do not block the main thread. The
      // worker is terminated on completion.
      const result = await parseWorkbookInWorker(file.name, buffer);
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
          {status === 'parsing' ? 'Parsing CSV…' : 'AI is analyzing rows…'}
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
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10"
            >
              Choose different file
            </button>
          </div>
          <p className="text-[10px] italic text-ink-light">
            <strong>Review rows</strong> — stage spreadsheet lines as editable node drafts and approve selected rows.
            <br />
            <strong>Analyze with AI</strong> — classification and proposal preview only.
            <br />
            <strong>Review rows</strong> now builds a project-record ActionPlan
            preview from selected rows; apply requires explicit approval.
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

function StagedImportReview({
  result,
  onRowsChange,
  onReset,
}: {
  result: StagedImportBuildResult;
  onRowsChange: (rows: StagedImportRow[]) => void;
  onReset: () => void;
}) {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const nodes = useWorkspaceStore((s) => s.nodes);
  const createRootNode = useWorkspaceStore((s) => s.createRootNode);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<StagedImportActionPlanPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyResult, setApplyResult] = useState<ApprovedStagedImportApplyResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = result.rows;
  const currentRow = rows[currentIndex] ?? rows[0] ?? null;
  const currentWarnings = currentRow ? validateStagedImportRow(currentRow) : [];
  const currentRowEditable = currentRow ? isEditableRowStatus(currentRow.status) : false;
  const selectedCount = selectedRowIds.size;
  const selectedOverLimit = selectedCount > MAX_STAGED_IMPORT_PROPOSALS;
  const pendingCount = rows.filter((row) => row.status === 'pending').length;
  const needsQuestionCount = rows.filter((row) => row.status === 'needs_question').length;
  const completedCount = rows.filter((row) => !isEditableRowStatus(row.status)).length;

  const updateRows = (updater: (rows: StagedImportRow[]) => StagedImportRow[]) => {
    setPreview(null);
    setApplyResult(null);
    onRowsChange(updater(rows));
  };

  const updateCurrentRow = (fields: Partial<StagedImportRow>) => {
    if (!currentRow || !isEditableRowStatus(currentRow.status)) return;
    updateRows((existingRows) =>
      existingRows.map((row) => {
        if (row.id !== currentRow.id) return row;
        const next = { ...row, ...fields };
        const status = stagedImportRowNeedsQuestion(next)
          ? 'needs_question'
          : 'pending';
        return { ...next, status, warnings: validateStagedImportRow(next) };
      })
    );
  };

  const advanceAfter = (rowId: string, nextRows: StagedImportRow[]) => {
    const current = nextRows.findIndex((row) => row.id === rowId);
    const laterPending = nextRows.findIndex(
      (row, index) => index > current && isEditableRowStatus(row.status)
    );
    if (laterPending >= 0) {
      setCurrentIndex(laterPending);
      return;
    }
    const firstPending = nextRows.findIndex((row) =>
      isEditableRowStatus(row.status)
    );
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
    setPreview(null);
    setApplyResult(null);
    setSelectedRowIds((current) => {
      const next = new Set(current);
      next.delete(rowId);
      return next;
    });
    onRowsChange(nextRows);
    advanceAfter(rowId, nextRows);
  };

  const toggleSelectedRow = (rowId: string) => {
    setActionError(null);
    setPreview(null);
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const selectReviewableRows = () => {
    setActionError(null);
    setPreview(null);
    setSelectedRowIds(new Set(
      rows
        .filter((row) => isEditableRowStatus(row.status))
        .slice(0, MAX_STAGED_IMPORT_PROPOSALS)
        .map((row) => row.id)
    ));
  };

  const clearSelectedRows = () => {
    setActionError(null);
    setPreview(null);
    setSelectedRowIds(new Set());
  };

  const buildActionPlanPreview = async () => {
    setActionError(null);
    setPreview(null);
    setApplyResult(null);
    setPreviewBusy(true);
    try {
      const nextPreview = await buildStagedImportActionPlanPreview({
        rows,
        selectedRowIds: [...selectedRowIds],
        workspaceId,
        projectId: workspaceId,
        projectName,
        fileName: 'guided-csv-import',
      });
      setPreview(nextPreview);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewBusy(false);
    }
  };

  const approveAndApplyPreview = async () => {
    if (!preview) return;
    setActionError(null);
    setApplyBusy(true);
    try {
      const result = await applyApprovedStagedImportActionPlan({
        preview,
        approvedAt: new Date().toISOString(),
        approvedBy: 'user',
        existingNodeIds: nodes.map((node) => node.id),
        actions: {
          createRootNode,
          getLastError: () => useWorkspaceStore.getState().lastError,
        },
      });
      setApplyResult(result);
      const appliedByRowId = new Map(
        result.appliedRows.map((row) => [row.rowId, row])
      );
      const nextRows = rows.map((row) => {
        const applied = appliedByRowId.get(row.id);
        return applied
          ? { ...row, status: 'created_root' as const, createdNodeId: applied.nodeId }
          : row;
      });
      onRowsChange(nextRows);
      setSelectedRowIds((current) => {
        const next = new Set(current);
        for (const applied of result.appliedRows) next.delete(applied.rowId);
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyBusy(false);
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
            {rows.length} staged · {pendingCount} pending · {needsQuestionCount} need answer · {completedCount} handled
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
                {' '}· {summary.tractName}
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

      <div className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-ink">ActionPlan selection</div>
            <div className="text-[10px] text-ink-light">
              {selectedCount} selected · cap {MAX_STAGED_IMPORT_PROPOSALS} rows per preview · apply locked until approval
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectReviewableRows}
              className="rounded border border-leather/40 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-leather/10"
            >
              Select first {MAX_STAGED_IMPORT_PROPOSALS}
            </button>
            <button
              type="button"
              onClick={clearSelectedRows}
              className="rounded border border-leather/40 px-3 py-1.5 text-xs text-ink-light hover:bg-leather/10"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={buildActionPlanPreview}
              disabled={previewBusy || selectedCount === 0 || selectedOverLimit}
              className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
            >
              {previewBusy ? 'Building...' : 'Build ActionPlan preview'}
            </button>
          </div>
        </div>
        {selectedOverLimit && (
          <div className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-900">
            Remove {selectedCount - MAX_STAGED_IMPORT_PROPOSALS} selected row(s) before building a preview.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        {rows.map((row, index) => {
          const selected = selectedRowIds.has(row.id);
          return (
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
                    : row.status === 'needs_question'
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900'
              } ${selected && index !== currentIndex ? 'ring-2 ring-gold/70' : ''}`}
            >
              {selected ? '[selected] ' : ''}
              {row.rowNumber} · {rowStatusLabel(row.status)}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border-2 border-gold/50 bg-parchment p-3 text-xs">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-ink">
              {currentRow.sheetName} row {currentRow.rowNumber}
            </div>
            <div className="text-[10px] text-ink-light">
              {currentRowEditable
                ? 'Review, edit, then include in the ActionPlan preview.'
                : `Handled as ${rowStatusLabel(currentRow.status)}${currentRow.createdNodeId ? ` (${currentRow.createdNodeId})` : ''}.`}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentRowEditable && (
              <label className="flex items-center gap-1 rounded border border-leather/30 bg-white/60 px-2 py-1 text-[10px] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={selectedRowIds.has(currentRow.id)}
                  onChange={() => toggleSelectedRow(currentRow.id)}
                />
                Include in preview
              </label>
            )}
            <div className="rounded border border-leather/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-light">
              {currentRow.tractCode} · {currentRow.interestClass}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <StageTextField label="Grantor" value={currentRow.grantor} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ grantor: value })} />
          <StageTextField label="Grantee" value={currentRow.grantee} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ grantee: value })} />
          <InstrumentSelect value={currentRow.instrument} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ instrument: value })} />
          <StageTextField label="Fraction" value={currentRow.fractionInput} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ fractionInput: value })} />
          <StageTextField label="Doc #" value={currentRow.docNo} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ docNo: value })} />
          <div className="grid grid-cols-2 gap-2">
            <StageTextField label="Volume" value={currentRow.vol} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ vol: value })} />
            <StageTextField label="Page" value={currentRow.page} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ page: value })} />
          </div>
          <StageTextField label="Instrument Date" value={currentRow.date} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ date: value })} />
          <StageTextField label="File Date" value={currentRow.fileDate} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ fileDate: value })} />
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
            Interest Class
            <select
              value={currentRow.interestClass}
              disabled={!currentRowEditable}
              onChange={(event) => {
                const interestClass = event.target.value as InterestClass;
                updateCurrentRow({
                  interestClass,
                  royaltyKind: interestClass === 'npri' ? currentRow.royaltyKind : null,
                  fixedRoyaltyBasis: interestClass === 'npri'
                    ? currentRow.fixedRoyaltyBasis
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
                  value={currentRow.royaltyKind ?? ''}
                  disabled={!currentRowEditable}
                  onChange={(event) => {
                    const royaltyKind = event.target.value
                      ? event.target.value as Exclude<RoyaltyKind, null>
                      : null;
                    updateCurrentRow({
                      royaltyKind,
                      fixedRoyaltyBasis:
                        royaltyKind === 'fixed'
                          ? currentRow.fixedRoyaltyBasis
                          : null,
                    });
                  }}
                  className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
                >
                  <option value="">Choose...</option>
                  <option value="fixed">Fixed</option>
                  <option value="floating">Floating</option>
                </select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-light">
                Fixed Basis
                <select
                  value={currentRow.fixedRoyaltyBasis ?? ''}
                  disabled={!currentRowEditable || currentRow.royaltyKind !== 'fixed'}
                  onChange={(event) =>
                    updateCurrentRow({
                      fixedRoyaltyBasis: event.target.value
                        ? event.target.value as FixedRoyaltyBasis
                        : null,
                    })
                  }
                  className="mt-1 w-full rounded border border-leather/30 bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:bg-leather/10"
                >
                  <option value="">Choose...</option>
                  <option value="burdened_branch">Burdened branch</option>
                  <option value="whole_tract">Whole tract</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <StageTextArea label="Land Description" value={currentRow.landDesc} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ landDesc: value })} />
          <StageTextArea label="Remarks" value={currentRow.remarks} disabled={!currentRowEditable} onChange={(value) => updateCurrentRow({ remarks: value })} />
        </div>

        {currentWarnings.length > 0 && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
            {currentWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}

        {preview && (
          <ImportActionPlanPreviewSummary
            preview={preview}
            applyBusy={applyBusy}
            applyResult={applyResult}
            onApproveAndApply={approveAndApplyPreview}
          />
        )}

        {actionError && (
          <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-900">
            {actionError}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!currentRowEditable}
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
          <button
            type="button"
            onClick={buildActionPlanPreview}
            disabled={previewBusy || selectedCount === 0 || selectedOverLimit}
            className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
          >
            {previewBusy ? 'Building...' : 'Build ActionPlan preview'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ImportActionPlanPreviewSummary({
  preview,
  applyBusy,
  applyResult,
  onApproveAndApply,
}: {
  preview: StagedImportActionPlanPreview;
  applyBusy: boolean;
  applyResult: ApprovedStagedImportApplyResult | null;
  onApproveAndApply: () => void;
}) {
  const blockedCount = preview.session.candidates.filter(
    (candidate) => candidate.questions.length > 0
  ).length;
  const canApply = blockedCount === 0 && !applyBusy && applyResult === null;
  return (
    <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-[10px] text-emerald-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-emerald-950">ActionPlan dry-run ready</div>
          <div className="text-emerald-900">
            {preview.session.candidates.length} candidate(s) · {blockedCount} blocked by questions
          </div>
        </div>
        <div className="rounded border border-emerald-400/70 px-2 py-1 font-mono text-[10px]">
          staged_apply_requires_approval
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {preview.session.candidates.map((candidate) => (
          <li key={candidate.candidateId} className="rounded border border-emerald-300/70 bg-white/60 px-2 py-1">
            <div className="font-semibold text-emerald-950">
              {candidate.proposedAction.summary}
            </div>
            <div className="font-mono text-[10px] text-emerald-900">
              {candidate.proposedAction.actionKind} · {candidate.proposedAction.targetRecordType}
            </div>
            {candidate.questions.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-amber-900">
                {candidate.questions.map((question) => (
                  <li key={question.questionId}>
                    {question.field ?? 'review'}: {question.prompt}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 text-emerald-900">
        Dry-run preview: no live graph, AI tool, or .landroid write occurs before explicit approval.
      </div>
      {applyResult ? (
        <div className="mt-2 rounded border border-emerald-400 bg-white/70 p-2 font-semibold text-emerald-950">
          Applied {applyResult.appliedRows.length} approved row(s) from this ActionPlan.
        </div>
      ) : (
        <button
          type="button"
          onClick={onApproveAndApply}
          disabled={!canApply}
          className="mt-2 rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light disabled:opacity-40"
        >
          {applyBusy ? 'Applying...' : 'Approve staged ActionPlan'}
        </button>
      )}
    </div>
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
  if (status === 'needs_question') return 'needs answer';
  if (status === 'created_root') return 'root';
  if (status === 'attached') return 'attached';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function isEditableRowStatus(status: StagedImportRowStatus): boolean {
  return status === 'pending' || status === 'needs_question';
}

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  return (
    <label className="block cursor-pointer rounded-lg border-2 border-dashed border-leather/40 bg-parchment/40 p-6 text-center text-xs text-ink-light hover:border-gold hover:bg-parchment">
      <div className="mb-1 font-semibold text-ink">Upload a spreadsheet</div>
      <div>.csv — landman runsheet, NRI status, document list</div>
      <div className="mt-2 text-[10px] uppercase tracking-wide">
        click to choose a file
      </div>
      <input
        type="file"
        accept=".csv"
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

      <section className="rounded-lg border border-leather/30 bg-parchment p-3 text-xs text-ink-light">
        AI proposal is preview-only. Use row review to build and approve a
        staged ImportSession ActionPlan before any workspace mutation.
      </section>
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
