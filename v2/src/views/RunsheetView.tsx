/**
 * Runsheet View — chronological table of all instruments in the workspace.
 *
 * Sortable by clicking column headers (instrument date or file date).
 * Shows every node including related documents (visually distinguished).
 */
import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { formatAsFraction } from '../engine/fraction-display';
import { d } from '../engine/decimal';
import { downloadRunsheetWorkbook } from '../storage/runsheet-export';
import type { OwnershipNode } from '../types/node';

type SortField = 'date' | 'fileDate' | 'instrument' | 'grantor' | 'grantee';
type SortDir = 'asc' | 'desc';
type TractFilter = 'all' | string;

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

function formatVolPage(node: OwnershipNode) {
  return node.vol || node.page ? `${node.vol || ''}/${node.page || ''}` : '\u2014';
}

export default function RunsheetView() {
  const nodes = useWorkspaceStore((s) => s.nodes);
  const deskMaps = useWorkspaceStore((s) => s.deskMaps);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tractFilter, setTractFilter] = useState<TractFilter>('all');

  const tractOptions = useMemo(
    () =>
      deskMaps
        .filter((deskMap) => deskMap.nodeIds.length > 0)
        .map((deskMap) => ({
          id: deskMap.id,
          label: deskMap.name,
          nodeIds: new Set(deskMap.nodeIds),
        })),
    [deskMaps]
  );

  useEffect(() => {
    if (tractFilter === 'all') return;
    if (!tractOptions.some((option) => option.id === tractFilter)) {
      setTractFilter('all');
    }
  }, [tractFilter, tractOptions]);

  const filteredNodes = useMemo(() => {
    if (tractFilter === 'all') return nodes;
    const tract = tractOptions.find((option) => option.id === tractFilter);
    if (!tract) return nodes;
    return nodes.filter((node) => tract.nodeIds.has(node.id));
  }, [nodes, tractFilter, tractOptions]);

  const sorted = useMemo(
    () => sortNodes(filteredNodes, sortField, sortDir),
    [filteredNodes, sortField, sortDir]
  );

  const activeTractLabel =
    tractFilter === 'all'
      ? null
      : tractOptions.find((option) => option.id === tractFilter)?.label ?? null;

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

  const handleExport = () => {
    void downloadRunsheetWorkbook(sorted, {
      projectName,
      tractLabel: activeTractLabel,
    });
  };

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
      <div className="mb-4 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-light shrink-0">
          Tract Filter
        </span>
        <button
          onClick={() => setTractFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            tractFilter === 'all'
              ? 'bg-leather text-parchment'
              : 'bg-parchment-dark text-ink-light hover:bg-parchment'
          }`}
        >
          All Tracts
        </button>
        {tractOptions.map((tract) => (
          <button
            key={tract.id}
            onClick={() => setTractFilter(tract.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              tractFilter === tract.id
                ? 'bg-leather text-parchment'
                : 'bg-parchment-dark text-ink-light hover:bg-parchment'
            }`}
          >
            {tract.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-ink-light">
            {sorted.length} entries
          </span>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-ledger-line transition-colors"
          >
            Export Runsheet
          </button>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-parchment-dark border-b-2 border-leather">
            <SortHeader label="Instrument" field="instrument" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="File Date" field="fileDate" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Inst. Date" field="date" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Vol/Pg</th>
            <SortHeader label="Grantor" field="grantor" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <SortHeader label="Grantee" field="grantee" current={sortField} dir={sortDir} onClick={handleSort} arrow={arrow} />
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Interest</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-ink-light uppercase tracking-wider">Land Desc.</th>
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
                <td className="px-3 py-2">
                  {node.instrument || '\u2014'}
                  {isRelated && <span className="ml-1 text-[9px] text-gold font-semibold">(RELATED)</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{node.fileDate || '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs">{node.date || '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs">{formatVolPage(node)}</td>
                <td className="px-3 py-2">{node.grantor || '\u2014'}</td>
                <td className="px-3 py-2 font-semibold">{node.grantee || '\u2014'}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {isRelated ? '\u2014' : formatAsFraction(interest)}
                </td>
                <td
                  className="px-3 py-2 text-xs text-ink-light truncate max-w-56"
                  title={node.landDesc || ''}
                >
                  {node.landDesc || ''}
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
