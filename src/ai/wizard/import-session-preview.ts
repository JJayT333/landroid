import type { ActionPlanRecord } from '../../backend-spine/contracts';
import {
  buildImportSessionDryRunActionPlan,
  buildStagedImportSession,
  type StagedImportCandidateDraft,
  type StagedImportSession,
} from '../../project-records/import-sessions';
import type { RecordBuildContext } from '../../project-records/record-helpers';
import {
  parseImportFraction,
  stagedImportRowNeedsQuestion,
  validateStagedImportRow,
  type StagedImportRow,
} from './row-staging';

export const MAX_STAGED_IMPORT_PROPOSALS = 25;

export interface StagedImportActionPlanPreview {
  actionPlan: ActionPlanRecord;
  selectedRows: readonly StagedImportRow[];
  session: StagedImportSession;
}

export interface BuildStagedImportActionPlanPreviewInput {
  rows: readonly StagedImportRow[];
  selectedRowIds: readonly string[];
  workspaceId: string;
  projectId?: string;
  projectName: string;
  fileName: string;
  generatedAt?: string;
}

export async function buildStagedImportActionPlanPreview(
  input: BuildStagedImportActionPlanPreviewInput
): Promise<StagedImportActionPlanPreview> {
  const selectedRows = selectRows(input.rows, input.selectedRowIds);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const context: RecordBuildContext = {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? input.workspaceId,
    generatedAt,
    revision: 0,
    source: 'import',
    syncState: 'local_only',
  };
  const sourceRows = selectedRows.map(rowToSourceRowDraft);
  const candidates = selectedRows.map(rowToCandidateDraft);
  const session = await buildStagedImportSession({
    context,
    sessionIdSeed: sessionSeed(input.fileName, selectedRows),
    createdAt: generatedAt,
    sourcePackage: {
      packageKind: 'runsheet',
      packageId: packageId(input.fileName),
      title: `${input.projectName || 'Workspace'} CSV import preview`,
      documentIds: [],
    },
    sourceRows,
    candidates,
  });
  const actionPlan = buildImportSessionDryRunActionPlan({
    session,
    candidateIds: session.candidates.map((candidate) => candidate.candidateId),
    generatedAt,
    proposedBy: 'import',
  });

  return {
    actionPlan,
    selectedRows,
    session,
  };
}

function selectRows(
  rows: readonly StagedImportRow[],
  selectedRowIds: readonly string[]
): StagedImportRow[] {
  const uniqueIds = [...new Set(selectedRowIds)];
  if (uniqueIds.length === 0) {
    throw new Error('Select at least one spreadsheet row before building an ActionPlan preview.');
  }
  if (uniqueIds.length > MAX_STAGED_IMPORT_PROPOSALS) {
    throw new Error(
      `Select at most ${MAX_STAGED_IMPORT_PROPOSALS} rows per import preview.`
    );
  }
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const selected = uniqueIds.map((id) => {
    const row = rowsById.get(id);
    if (!row) {
      throw new Error(`Selected import row no longer exists: ${id}.`);
    }
    if (row.status !== 'pending' && row.status !== 'needs_question') {
      throw new Error(`Selected import row ${row.rowNumber} has already been handled.`);
    }
    return row;
  });
  return selected;
}

function rowToSourceRowDraft(row: StagedImportRow) {
  return {
    rowKey: row.id,
    rowNumber: row.rowNumber,
    rawCells: rawCellsForRow(row),
    normalizedCells: normalizedCellsForRow(row),
    excerpts: [
      {
        excerptKey: 'csv-row',
        text: untrustedRowExcerpt(row),
      },
    ],
  };
}

