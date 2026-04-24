/**
 * CSV import/export for LANDroid workspace data.
 *
 * Reads the v1-compatible CSV format (BOM-prefixed, INTERNAL_* columns)
 * and produces v2 OwnershipNode arrays with Decimal-serialized fractions.
 */
import Papa from 'papaparse';
import type { OwnershipNode, DeskMap } from '../types/node';
import { createBlankNode, normalizeDeskMap } from '../types/node';
import {
  type LeaseholdAssignment,
  createBlankLeaseholdUnit,
  type LeaseholdOrri,
  type LeaseholdTransferOrderEntry,
  type LeaseholdUnit,
} from '../types/leasehold';
import { createWorkspaceId } from '../utils/workspace-id';
import { validateOwnershipGraph } from '../engine/math-engine';

// ── CSV column names ────────────────────────────────────────

const REQUIRED_HEADERS = [
  'INTERNAL_ID', 'INTERNAL_PID', 'INTERNAL_TYPE',
  'INTERNAL_REMAINING_FRACTION', 'INTERNAL_INITIAL_FRACTION',
  'INTERNAL_DESKMAPS',
];

// ── Types ───────────────────────────────────────────────────

interface RawDeskMap {
  id: string;
  name: string;
  code: string;
  tractId?: string;
  grossAcres?: string | number;
  pooledAcres?: string | number;
  description?: string;
  nodes: RawNode[];
  pz?: { x: number; y: number; scale: number };
}

interface RawNode {
  id: string;
  parentId: string | null;
  type: string;
  fraction: number;
  initialFraction: number;
  instrument?: string;
  grantor?: string;
  grantee?: string;
  vol?: string;
  page?: string;
  docNo?: string;
  fileDate?: string;
  date?: string;
  landDesc?: string;
  remarks?: string;
  isDeceased?: boolean;
  obituary?: string;
  graveyardLink?: string;
  docData?: string;
}

export interface ImportResult {
  workspaceId: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit?: LeaseholdUnit;
  leaseholdAssignments?: LeaseholdAssignment[];
  leaseholdOrris?: LeaseholdOrri[];
  leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  projectName: string;
  instrumentTypes?: string[];
}

// ── Parse CSV ───────────────────────────────────────────────

function parseCSVText(text: string): Papa.ParseResult<Record<string, string>> {
  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  return Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
  });
}

/**
 * Audit M4: strict fraction parsing.
 *
 * The legacy `toDecimalString` coerced every unparseable value to `0`, which
 * silently converted bad imports into broken workspaces. Now we accept:
 *   - numeric literals (including "0.5", "1", "0")
 *   - simple fractions "1/2" (numerator/denominator, both finite, denom != 0)
 * and throw on anything else — including negative numbers, NaN, Infinity,
 * empty strings, or garbage.
 */
function parseStrictDecimalString(
  value: unknown,
  nodeId: string,
  column: string
): string {
  const raw = typeof value === 'number'
    ? String(value)
    : String(value ?? '').trim();
  if (raw === '') {
    throw new Error(`CSV row for node "${nodeId}" has empty ${column}.`);
  }
  let num: number;
  if (raw.includes('/')) {
    const [n, d] = raw.split('/').map((s) => Number(s.trim()));
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
      throw new Error(`CSV row for node "${nodeId}" has invalid ${column}: "${raw}".`);
    }
    num = n / d;
  } else {
    num = Number(raw);
  }
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`CSV row for node "${nodeId}" has invalid ${column}: "${raw}".`);
  }
  return num.toFixed(9);
}

