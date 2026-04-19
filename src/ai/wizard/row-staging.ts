import { Decimal } from '../../engine/decimal';
import { serialize } from '../../engine/decimal';
import type {
  FixedRoyaltyBasis,
  InterestClass,
  OwnershipNode,
  RoyaltyKind,
} from '../../types/node';
import { parseStrictInterestString } from '../../utils/interest-string';
import type { ParsedSheet, ParsedWorkbook } from './parse-workbook';

export type StagedImportRowStatus = 'pending' | 'created_root' | 'attached' | 'skipped';

export type StagedImportField =
  | 'grantor'
  | 'grantee'
  | 'instrument'
  | 'docNo'
  | 'vol'
  | 'page'
  | 'date'
  | 'fileDate'
  | 'landDesc'
  | 'fraction'
  | 'interestClass'
  | 'royaltyKind'
  | 'fixedRoyaltyBasis'
  | 'remarks';

export type StagedImportColumnMap = Partial<Record<StagedImportField, number>>;

export interface StagedImportRow {
  id: string;
  sheetName: string;
  rowNumber: number;
  sourceRow: string[];
  columnMap: StagedImportColumnMap;
  status: StagedImportRowStatus;
  createdNodeId: string | null;
  grantor: string;
  grantee: string;
  instrument: string;
  docNo: string;
  vol: string;
  page: string;
  date: string;
  fileDate: string;
  landDesc: string;
  fractionInput: string;
  interestClass: InterestClass;
  royaltyKind: RoyaltyKind;
  fixedRoyaltyBasis: FixedRoyaltyBasis;
  remarks: string;
  warnings: string[];
}

export interface StagedImportSheetSummary {
  sheetName: string;
  headerRowNumber: number | null;
  stagedRowCount: number;
  mappedFields: StagedImportField[];
}

export interface StagedImportBuildResult {
  rows: StagedImportRow[];
  sheetSummaries: StagedImportSheetSummary[];
  warnings: string[];
}

export interface ParentSuggestion {
  nodeId: string;
  label: string;
  confidence: 'high' | 'medium';
  reason: string;
}

