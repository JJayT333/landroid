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

type Status = 'idle' | 'parsing' | 'parsed' | 'analyzing' | 'analyzed' | 'error';

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

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setError(null);
    setProposal(null);
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
    try {
      const result = await analyzeWorkbook(parsed);
      setProposal(result);
      setStatus('analyzed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const handleReset = () => {
    setParsed(null);
    setProposal(null);
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
              onClick={handleAnalyze}
              className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-ink-light"
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
            <strong>Analyze with AI</strong> — deterministic apply plan (creates desk maps only).
            <br />
            <strong>Walk me through it</strong> — conversational import: AI proposes, asks clarifying
            questions, creates owners as standalone trees you can graft later.
          </p>
        </div>
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