function rawNodeToOwnership(raw: RawNode): OwnershipNode {
  if (!raw.id || typeof raw.id !== 'string') {
    throw new Error('CSV row missing node id.');
  }
  const base = createBlankNode(raw.id, raw.parentId ?? null);
  return {
    ...base,
    type: (raw.type === 'related' ? 'related' : 'conveyance'),
    instrument: raw.instrument ?? '',
    grantor: raw.grantor ?? '',
    grantee: raw.grantee ?? '',
    vol: raw.vol ?? '',
    page: raw.page ?? '',
    docNo: raw.docNo ?? '',
    fileDate: raw.fileDate ?? '',
    date: raw.date ?? '',
    landDesc: raw.landDesc ?? '',
    remarks: raw.remarks ?? '',
    fraction: parseStrictDecimalString(raw.fraction, raw.id, 'fraction'),
    initialFraction: parseStrictDecimalString(raw.initialFraction, raw.id, 'initialFraction'),
    isDeceased: Boolean(raw.isDeceased),
    obituary: raw.obituary ?? '',
    graveyardLink: raw.graveyardLink ?? '',
    hasDoc: Boolean(raw.docData),
  };
}

// ── Import from CSV text ────────────────────────────────────

export function importCSV(csvText: string): ImportResult {
  const parsed = parseCSVText(csvText);

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Validate required headers
  const headers = Object.keys(rows[0]);
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      throw new Error(`Missing required column: ${req}`);
    }
  }

  // Extract deskmap data from first row
  const firstRow = rows[0];
  const deskmapsJson = firstRow['INTERNAL_DESKMAPS'] ?? '';
  const activeMapId = firstRow['INTERNAL_ACTIVE_DESKMAP_ID'] ?? null;

  let rawDeskmaps: RawDeskMap[] = [];
  try {
    rawDeskmaps = deskmapsJson ? JSON.parse(deskmapsJson) : [];
  } catch {
    throw new Error('Failed to parse INTERNAL_DESKMAPS JSON');
  }

  if (!Array.isArray(rawDeskmaps) || rawDeskmaps.length === 0) {
    throw new Error('No deskmaps found in CSV');
  }

  // Convert all deskmap nodes to v2 format
  const allNodes: OwnershipNode[] = [];
  const deskMaps: DeskMap[] = [];

  for (const rawMap of rawDeskmaps) {
    const mapNodes = (rawMap.nodes ?? []).map(rawNodeToOwnership);
    allNodes.push(...mapNodes);

    deskMaps.push(
      normalizeDeskMap(
        {
          id: rawMap.id,
          name: rawMap.name ?? 'Imported Map',
          code: rawMap.code ?? '',
          tractId: rawMap.tractId ?? null,
          grossAcres: rawMap.grossAcres,
          pooledAcres: rawMap.pooledAcres ?? rawMap.grossAcres,
          description: rawMap.description,
          nodeIds: mapNodes.map((node) => node.id),
        },
        rawMap.name ?? 'Imported Map'
      )
    );
  }

  // Audit M4: duplicate node IDs previously silently dropped all but the
  // first occurrence. That hid genuine data-corruption bugs in exporting
  // tools. Reject outright so the user can fix the source.
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const node of allNodes) {
    if (seen.has(node.id)) {
      duplicates.push(node.id);
    } else {
      seen.add(node.id);
    }
  }
  if (duplicates.length > 0) {
    const sample = duplicates.slice(0, 5).join(', ');
    throw new Error(
      `CSV contains duplicate node IDs: ${sample}${
        duplicates.length > 5 ? ` (+${duplicates.length - 5} more)` : ''
      }.`
    );
  }

  // Audit M4: graph validation before handing the result to the caller.
  // Parent references, cycles, NaN branches — all caught here instead of
  // blowing up deeper in the math engine on first use.
  const validation = validateOwnershipGraph(allNodes);
  if (!validation.valid) {
    const first = validation.issues[0];
    const summary = first ? `${first.code}: ${first.message}` : 'unknown issue';
    throw new Error(
      `CSV ownership graph is invalid (${validation.issues.length} issue${
        validation.issues.length === 1 ? '' : 's'
      }): ${summary}`
    );
  }

  return {
    workspaceId: createWorkspaceId(),
    nodes: allNodes,
    deskMaps,
    leaseholdUnit: createBlankLeaseholdUnit(),
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: activeMapId,
    projectName: rawDeskmaps[0]?.name ?? 'Imported Workspace',
  };
}
