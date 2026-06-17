/**
 * Curative Requirement Report — a printable, numbered list of the title
 * requirements (curative issues) for an examiner / closing file. Mirrors the
 * Leasehold Audit Sheet: a print-styled overlay whose scoped `@media print`
 * block isolates the report subtree so the app chrome never lands on the page.
 */
import { useMemo } from 'react';
import {
  buildCurativeRequirementReport,
  type CurativeReportContext,
  type CurativeRequirement,
} from '../../curative/requirement-report';
import type { TitleIssue } from '../../types/title-issue';

function RequirementBlock({ requirement }: { requirement: CurativeRequirement }) {
  return (
    <section className="mb-4 break-inside-avoid border-b border-ledger-line/60 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[14px] font-bold text-ink">
          Requirement {requirement.number}.{' '}
          <span className="font-semibold">{requirement.title}</span>
        </h3>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-light">
          {requirement.priority} · {requirement.status}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-light">{requirement.issueType}</div>

      {requirement.affected.length > 0 && (
        <ul className="mt-1 text-[11px] text-ink">
          {requirement.affected.map((label) => (
            <li key={label} className="font-mono">{label}</li>
          ))}
        </ul>
      )}

      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        {requirement.requiredCurativeAction && (
          <>
            <dt className="text-ink-light">Curative action</dt>
            <dd className="text-ink">{requirement.requiredCurativeAction}</dd>
          </>
        )}
        {requirement.responsibleParty && (
          <>
            <dt className="text-ink-light">Responsible</dt>
            <dd className="text-ink">{requirement.responsibleParty}</dd>
          </>
        )}
        {requirement.dueDate && (
          <>
            <dt className="text-ink-light">Due</dt>
            <dd className="font-mono text-ink">{requirement.dueDate}</dd>
          </>
        )}
        {requirement.sourceDocNo && (
          <>
            <dt className="text-ink-light">Source doc</dt>
            <dd className="font-mono text-ink">{requirement.sourceDocNo}</dd>
          </>
        )}
        {requirement.notes && (
          <>
            <dt className="text-ink-light">Notes</dt>
            <dd className="text-ink">{requirement.notes}</dd>
          </>
        )}
        {!requirement.isOpen && requirement.resolutionNotes && (
          <>
            <dt className="text-ink-light">Resolution</dt>
            <dd className="text-ink">{requirement.resolutionNotes}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

export interface CurativeRequirementReportModalProps {
  issues: readonly TitleIssue[];
  context: CurativeReportContext;
  projectName: string;
  generatedAt: string;
  onClose: () => void;
}

export default function CurativeRequirementReportModal({
  issues,
  context,
  projectName,
  generatedAt,
  onClose,
}: CurativeRequirementReportModalProps) {
  const report = useMemo(
    () => buildCurativeRequirementReport(issues, context),
    [issues, context]
  );

  return (
    <div className="fixed inset-0 z-[200] overflow-auto bg-parchment">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ledger-line bg-parchment-light px-5 py-3 print:hidden">
        <div>
          <h2 className="font-display text-[17px] font-bold leading-tight text-ink">
            Title Requirement Report
          </h2>
          <div className="text-[11px] text-ink-light">
            {report.totalCount} requirement{report.totalCount === 1 ? '' : 's'} ·{' '}
            {report.openCount} open · {report.criticalOpenCount} critical open
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-leather bg-leather px-3 py-1.5 text-xs font-semibold text-parchment hover:bg-leather/90"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ledger-line px-3 py-1.5 text-xs font-semibold text-leather hover:bg-leather/10"
          >
            Close
          </button>
        </div>
      </div>

      <div className="curative-report-print-root mx-auto max-w-4xl px-8 py-6 text-ink">
        <header className="mb-5 border-b border-ledger-line pb-3">
          <div className="font-display text-xl font-bold">{projectName || 'LANDroid'}</div>
          <div className="text-sm font-semibold text-ink">Title Requirement Report</div>
          <div className="text-[11px] text-ink-light">
            Generated {generatedAt} · {report.openCount} of {report.totalCount} requirement
            {report.totalCount === 1 ? '' : 's'} open
          </div>
        </header>

        {report.requirements.length === 0 ? (
          <p className="text-sm text-ink-light">No curative requirements recorded.</p>
        ) : (
          report.requirements.map((requirement) => (
            <RequirementBlock key={requirement.issueId} requirement={requirement} />
          ))
        )}
      </div>

      <style>{`@media print {
        body * { visibility: hidden !important; }
        .curative-report-print-root, .curative-report-print-root * { visibility: visible !important; }
        .curative-report-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0 4mm; }
        @page { margin: 14mm; }
      }`}</style>
    </div>
  );
}