function rowToCandidateDraft(row: StagedImportRow): StagedImportCandidateDraft {
  const parsedFraction = parseImportFraction(row.fractionInput);
  const fraction = parsedFraction.ok ? parsedFraction.value : row.fractionInput;
  const warnings = validateStagedImportRow(row);
  const questions = [
    ...missingRequiredQuestions(row),
    ...npriQuestions(row),
  ];

  return {
    candidateKey: `interest-${row.id}`,
    candidateKind: 'interest_reference',
    confidence: warnings.length > 0 ? 0.55 : 0.86,
    sourceRowKeys: [row.id],
    proposedAction: {
      actionKind: 'create_interest_reference',
      targetRecordType: 'interest_reference',
      targetRecordId: `interest-draft-${stableFragment(row.id)}`,
      summary: `Preview title interest for ${row.grantee || `row ${row.rowNumber}`}.`,
      input: compactJsonObject({
        importSource: 'guided_csv_review',
        sourceTrust: 'untrusted_csv_cells_literal_only',
        partyName: row.grantee,
        grantorName: row.grantor,
        fraction,
        originalFractionText: row.fractionInput,
        interestClass: row.interestClass,
        royaltyKind: row.interestClass === 'npri' ? row.royaltyKind : undefined,
        fixedRoyaltyBasis:
          row.interestClass === 'npri' && row.royaltyKind === 'fixed'
            ? row.fixedRoyaltyBasis
            : undefined,
        instrumentType: row.instrument,
        recordingReference: compactJsonObject({
          instrumentNumber: row.docNo,
          volume: row.vol,
          page: row.page,
        }),
        instrumentDate: row.date,
        recordingDate: row.fileDate,
        legalDescription: row.landDesc,
        remarks: row.remarks,
        tract: compactJsonObject({
          code: row.tractCode,
          name: row.tractName,
          grossAcres: row.grossAcres,
        }),
        sourceRow: {
          rowId: row.id,
          rowNumber: row.rowNumber,
          sheetName: row.sheetName,
        },
      }),
    },
    questions,
  };
}

function missingRequiredQuestions(row: StagedImportRow) {
  const questions: StagedImportCandidateDraft['questions'] = [];
  if (!row.grantee.trim()) {
    questions.push({
      field: 'grantee',
      severity: 'blocking',
      prompt: 'Confirm the grantee before staging this import candidate.',
      reason: 'The selected spreadsheet row does not contain a grantee.',
      sourceRowKey: row.id,
    });
  }
  return questions;
}

function npriQuestions(row: StagedImportRow) {
  if (!stagedImportRowNeedsQuestion(row)) return [];
  const questions: NonNullable<StagedImportCandidateDraft['questions']> = [];
  if (row.royaltyKind === null) {
    questions.push({
      field: 'royaltyKind',
      severity: 'blocking',
      prompt: 'Confirm whether this NPRI is fixed or floating.',
      reason: 'The selected NPRI row does not identify fixed versus floating royalty language.',
      sourceRowKey: row.id,
    });
  }
  if (row.royaltyKind === 'fixed' && row.fixedRoyaltyBasis === null) {
    questions.push({
      field: 'fixedRoyaltyBasis',
      severity: 'blocking',
      prompt: 'Confirm whether the fixed NPRI burdens the branch or the whole tract.',
      reason: 'The selected fixed NPRI row does not identify its burden basis.',
      sourceRowKey: row.id,
    });
  }
  return questions;
}

function rawCellsForRow(row: StagedImportRow): Record<string, string> {
  const cells: Record<string, string> = {};
  row.sourceRow.forEach((cell, index) => {
    cells[`column_${index + 1}`] = cell;
  });
  for (const [field, columnIndex] of Object.entries(row.columnMap)) {
    if (columnIndex !== undefined) {
      cells[`mapped_${field}`] = row.sourceRow[columnIndex] ?? '';
    }
  }
  return cells;
}

function normalizedCellsForRow(row: StagedImportRow): Record<string, string> {
  return compactStringRecord({
    sheetName: row.sheetName,
    rowNumber: String(row.rowNumber),
    tractCode: row.tractCode,
    tractName: row.tractName,
    grossAcres: row.grossAcres,
    grantor: row.grantor,
    grantee: row.grantee,
    instrument: row.instrument,
    docNo: row.docNo,
    vol: row.vol,
    page: row.page,
    date: row.date,
    fileDate: row.fileDate,
    landDesc: row.landDesc,
    fraction: row.fractionInput,
    interestClass: row.interestClass,
    royaltyKind: row.royaltyKind ?? '',
    fixedRoyaltyBasis: row.fixedRoyaltyBasis ?? '',
    remarks: row.remarks,
  });
}

function untrustedRowExcerpt(row: StagedImportRow): string {
  const cells = row.sourceRow.map((cell, index) =>
    `column ${index + 1}: ${JSON.stringify(cell)}`
  );
  return `Untrusted CSV source row ${row.rowNumber} from sheet ${JSON.stringify(row.sheetName)}. ${cells.join('; ')}`;
}

function compactStringRecord(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim().length > 0)
  );
}

function compactJsonObject(
  values: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).length > 0;
      }
      return true;
    })
  );
}

function packageId(fileName: string): string {
  return `csv-${stableFragment(fileName)}`;
}

function sessionSeed(fileName: string, rows: readonly StagedImportRow[]): string {
  return `guided-csv-${stableFragment(fileName)}-${stableFragment(
    rows.map((row) => row.id).join('-')
  )}`;
}

function stableFragment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
    || 'row'
  );
}
