/**
 * Leasehold Audit Sheet — a printable, examiner-facing derivation of the unit's
 * leasehold math. Renders the same staged `FormulaContent` the on-screen
 * tooltips show, one section per tract plus the unit roll-up, in a layout tuned
 * for `window.print()` / Save-as-PDF.
 *
 * Print isolation: a scoped `@media print` block hides everything except the
 * sheet subtree, so the surrounding app chrome never lands on the page.
 */
import { useMemo } from 'react';
import type { FormulaContent } from './FormulaTooltip';
import { buildUnitAuditSheet } from './audit-sheet';
import type { LeaseholdUnitSummary } from '../../title-math';

function FormulaBlock({ content }: { content: FormulaContent }) {
  return (
    <div className="mb-3 break-inside-avoid">
      <div className="text-[12px] font-semibold text-ink">{content.title}</div>
      {content.description && (
        <div className="text-[10.5px] leading-4 text-ink-light">{content.description}</div>
      )}
      {content.inputs && content.inputs.length > 0 && (
        <table className="mt-1 border-collapse text-[10.5px]">
          <tbody>
            {content.inputs.map((input, index) => (
              <tr key={index}>
                <td className="py-px pr-4 text-ink-light">{input.label}</td>
                <td className="py-px font-mono text-ink">{input.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ol className="mt-1 space-y-px">
        {content.steps.map((step, index) => (
          <li key={index} className="text-[10.5px] leading-4">
            <span className="text-ink-light">{step.label}: </span>
            <span className="font-mono text-ink">
              {step.expression} {step.value}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-1 text-[11px] font-semibold text-ink">
        {content.result.label}:{' '}
        <span className="font-mono">{content.result.value}</span>
      </div>
      {content.note && (
        <div className="mt-0.5 text-[10px] italic text-ink-light">{content.note}</div>
      )}
    </div>
  );
}

export interface AuditSheetModalProps {
  summary: LeaseholdUnitSummary;
  projectName: string;
  unitLabel: string;
  /** Human-readable timestamp for the sheet header. */
  generatedAt: string;
  onClose: () => void;
}

export default function AuditSheetModal({
  summary,
  projectName,
  unitLabel,
  generatedAt,
  onClose,
}: AuditSheetModalProps) {
  const sheet = useMemo(() => buildUnitAuditSheet(summary), [summary]);

  return (
    <div className="fixed inset-0 z-[200] overflow-auto bg-parchment">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ledger-line bg-parchment-light px-5 py-3 print:hidden">
        <div>
          <h2 className="font-display text-[17px] font-bold leading-tight text-ink">
            Leasehold Audit Sheet
          </h2>
          <div className="text-[11px] text-ink-light">
            {summary.tracts.length} tract{summary.tracts.length === 1 ? '' : 's'} · staged
            derivation for examiner review
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

      <div className="audit-sheet-print-root mx-auto max-w-4xl px-8 py-6 text-ink">
        <header className="mb-5 border-b border-ledger-line pb-3">
          <div className="font-display text-xl font-bold">{projectName || 'LANDroid'}</div>
          <div className="text-sm font-semibold text-ink">Leasehold Audit Sheet — {unitLabel}</div>
          <div className="text-[11px] text-ink-light">
            Generated {generatedAt} · derivations match the on-screen formula tooltips
          </div>
        </header>

        {sheet.tracts.map((tractSheet) => (
          <section key={tractSheet.deskMapId} className="mb-6 break-inside-avoid">
            <h3 className="mb-2 border-b border-ledger-line/60 pb-1 font-display text-[15px] font-bold text-ink">
              {tractSheet.tractName}{' '}
              <span className="font-mono text-[12px] text-ink-light">({tractSheet.tractCode})</span>
            </h3>
            {tractSheet.formulas.map((formula, index) => (
              <FormulaBlock key={index} content={formula} />
            ))}
          </section>
        ))}

        <section className="mt-8 break-inside-avoid border-t-2 border-ledger-line pt-4">
          <h3 className="mb-2 font-display text-[15px] font-bold text-ink">Unit Roll-Up Totals</h3>
          {sheet.unitTotals.map((formula, index) => (
            <FormulaBlock key={index} content={formula} />
          ))}
        </section>
      </div>

      <style>{`@media print {
        body * { visibility: hidden !important; }
        .audit-sheet-print-root, .audit-sheet-print-root * { visibility: visible !important; }
        .audit-sheet-print-root { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0 4mm; }
        @page { margin: 14mm; }
      }`}</style>
    </div>
  );
}