const HEADER_ALIASES: Record<StagedImportField, RegExp[]> = {
  grantor: [
    /\bgrantor\b/i,
    /\bfrom\b/i,
    /\bassignor\b/i,
    /\blessor\b/i,
    /\bpredecessor\b/i,
  ],
  grantee: [
    /\bgrantee\b/i,
    /\bto\b/i,
    /\bassignee\b/i,
    /\blessee\b/i,
    /\bsuccessor\b/i,
    /^owner$/i,
    /\bowner\s*name\b/i,
    /\bcurrent\s*owner\b/i,
  ],
  instrument: [
    /\binstrument\b/i,
    /\bdoc(?:ument)?\s*type\b/i,
    /\btype\b/i,
  ],
  docNo: [
    /\bdoc(?:ument)?\s*(?:no|number|#)\b/i,
    /^doc(?:ument)?$/i,
    /\binstrument\s*(?:no|number|#)\b/i,
    /\bclerk\s*(?:no|number|#)\b/i,
    /\brecording\s*(?:no|number|#)\b/i,
  ],
  vol: [/\bvol(?:ume)?\b/i, /\bbook\b/i],
  page: [/\bpage\b/i, /\bpg\b/i],
  date: [
    /\binstrument\s*date\b/i,
    /\bdeed\s*date\b/i,
    /\bexecution\s*date\b/i,
    /^date$/i,
  ],
  fileDate: [
    /\bfile\s*date\b/i,
    /\bfiling\s*date\b/i,
    /\brecord(?:ed|ing)?\s*date\b/i,
  ],
  landDesc: [
    /\blegal\s*description\b/i,
    /\bland\s*(?:desc|description)\b/i,
    /\btract\b/i,
    /\blands?\b/i,
    /^description$/i,
  ],
  fraction: [
    /\bfraction\b/i,
    /\binterest\b/i,
    /\bmineral\s*interest\b/i,
    /\bownership\b/i,
    /\bshare\b/i,
    /\bconveyed\s*(?:interest|share)?\b/i,
    /\bdecimal\b/i,
  ],
  interestClass: [
    /\binterest\s*class\b/i,
    /\bestate\b/i,
    /\bkind\b/i,
    /\bclass\b/i,
  ],
  royaltyKind: [
    /\broyalty\s*kind\b/i,
    /\bfixed\s*(?:or|\/)\s*floating\b/i,
    /\bnpri\s*kind\b/i,
  ],
  fixedRoyaltyBasis: [
    /\bfixed\s*royalty\s*basis\b/i,
    /\bdeed\s*basis\b/i,
    /\bwhole\s*tract\b/i,
    /\bburdened\s*branch\b/i,
  ],
  remarks: [
    /\bremarks?\b/i,
    /\bnotes?\b/i,
    /\bcomments?\b/i,
    /\bcurative\b/i,
  ],
};

const MIN_HEADER_SCORE = 2;
const MAX_HEADER_SCAN_ROWS = 12;

function normalizeCell(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getImportRows(sheet: ParsedSheet): string[][] {
  return sheet.allRows?.length ? sheet.allRows : sheet.rows;
}

function compactHeader(value: string): string {
  return normalizeCell(value)
    .replace(/[#_.:/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaderRow(row: string[]): StagedImportColumnMap {
  const map: StagedImportColumnMap = {};
  row.forEach((cell, columnIndex) => {
    const header = compactHeader(cell);
    if (!header) return;
    for (const field of Object.keys(HEADER_ALIASES) as StagedImportField[]) {
      if (map[field] !== undefined) continue;
      if (HEADER_ALIASES[field].some((pattern) => pattern.test(header))) {
        map[field] = columnIndex;
        break;
      }
    }
  });
  return map;
}

function scoreColumnMap(map: StagedImportColumnMap): number {
  let score = Object.keys(map).length;
  if (map.grantor !== undefined) score += 2;
  if (map.grantee !== undefined) score += 2;
  if (map.fraction !== undefined) score += 1;
  if (map.instrument !== undefined || map.docNo !== undefined) score += 1;
  return score;
}

function detectHeader(sheet: ParsedSheet): {
  index: number;
  columnMap: StagedImportColumnMap;
} | null {
  const rows = getImportRows(sheet);
  let best: { index: number; columnMap: StagedImportColumnMap; score: number } | null = null;
  const scanCount = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);
  for (let index = 0; index < scanCount; index += 1) {
    const columnMap = mapHeaderRow(rows[index]);
    const score = scoreColumnMap(columnMap);
    if (!best || score > best.score) {
      best = { index, columnMap, score };
    }
  }
  if (!best || best.score < MIN_HEADER_SCORE) {
    return null;
  }
  return { index: best.index, columnMap: best.columnMap };
}

function getCell(row: string[], map: StagedImportColumnMap, field: StagedImportField): string {
  const columnIndex = map[field];
  return columnIndex === undefined ? '' : normalizeCell(row[columnIndex]);
}

function inferInterestClass(rawClass: string): InterestClass {
  const text = rawClass.toLowerCase();
  if (/\bnpri\b/.test(text) || /non[-\s]*participating/.test(text)) {
    return 'npri';
  }
  return 'mineral';
}

function inferRoyaltyKind(raw: string, interestClass: InterestClass): RoyaltyKind {
  if (interestClass !== 'npri') return null;
  const text = raw.toLowerCase();
  if (/\bfloating\b/.test(text)) return 'floating';
  if (/\bfixed\b/.test(text)) return 'fixed';
  return 'fixed';
}

function inferFixedRoyaltyBasis(raw: string, royaltyKind: RoyaltyKind): FixedRoyaltyBasis {
  if (royaltyKind !== 'fixed') return null;
  const text = raw.toLowerCase();
  if (/whole\s*tract/.test(text)) return 'whole_tract';
  return 'burdened_branch';
}

function rowHasUsefulTitleData(row: StagedImportRow): boolean {
  return Boolean(
    row.grantor
      || row.grantee
      || row.instrument
      || row.docNo
      || row.fractionInput
      || row.landDesc
      || row.remarks
  );
}

export function parseImportFraction(value: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = value.trim();
  if (!raw) {
    return { ok: false, error: 'Fraction is required before creating a node.' };
  }

  if (raw.endsWith('%')) {
    try {
      const percent = new Decimal(raw.slice(0, -1).trim());
      const parsed = percent.div(100);
      if (parsed.isFinite() && parsed.greaterThan(0) && parsed.lessThanOrEqualTo(1)) {
        return { ok: true, value: serialize(parsed) };
      }
    } catch {
      return { ok: false, error: `Fraction "${raw}" is not a valid percent.` };
    }
    return { ok: false, error: `Fraction "${raw}" must be greater than 0% and no more than 100%.` };
  }

  const parsed = parseStrictInterestString(raw);
  if (!parsed) {
    return { ok: false, error: `Fraction "${raw}" is not a valid decimal or a/b fraction.` };
  }
  if (parsed.lessThanOrEqualTo(0)) {
    return { ok: false, error: 'Fraction must be greater than zero.' };
  }
  return { ok: true, value: serialize(parsed) };
}

export function validateStagedImportRow(row: StagedImportRow): string[] {
  const warnings: string[] = [];
  if (!row.grantee.trim()) {
    warnings.push('Missing grantee.');
  }
  const parsedFraction = parseImportFraction(row.fractionInput);
  if (!parsedFraction.ok) {
    warnings.push(parsedFraction.error);
  }
  if (
    row.interestClass === 'mineral'
    && /\b(?:npri|non[-\s]*participating|royalty)\b/i.test(
      `${row.instrument} ${row.remarks}`
    )
  ) {
    warnings.push('Instrument looks royalty-related; confirm Mineral vs NPRI before attaching.');
  }
  return warnings;
}

export function buildStagedImportRows(parsed: ParsedWorkbook): StagedImportBuildResult {
  const rows: StagedImportRow[] = [];
  const sheetSummaries: StagedImportSheetSummary[] = [];
  const warnings: string[] = [];

  parsed.sheets.forEach((sheet, sheetIndex) => {
    const sheetRows = getImportRows(sheet);
    const header = detectHeader(sheet);
    if (!header) {
      sheetSummaries.push({
        sheetName: sheet.name,
        headerRowNumber: null,
        stagedRowCount: 0,
        mappedFields: [],
      });
      if (sheetRows.some((row) => row.some((cell) => normalizeCell(cell)))) {
        warnings.push(`Skipped "${sheet.name}" because no recognizable title header row was found.`);
      }
      return;
    }

    const beforeCount = rows.length;
    for (let rowIndex = header.index + 1; rowIndex < sheetRows.length; rowIndex += 1) {
      const sourceRow = sheetRows[rowIndex];
      const interestClass = inferInterestClass(
        getCell(sourceRow, header.columnMap, 'interestClass')
      );
      const royaltyKind = inferRoyaltyKind(
        `${getCell(sourceRow, header.columnMap, 'royaltyKind')} ${getCell(sourceRow, header.columnMap, 'instrument')}`,
        interestClass
      );
      const fixedRoyaltyBasis = inferFixedRoyaltyBasis(
        getCell(sourceRow, header.columnMap, 'fixedRoyaltyBasis'),
        royaltyKind
      );
      const stagedRow: StagedImportRow = {
        id: `sheet-${sheetIndex + 1}-row-${rowIndex + 1}`,
        sheetName: sheet.name,
        rowNumber: rowIndex + 1,
        sourceRow,
        columnMap: header.columnMap,
        status: 'pending',
        createdNodeId: null,
        grantor: getCell(sourceRow, header.columnMap, 'grantor'),
        grantee: getCell(sourceRow, header.columnMap, 'grantee'),
        instrument: getCell(sourceRow, header.columnMap, 'instrument'),
        docNo: getCell(sourceRow, header.columnMap, 'docNo'),
        vol: getCell(sourceRow, header.columnMap, 'vol'),
        page: getCell(sourceRow, header.columnMap, 'page'),
        date: getCell(sourceRow, header.columnMap, 'date'),
        fileDate: getCell(sourceRow, header.columnMap, 'fileDate'),
        landDesc: getCell(sourceRow, header.columnMap, 'landDesc'),
        fractionInput: getCell(sourceRow, header.columnMap, 'fraction'),
        interestClass,
        royaltyKind,
        fixedRoyaltyBasis,
        remarks: getCell(sourceRow, header.columnMap, 'remarks'),
        warnings: [],
      };
      if (!rowHasUsefulTitleData(stagedRow)) {
        continue;
      }
      stagedRow.warnings = validateStagedImportRow(stagedRow);
      rows.push(stagedRow);
    }

    sheetSummaries.push({
      sheetName: sheet.name,
      headerRowNumber: header.index + 1,
      stagedRowCount: rows.length - beforeCount,
      mappedFields: Object.keys(header.columnMap) as StagedImportField[],
    });
  });

  if (rows.length === 0) {
    warnings.push('No importable title rows were found.');
  }

  return { rows, sheetSummaries, warnings };
}

export function normalizePartyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => ![
      'the',
      'llc',
      'inc',
      'ltd',
      'co',
      'company',
      'corp',
      'corporation',
      'lp',
      'llp',
      'estate',
      'trust',
      'trustee',
    ].includes(part))
    .join(' ');
}

function candidateLabel(node: OwnershipNode): string {
  const name = node.grantee || node.grantor || node.id;
  const doc = node.docNo ? ` · Doc ${node.docNo}` : '';
  return `${name}${doc} · ${node.interestClass} · ${node.fraction}`;
}

export function suggestParentForRow(
  row: Pick<StagedImportRow, 'grantor' | 'interestClass' | 'landDesc'>,
  nodes: OwnershipNode[]
): ParentSuggestion | null {
  const grantor = normalizePartyName(row.grantor);
  if (!grantor) return null;

  let best: { node: OwnershipNode; score: number; reason: string } | null = null;
  for (const node of nodes) {
    if (node.type === 'related') continue;
    if (row.interestClass === 'mineral' && node.interestClass !== 'mineral') continue;

    const grantee = normalizePartyName(node.grantee);
    if (!grantee) continue;

    let score = 0;
    let reason = '';
    if (grantee === grantor) {
      score += 100;
      reason = 'grantor matches an existing grantee';
    } else if (
      grantor.length >= 6
      && grantee.length >= 6
      && (grantor.includes(grantee) || grantee.includes(grantor))
    ) {
      score += 70;
      reason = 'grantor closely matches an existing grantee';
    }

    if (score === 0) continue;
    if (row.interestClass === 'npri' && node.interestClass === 'mineral') {
      score += 5;
    }
    if (row.landDesc && node.landDesc && normalizePartyName(row.landDesc) === normalizePartyName(node.landDesc)) {
      score += 5;
    }
    if (!best || score > best.score) {
      best = { node, score, reason };
    }
  }

  if (!best || best.score < 70) return null;
  return {
    nodeId: best.node.id,
    label: candidateLabel(best.node),
    confidence: best.score >= 100 ? 'high' : 'medium',
    reason: best.reason,
  };
}

export function buildImportNodeId(row: StagedImportRow, existingIds: Set<string>): string {
  const baseLabel = row.grantee || row.grantor || `${row.sheetName}-${row.rowNumber}`;
  const slug = baseLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'imported-node';
  const base = `import-${slug}-r${row.rowNumber}`;
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function stagedRowToNodeForm(
  row: StagedImportRow,
  normalizedFraction: string
): Partial<OwnershipNode> {
  return {
    instrument: row.instrument,
    date: row.date,
    fileDate: row.fileDate,
    grantor: row.grantor,
    grantee: row.grantee,
    vol: row.vol,
    page: row.page,
    docNo: row.docNo,
    landDesc: row.landDesc,
    remarks: row.remarks,
    conveyanceMode: 'fixed',
    splitBasis: 'whole',
    manualAmount: normalizedFraction,
    interestClass: row.interestClass,
    royaltyKind: row.interestClass === 'npri' ? row.royaltyKind ?? 'fixed' : null,
    fixedRoyaltyBasis:
      row.interestClass === 'npri' && (row.royaltyKind ?? 'fixed') === 'fixed'
        ? row.fixedRoyaltyBasis ?? 'burdened_branch'
        : null,
  };
}
