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
  tractCode: string;
  tractName: string;
  grossAcres: string;
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
  tractCode: string;
  tractName: string;
  grossAcres: string;
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
    /^from$/i,
    /\bassignor\b/i,
    /\blessor\b/i,
    /\bpredecessor\b/i,
  ],
  grantee: [
    /\bgrantee\b/i,
    /^to$/i,
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
    /\binst\.?\s*date\b/i,
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

interface SheetTractInfo {
  code: string;
  name: string;
  grossAcres: string;
}

interface InheritedInstrumentContext {
  instrument: string;
  docNo: string;
  vol: string;
  page: string;
  date: string;
  fileDate: string;
  grantor: string;
  grantee: string;
  landDesc: string;
}

function normalizeCell(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getImportRows(sheet: ParsedSheet): string[][] {
  return sheet.allRows?.length ? sheet.allRows : sheet.rows;
}

export function inferTractInfoFromSheetName(
  sheetName: string,
  fallbackIndex = 0
): SheetTractInfo {
  const tractMatch = sheetName.match(/\btract\s*([a-z0-9]+)\b/i);
  const acresMatch = sheetName.match(/([\d,.]+)\s*ac(?:\.|\b)/i);
  const tractNumber = tractMatch?.[1]?.toUpperCase() ?? String(fallbackIndex + 1);
  const code = `T${tractNumber.replace(/^T/i, '')}`;
  const grossAcres = acresMatch?.[1]?.replace(/,/g, '') ?? '';
  const name = grossAcres ? `Tract ${tractNumber} - ${grossAcres} ac.` : `Tract ${tractNumber}`;
  return { code, name, grossAcres };
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

function getLikelyFractionText(value: string): string {
  const text = normalizeCell(value);
  if (!text) return '';
  if (/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?%/.test(text)) {
    return text;
  }
  if (/^0?\.\d+$|^1(?:\.0+)?$/.test(text)) {
    return text;
  }
  return '';
}

function isSectionBreakRow(row: string[]): boolean {
  const filled = row
    .map(normalizeCell)
    .filter(Boolean);
  if (filled.length === 0) return true;
  const first = normalizeCell(row[0]).toLowerCase();
  if (/^(subsequent title|current ownership|ownership|notes?)$/.test(first)) {
    return true;
  }
  return filled.length <= 2 && /^(subtotal|total)$/i.test(filled[0]);
}

function looksLikeDotoOwnershipRow(row: StagedImportRow): boolean {
  if (!row.fractionInput.trim()) return false;
  if (!row.grantor.trim()) return false;
  const granteeLooksLikeSource = !row.grantee.trim() || /^exh(?:ibit)?\.?\s+/i.test(row.grantee.trim());
  if (!granteeLooksLikeSource) return false;
  return !row.instrument.trim() || /\b(?:doto|ownership|runsheet)\b/i.test(row.instrument);
}

function buildDotoOwnershipRemarks(row: StagedImportRow): string {
  const parts = [
    row.remarks,
    row.grantee ? `Source exhibit: ${row.grantee}` : '',
  ];
  return parts
    .map(normalizeCell)
    .filter(Boolean)
    .join(' | ');
}

function inheritInstrumentFields(
  row: StagedImportRow,
  context: InheritedInstrumentContext | null
): StagedImportRow {
  if (!context) return row;

  const inherited = {
    ...row,
    instrument: row.instrument || context.instrument,
    docNo: row.docNo || context.docNo,
    vol: row.vol || context.vol,
    page: row.page || context.page,
    date: row.date || context.date,
    fileDate: row.fileDate || context.fileDate,
    landDesc: row.landDesc || context.landDesc,
  };

  if (looksLikeDotoOwnershipRow(row)) {
    return {
      ...inherited,
      grantor: context.grantor || context.grantee || '',
      grantee: row.grantor,
      remarks: buildDotoOwnershipRemarks(row),
    };
  }

  return inherited;
}

function isInstrumentContextRow(row: StagedImportRow): boolean {
  return Boolean(
    row.instrument
      || row.docNo
      || row.fileDate
      || row.date
      || (row.grantor && row.grantee && row.landDesc)
  );
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

  const expressionResult = parseInterestExpression(raw);
  if (expressionResult.ok) {
    return expressionResult;
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

function parseInterestExpression(raw: string): { ok: true; value: string } | { ok: false } {
  const normalized = raw
    .replace(/\b(?:MI|RI|NPRI|mineral\s+interest)\b.*$/i, '')
    .replace(/\bburdened\b.*$/i, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return { ok: false };
  }
  if (!/[xX*+\-]/.test(normalized)) {
    const singleTerm = parseInterestTerm(normalized);
    if (
      singleTerm
      && singleTerm.isFinite()
      && singleTerm.greaterThan(0)
      && singleTerm.lessThanOrEqualTo(1)
      && normalized !== raw.trim()
    ) {
      return { ok: true, value: serialize(singleTerm) };
    }
    return { ok: false };
  }

  const tokens = normalized.match(/(\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?%?|[xX*+\-])/g);
  if (!tokens || tokens.length < 3) {
    return { ok: false };
  }

  let value: Decimal | null = null;
  let pendingOperator: 'mul' | 'add' | 'sub' | null = null;
  for (const token of tokens) {
    const operator = token.toLowerCase();
    if (operator === 'x' || operator === '*' || operator === '+' || operator === '-') {
      if (!value || pendingOperator) return { ok: false };
      pendingOperator = operator === 'x' || operator === '*' ? 'mul' : operator === '+' ? 'add' : 'sub';
      continue;
    }

    const term = parseInterestTerm(token);
    if (!term) return { ok: false };
    if (!value) {
      value = term;
      continue;
    }
    if (!pendingOperator) return { ok: false };
    if (pendingOperator === 'mul') value = value.mul(term);
    if (pendingOperator === 'add') value = value.plus(term);
    if (pendingOperator === 'sub') value = value.minus(term);
    pendingOperator = null;
  }

  if (!value || pendingOperator || !value.isFinite() || value.lessThanOrEqualTo(0) || value.greaterThan(1)) {
    return { ok: false };
  }
  return { ok: true, value: serialize(value) };
}

function parseInterestTerm(raw: string): Decimal | null {
  const token = raw.trim();
  if (!token) return null;
  try {
    if (token.endsWith('%')) {
      const percent = new Decimal(token.slice(0, -1).trim());
      return percent.div(100);
    }
    const fractionParts = token.split('/').map((part) => part.trim());
    if (fractionParts.length === 2) {
      const numerator = new Decimal(fractionParts[0]);
      const denominator = new Decimal(fractionParts[1]);
      if (denominator.isZero()) return null;
      return numerator.div(denominator);
    }
    if (fractionParts.length === 1) {
      return new Decimal(token);
    }
  } catch {
    return null;
  }
  return null;
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
    const tractInfo = inferTractInfoFromSheetName(sheet.name, sheetIndex);
    if (!header) {
      sheetSummaries.push({
        sheetName: sheet.name,
        headerRowNumber: null,
        stagedRowCount: 0,
        mappedFields: [],
        tractCode: tractInfo.code,
        tractName: tractInfo.name,
        grossAcres: tractInfo.grossAcres,
      });
      if (sheetRows.some((row) => row.some((cell) => normalizeCell(cell)))) {
        warnings.push(`Skipped "${sheet.name}" because no recognizable title header row was found.`);
      }
      return;
    }

    const beforeCount = rows.length;
    let context: InheritedInstrumentContext | null = null;
    for (let rowIndex = header.index + 1; rowIndex < sheetRows.length; rowIndex += 1) {
      const sourceRow = sheetRows[rowIndex];
      if (isSectionBreakRow(sourceRow)) {
        continue;
      }
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
      const rawFractionInput =
        getCell(sourceRow, header.columnMap, 'fraction')
        || getLikelyFractionText(getCell(sourceRow, header.columnMap, 'remarks'));
      const rawRow: StagedImportRow = {
        id: `sheet-${sheetIndex + 1}-row-${rowIndex + 1}`,
        sheetName: sheet.name,
        rowNumber: rowIndex + 1,
        tractCode: tractInfo.code,
        tractName: tractInfo.name,
        grossAcres: tractInfo.grossAcres,
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
        fractionInput: rawFractionInput,
        interestClass,
        royaltyKind,
        fixedRoyaltyBasis,
        remarks: getCell(sourceRow, header.columnMap, 'remarks'),
        warnings: [],
      };
      const ownershipSummaryRow = looksLikeDotoOwnershipRow(rawRow);
      const stagedRow = inheritInstrumentFields(rawRow, context);
      if (!ownershipSummaryRow && isInstrumentContextRow(rawRow)) {
        context = {
          instrument: rawRow.instrument,
          docNo: rawRow.docNo,
          vol: rawRow.vol,
          page: rawRow.page,
          date: rawRow.date,
          fileDate: rawRow.fileDate,
          grantor: rawRow.grantor,
          grantee: rawRow.grantee,
          landDesc: rawRow.landDesc,
        };
      }
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
      tractCode: tractInfo.code,
      tractName: tractInfo.name,
      grossAcres: tractInfo.grossAcres,
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
