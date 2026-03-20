/**
 * Runsheet View — chronological table of all instruments in the workspace.
 *
 * Sortable by clicking column headers (instrument date or file date).
 * Shows every node including related documents (visually distinguished).
 */
import { useState, useMemo } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { formatAsFraction } from '../engine/fraction-display';
import { d } from '../engine/decimal';
import type { OwnershipNode } from '../types/node';

type SortField = 'date' | 'fileDate' | 'instrument' | 'grantor' | 'grantee';
type SortDir = 'asc' | 'desc';

function parseDate(s: string): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function sortNodes(nodes: OwnershipNode[], field: SortField, dir: SortDir): OwnershipNode[] {
  const sorted = [...nodes].sort((a, b) => {
    let cmp = 0;
    if (field === 'date' || field === 'fileDate') {
      cmp = parseDate(a[field]) - parseDate(b[field]);
    } else {
      cmp = (a[field] || '').localeCompare(b[field] || '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export default function RunsheetView() {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(
    () => sortNodes(nodes, sortField, sortDir),
    [nodes, sortField, sortDir]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const arrow = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u25b2' : ' \u25bc') : '';

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-display font-bold text-ink">No instruments yet</h2>
          <p className="text-ink-light text-sm">Build a title chain in the Desk Map to see the runsheet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-parchment-dark border-b-2 border-leather">
            <SortHeader label="Inst. Date" field="date" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="File Date" field="fileDate" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Instrument" field="instrument" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Vol/Pg</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Doc#</th>
            <SortHeader label="Grantor" field="grantor" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Grantee" field="grantee" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Interest</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((node) => {
            const isRelated = node.type === 'related';
            const interest = d(node.initialFraction);
            return (
              <tr
                key={node.id}
                className={`border-b border-ledger-line hover:bg-parchment-dark/50 transition-colors ${
                  isRelated ? 'italic text-ink-light bg-gold/5' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{node.date || '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs">{node.fileDate || '\u2014'}</td>
                <td className="px-3 py-2">
                  {node.instrument || '\u2014'}
                  {isRelated && <span className="ml-1 text-[9px] text-gold font-semibold">(RELATED)</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {node.vol || node.page
                    ? `${node.vol || ''}/${node.page || ''}`
                    : '\u2014'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{node.docNo || '\u2014'}</td>
                <td className="px-3 py-2">{node.grantor || '\u2014'}</td>
                <td className="px-3 py-2 font-semibold">{node.grantee || '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {isRelated ? '\u2014' : formatAsFraction(interest)}
                </td>
                <td className="px-3 py-2 text-xs text-ink-light truncate max-w-48">
                  {node.remarks || ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  onClick,
  arrow,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
  arrow: (f: SortField) => string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-leather transition-colors ${
        current === field ? 'text-leather' : 'text-ink-light'
      }`}
      onClick={() => onClick(field)}
    >
      {label}{arrow(field)}
    </th>
  );
}
