import { z } from 'zod';
import {
  ActionPlanRecordSchema,
  BackendSpineCoreRecordSchema,
  CitationAnchorRecordSchema,
  ImportSessionRecordSchema,
  SourceAttestationRecordSchema,
  SourceCitationRecordSchema,
  type ActionPlanRecord,
  type BackendSpineCoreRecord,
  type BackendSpineRecordType,
  type CitationAnchorRecord,
  type ExtractionRunRecord,
  type ImportSessionRecord,
  type SourceAttestationRecord,
  type SourceCitationRecord,
} from '../backend-spine/contracts';
import {
  baseRecordEnvelope,
  cleanRecordText,
  sha256HexOfText,
  stableRecordId,
  type RecordBuildContext,
} from './record-helpers';

const IdSchema = z.string().trim().min(1).max(160);
const NonEmptyTextSchema = z.string().trim().min(1);
const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const CellMapSchema = z.record(z.string(), z.string());
const JsonObjectSchema = z.record(z.string(), z.unknown());
const UnitConfidenceSchema = z.number().finite().min(0).max(1);

export const ImportSourcePackageKindSchema = z.enum([
  'runsheet',
  'recurring_runsheet',
  'title_opinion',
  'document_folder',
  'rrc',
  'other',
]);
export type ImportSourcePackageKind = z.infer<typeof ImportSourcePackageKindSchema>;

const RecurringRunsheetPackageSchema = z.object({
  seriesKey: IdSchema,
  occurrenceKey: IdSchema,
  cadence: z.enum(['weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc', 'unknown']),
  label: z.string().trim().optional(),
}).strict();
export type RecurringRunsheetPackage = z.infer<
  typeof RecurringRunsheetPackageSchema
>;

export const ImportSourcePackageSchema = z.object({
  packageKind: ImportSourcePackageKindSchema,
  packageId: IdSchema,
  title: NonEmptyTextSchema,
  documentIds: z.array(IdSchema).default([]),
  recurrence: RecurringRunsheetPackageSchema.optional(),
}).strict();
export type ImportSourcePackage = z.infer<typeof ImportSourcePackageSchema>;

export const ImportSourceExcerptSchema = z.object({
  sourceExcerptId: IdSchema,
  sourceRowId: IdSchema,
  documentId: IdSchema.optional(),
  documentVersionId: IdSchema.optional(),
  extractionRunId: IdSchema.optional(),
  vaultObjectId: IdSchema.optional(),
  pageNumber: z.number().int().positive().optional(),
  charStart: z.number().int().nonnegative().optional(),
  charEnd: z.number().int().nonnegative().optional(),
  text: z.string(),
  textHash: ContentHashSchema,
  citationAnchorIds: z.array(IdSchema).default([]),
}).strict();
export type ImportSourceExcerpt = z.infer<typeof ImportSourceExcerptSchema>;

export const ImportSourceRowSchema = z.object({
  sourceRowId: IdSchema,
  importSessionRecordId: IdSchema,
  sourcePackageId: IdSchema,
  rowKey: IdSchema,
  rowNumber: z.number().int().positive(),
  documentId: IdSchema.optional(),
  documentVersionId: IdSchema.optional(),
  extractionRunId: IdSchema.optional(),
  pageNumber: z.number().int().positive().optional(),
  rawCells: CellMapSchema,
  normalizedCells: CellMapSchema,
  contentHash: ContentHashSchema,
  excerptIds: z.array(IdSchema).default([]),
}).strict();
export type ImportSourceRow = z.infer<typeof ImportSourceRowSchema>;

export const ImportCandidateQuestionSchema = z.object({
  questionId: IdSchema,
  sourceRowId: IdSchema,
  field: z.string().trim().optional(),
  severity: z.enum(['blocking', 'review']),
  prompt: NonEmptyTextSchema,
  reason: NonEmptyTextSchema,
}).strict();
export type ImportCandidateQuestion = z.infer<
  typeof ImportCandidateQuestionSchema
>;

const ImportActionTargetRecordTypeSchema = z.enum([
  'instrument_record',
  'interest_reference',
  'lease',
  'tract',
  'source_attestation',
  'curative_issue',
]);
export type ImportActionTargetRecordType = z.infer<
  typeof ImportActionTargetRecordTypeSchema
>;

export const TypedImportActionSchema = z.object({
  actionKind: z.enum([
    'create_instrument_record',
    'create_interest_reference',
    'create_lease',
    'create_tract',
    'create_source_attestation',
    'create_curative_issue',
  ]),
  targetRecordType: ImportActionTargetRecordTypeSchema,
  targetRecordId: IdSchema,
  summary: NonEmptyTextSchema,
  input: JsonObjectSchema,
}).strict();
export type TypedImportAction = z.infer<typeof TypedImportActionSchema>;

export const StagedImportCandidateSchema = z.object({
  candidateId: IdSchema,
  importSessionRecordId: IdSchema,
  candidateKind: ImportActionTargetRecordTypeSchema,
  status: z.enum(['staged', 'approved', 'rejected']).default('staged'),
  confidence: UnitConfidenceSchema,
  sourceRowIds: z.array(IdSchema).min(1),
  sourceExcerptIds: z.array(IdSchema).default([]),
  sourceAttestationId: IdSchema.optional(),
  proposedAction: TypedImportActionSchema,
  questions: z.array(ImportCandidateQuestionSchema).default([]),
}).strict();
export type StagedImportCandidate = z.infer<typeof StagedImportCandidateSchema>;

export interface ImportSourceExcerptDraft {
  excerptKey?: string;
  text: string;
  documentId?: string;
  documentVersionId?: string;
  extractionRunId?: string;
  vaultObjectId?: string;
  pageNumber?: number;
  charStart?: number;
  charEnd?: number;
  citationAnchorIds?: string[];
}

export interface ImportSourceRowDraft {
  rowKey: string;
  rowNumber: number;
  rawCells: Record<string, string>;
  normalizedCells?: Record<string, string>;
  documentId?: string;
  documentVersionId?: string;
  extractionRunId?: string;
  pageNumber?: number;
  excerpts?: ImportSourceExcerptDraft[];
}

export interface StagedImportCandidateDraft {
  candidateKey: string;
  candidateKind: ImportActionTargetRecordType;
  confidence: number;
  sourceRowKeys: string[];
  proposedAction: TypedImportAction;
  questions?: Array<{
    field?: string;
    severity?: ImportCandidateQuestion['severity'];
    prompt: string;
    reason: string;
    sourceRowKey?: string;
  }>;
  sourceAttestationId?: string;
}

export interface TitleOpinionRootDraft {
  documentId?: string;
  effectiveDate?: string;
  attestor?: string;
  scope?: string;
  status?: SourceAttestationRecord['status'];
}

export interface BuildStagedImportSessionInput {
  context: RecordBuildContext;
  sessionIdSeed: string;
  sourcePackage: ImportSourcePackage;
  createdAt: string;
  titleOpinionRoot?: TitleOpinionRootDraft;
  sourceRows: ImportSourceRowDraft[];
  candidates: StagedImportCandidateDraft[];
}

export interface StagedImportSession {
  importSessionRecord: ImportSessionRecord;
  sourcePackage: ImportSourcePackage;
  sourceAttestationRecord?: SourceAttestationRecord;
  sourceRows: readonly ImportSourceRow[];
  sourceExcerpts: readonly ImportSourceExcerpt[];
  candidates: readonly StagedImportCandidate[];
  records: readonly BackendSpineCoreRecord[];
}

export interface StagedActionRecordDraft {
  draftId: string;
  actionPlanId: string;
  actionKind: TypedImportAction['actionKind'];
  targetRecordType: ImportActionTargetRecordType;
  targetRecordId: string;
  status: 'draft';
  approvedBy: 'user' | 'system';
  approvedAt: string;
  input: Record<string, unknown>;
  sourceCitationIds: string[];
  sourceRowIds: string[];
  sourceExcerptIds: string[];
  sourceAttestationId?: string;
  mutationBoundary: 'project_records_only_no_live_store';
}

export interface ImportApprovalDraft {
  approvedActionPlan: ActionPlanRecord;
  actionRecordDrafts: readonly StagedActionRecordDraft[];
  targetRecordDrafts: readonly TypedImportAction[];
  sourceCitationRecords: readonly SourceCitationRecord[];
  citationAnchorRecords: readonly CitationAnchorRecord[];
  recordsToAppend: readonly BackendSpineCoreRecord[];
  wouldMutateLiveStores: false;
  wouldWriteLandroidV8: false;
}

export interface ImportRejectionResult {
  rejectedCandidateIds: readonly string[];
  remainingSession: StagedImportSession;
  recordsToAppend: readonly BackendSpineCoreRecord[];
  actionRecordDrafts: readonly StagedActionRecordDraft[];
  targetRecordDrafts: readonly TypedImportAction[];
  mutationCount: 0;
  wouldMutateLiveStores: false;
  wouldWriteLandroidV8: false;
}

export interface ImportSourceReviewItem {
  candidateId: string;
  sourceRowId: string;
  documentId?: string;
  rowNumber: number;
  textAvailable: boolean;
  reviewMode: 'source_row_only' | 'side_by_side_text';
  sourceRow: {
    rawCells: Record<string, string>;
    normalizedCells: Record<string, string>;
    contentHash: string;
  };
  sourceExcerpts: Array<{
    sourceExcerptId: string;
    text: string;
    pageNumber?: number;
    charStart?: number;
    charEnd?: number;
    vaultObjectId?: string;
    extractionRunId?: string;
  }>;
}

function parseRecord(record: unknown): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(record);
}

function importKindForPackage(
  packageKind: ImportSourcePackageKind
): ImportSessionRecord['importKind'] {
  return packageKind === 'recurring_runsheet' ? 'runsheet' : packageKind;
}

function assertPackageShape(sourcePackage: ImportSourcePackage) {
  if (sourcePackage.packageKind === 'recurring_runsheet' && !sourcePackage.recurrence) {
    throw new Error('Recurring runsheet packages require recurrence metadata.');
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function stableHashOf(value: unknown): Promise<string> {
  return sha256HexOfText(stableStringify(value));
}

function cloneCellMap(cells: Record<string, string> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(cells ?? {})) {
    normalized[key] = cleanRecordText(value);
  }
  return normalized;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return value as Readonly<T>;
}

function createContextFromRecord(record: ImportSessionRecord, generatedAt: string): RecordBuildContext {
  return {
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    generatedAt,
    revision: record.revision,
    source: record.source,
    syncState: record.syncState,
  };
}

function cleanQuestionText(value: string): string {
  return cleanRecordText(value) || 'Review the source row before staging this value.';
}

function questionId(input: {
  workspaceId: string;
  candidateId: string;
  sourceRowId: string;
  field: string;
  reason: string;
}): string {
  return stableRecordId(
    input.workspaceId,
    'import-question',
    input.candidateId,
    input.sourceRowId,
    input.field,
    input.reason
  );
}

function looksLikeCleanFraction(value: unknown): boolean {
  const candidate = cleanRecordText(typeof value === 'string' ? value : '');
  if (!candidate) return false;
  if (/^\d+(\.\d+)?$/.test(candidate)) return Number.isFinite(Number(candidate));
  const match = candidate.match(/^(\d+)\s*\/\s*(\d+)$/);
  return Boolean(match && Number(match[2]) !== 0);
}

function candidateFieldsToQuestion(
  action: TypedImportAction
): Array<{ field: string; reason: string }> {
  const fields: Array<{ field: string; reason: string }> = [];
  if (
    action.targetRecordType === 'interest_reference'
    && !looksLikeCleanFraction(action.input.fraction)
  ) {
    fields.push({
      field: 'fraction',
      reason: 'The source row does not contain a clean mineral-interest fraction.',
    });
  }
  if (action.targetRecordType === 'lease') {
    for (const field of ['royaltyRate', 'leasedInterest']) {
      const value = action.input[field];
      if (value !== undefined && !looksLikeCleanFraction(value)) {
        fields.push({
          field,
          reason: `The source row does not contain a clean ${field} fraction.`,
        });
      }
    }
  }
  return fields;
}

function buildCandidateQuestions(input: {
  context: RecordBuildContext;
  candidateId: string;
  sourceRowIds: string[];
  draft: StagedImportCandidateDraft;
  action: TypedImportAction;
}): ImportCandidateQuestion[] {
  const sourceRowId = input.sourceRowIds[0];
  const manual = (input.draft.questions ?? []).map((question) => {
    const rowId = input.sourceRowIds[
      Math.max(0, input.draft.sourceRowKeys.indexOf(question.sourceRowKey ?? ''))
    ] ?? sourceRowId;
    return ImportCandidateQuestionSchema.parse({
      questionId: questionId({
        workspaceId: input.context.workspaceId,
        candidateId: input.candidateId,
        sourceRowId: rowId,
        field: question.field ?? 'review',
        reason: question.reason,
      }),
      sourceRowId: rowId,
      field: question.field,
      severity: question.severity ?? 'blocking',
      prompt: cleanQuestionText(question.prompt),
      reason: cleanQuestionText(question.reason),
    });
  });
  const inferred = candidateFieldsToQuestion(input.action).map((question) =>
    ImportCandidateQuestionSchema.parse({
      questionId: questionId({
        workspaceId: input.context.workspaceId,
        candidateId: input.candidateId,
        sourceRowId,
        field: question.field,
        reason: question.reason,
      }),
      sourceRowId,
      field: question.field,
      severity: 'blocking',
      prompt: `Confirm the ${question.field} before this candidate can be approved.`,
      reason: question.reason,
    })
  );
  const questionsById = new Map(
    [...manual, ...inferred].map((question) => [question.questionId, question])
  );
  return [...questionsById.values()];
}

function assertCandidateRows(
  candidate: StagedImportCandidateDraft,
  sourceRowsByKey: Map<string, ImportSourceRow>
): ImportSourceRow[] {
  const rows = candidate.sourceRowKeys.map((rowKey) => sourceRowsByKey.get(rowKey));
  const missing = candidate.sourceRowKeys.filter((_, index) => !rows[index]);
  if (missing.length > 0) {
    throw new Error(
      `Import candidate ${candidate.candidateKey} references missing source row(s): ${missing.join(', ')}.`
    );
  }
  return rows as ImportSourceRow[];
}

function titleOpinionRootRecord(input: {
  context: RecordBuildContext;
  sessionRecordId: string;
  packageDocumentIds: string[];
  titleOpinionRoot?: TitleOpinionRootDraft;
}): SourceAttestationRecord | undefined {
  if (!input.titleOpinionRoot) return undefined;
  return SourceAttestationRecordSchema.parse({
    ...baseRecordEnvelope(
      'source_attestation',
      stableRecordId(
        input.context.workspaceId,
        'source-attestation',
        input.sessionRecordId,
        'title-opinion-root'
      ),
      input.context
    ),
    sourceType: 'title_opinion',
    documentId: input.titleOpinionRoot.documentId ?? input.packageDocumentIds[0],
    effectiveDate: input.titleOpinionRoot.effectiveDate,
    attestor: input.titleOpinionRoot.attestor,
    scope: input.titleOpinionRoot.scope,
    status: input.titleOpinionRoot.status ?? 'draft',
  });
}

export async function buildStagedImportSession(
  input: BuildStagedImportSessionInput
): Promise<StagedImportSession> {
  const sourcePackage = ImportSourcePackageSchema.parse(input.sourcePackage);
  assertPackageShape(sourcePackage);
  if (sourcePackage.packageKind === 'title_opinion' && !input.titleOpinionRoot) {
    throw new Error('Title-opinion imports require a SourceAttestation root draft.');
  }

  const importSessionRecordId = stableRecordId(
    input.context.workspaceId,
    'import-session',
    input.sessionIdSeed
  );
  const importSessionRecord = ImportSessionRecordSchema.parse({
    ...baseRecordEnvelope('import_session', importSessionRecordId, input.context),
    importKind: importKindForPackage(sourcePackage.packageKind),
    status: 'staged',
    sourceDocumentIds: sourcePackage.documentIds,
    createdAt: input.createdAt,
  });
  const sourceAttestationRecord = titleOpinionRootRecord({
    context: input.context,
    sessionRecordId: importSessionRecordId,
    packageDocumentIds: sourcePackage.documentIds,
    titleOpinionRoot: input.titleOpinionRoot,
  });

  const sourceRows: ImportSourceRow[] = [];
  const sourceExcerpts: ImportSourceExcerpt[] = [];
  const sourceRowsByKey = new Map<string, ImportSourceRow>();

  for (const rowDraft of input.sourceRows) {
    const rawCells = cloneCellMap(rowDraft.rawCells);
    const normalizedCells = cloneCellMap(rowDraft.normalizedCells ?? rowDraft.rawCells);
    const sourceRowId = stableRecordId(
      input.context.workspaceId,
      'import-source-row',
      importSessionRecordId,
      rowDraft.rowKey
    );
    const rowExcerpts: ImportSourceExcerpt[] = [];

    for (const [index, excerptDraft] of (rowDraft.excerpts ?? []).entries()) {
      const text = excerptDraft.text;
      const sourceExcerptId = stableRecordId(
        input.context.workspaceId,
        'import-source-excerpt',
        sourceRowId,
        excerptDraft.excerptKey ?? String(index)
      );
      rowExcerpts.push(ImportSourceExcerptSchema.parse({
        sourceExcerptId,
        sourceRowId,
        documentId: excerptDraft.documentId ?? rowDraft.documentId,
        documentVersionId: excerptDraft.documentVersionId ?? rowDraft.documentVersionId,
        extractionRunId: excerptDraft.extractionRunId ?? rowDraft.extractionRunId,
        vaultObjectId: excerptDraft.vaultObjectId,
        pageNumber: excerptDraft.pageNumber ?? rowDraft.pageNumber,
        charStart: excerptDraft.charStart,
        charEnd: excerptDraft.charEnd,
        text,
        textHash: await stableHashOf(text),
        citationAnchorIds: excerptDraft.citationAnchorIds ?? [],
      }));
    }

    const sourceRow = ImportSourceRowSchema.parse({
      sourceRowId,
      importSessionRecordId,
      sourcePackageId: sourcePackage.packageId,
      rowKey: rowDraft.rowKey,
      rowNumber: rowDraft.rowNumber,
      documentId: rowDraft.documentId,
      documentVersionId: rowDraft.documentVersionId,
      extractionRunId: rowDraft.extractionRunId,
      pageNumber: rowDraft.pageNumber,
      rawCells,
      normalizedCells,
      contentHash: await stableHashOf({
        rowNumber: rowDraft.rowNumber,
        rawCells,
        normalizedCells,
        documentId: rowDraft.documentId,
        pageNumber: rowDraft.pageNumber,
      }),
      excerptIds: rowExcerpts.map((excerpt) => excerpt.sourceExcerptId),
    });
    sourceRows.push(sourceRow);
    sourceExcerpts.push(...rowExcerpts);
    sourceRowsByKey.set(rowDraft.rowKey, sourceRow);
  }

  const excerptsByRowId = new Map<string, ImportSourceExcerpt[]>();
  for (const excerpt of sourceExcerpts) {
    excerptsByRowId.set(excerpt.sourceRowId, [
      ...(excerptsByRowId.get(excerpt.sourceRowId) ?? []),
      excerpt,
    ]);
  }

  const candidates = input.candidates.map((draft) => {
    const rows = assertCandidateRows(draft, sourceRowsByKey);
    const candidateId = stableRecordId(
      input.context.workspaceId,
      'import-candidate',
      importSessionRecordId,
      draft.candidateKey
    );
    const proposedAction = TypedImportActionSchema.parse(draft.proposedAction);
    const sourceRowIds = rows.map((row) => row.sourceRowId);
    const sourceExcerptIds = rows.flatMap((row) =>
      (excerptsByRowId.get(row.sourceRowId) ?? []).map((excerpt) => excerpt.sourceExcerptId)
    );
    return StagedImportCandidateSchema.parse({
      candidateId,
      importSessionRecordId,
      candidateKind: draft.candidateKind,
      status: 'staged',
      confidence: draft.confidence,
      sourceRowIds,
      sourceExcerptIds,
      sourceAttestationId: draft.sourceAttestationId ?? sourceAttestationRecord?.recordId,
      proposedAction,
      questions: buildCandidateQuestions({
        context: input.context,
        candidateId,
        sourceRowIds,
        draft,
        action: proposedAction,
      }),
    });
  });

  const records = [
    parseRecord(importSessionRecord),
    ...(sourceAttestationRecord ? [parseRecord(sourceAttestationRecord)] : []),
  ];

  return deepFreeze({
    importSessionRecord,
    sourcePackage,
    sourceAttestationRecord,
    sourceRows,
    sourceExcerpts,
    candidates,
    records,
  }) as StagedImportSession;
}

function selectCandidates(
  session: StagedImportSession,
  candidateIds?: readonly string[]
): StagedImportCandidate[] {
  const selectedIds = new Set(candidateIds ?? session.candidates.map((candidate) => candidate.candidateId));
  const selected = session.candidates.filter((candidate) =>
    selectedIds.has(candidate.candidateId)
  );
  if (selected.length !== selectedIds.size) {
    const found = new Set(selected.map((candidate) => candidate.candidateId));
    const missing = [...selectedIds].filter((candidateId) => !found.has(candidateId));
    throw new Error(`Unknown import candidate(s): ${missing.join(', ')}.`);
  }
  if (selected.length === 0) {
    throw new Error('At least one staged import candidate is required.');
  }
  return selected;
}

function sourceRowsForCandidate(
  session: StagedImportSession,
  candidate: StagedImportCandidate
): ImportSourceRow[] {
  const rowsById = new Map(session.sourceRows.map((row) => [row.sourceRowId, row]));
  return candidate.sourceRowIds.map((sourceRowId) => {
    const row = rowsById.get(sourceRowId);
    if (!row) {
      throw new Error(`Import candidate ${candidate.candidateId} references a missing source row.`);
    }
    return row;
  });
}

function sourceExcerptsForCandidate(
  session: StagedImportSession,
  candidate: StagedImportCandidate
): ImportSourceExcerpt[] {
  const excerptsById = new Map(
    session.sourceExcerpts.map((excerpt) => [excerpt.sourceExcerptId, excerpt])
  );
  return candidate.sourceExcerptIds
    .map((sourceExcerptId) => excerptsById.get(sourceExcerptId))
    .filter((excerpt): excerpt is ImportSourceExcerpt => Boolean(excerpt));
}

function dryRunInputForCandidate(
  session: StagedImportSession,
  candidate: StagedImportCandidate
) {
  return {
    candidateId: candidate.candidateId,
    candidateKind: candidate.candidateKind,
    confidence: candidate.confidence,
    proposedAction: candidate.proposedAction,
    sourceAttestationId: candidate.sourceAttestationId,
    sourceRows: sourceRowsForCandidate(session, candidate).map((row) => ({
      sourceRowId: row.sourceRowId,
      rowNumber: row.rowNumber,
      documentId: row.documentId,
      contentHash: row.contentHash,
    })),
    sourceExcerptIds: candidate.sourceExcerptIds,
    questions: candidate.questions,
  };
}

export function buildImportSessionDryRunActionPlan(input: {
  session: StagedImportSession;
  candidateIds?: readonly string[];
  generatedAt: string;
  revision?: number;
  proposedBy?: ActionPlanRecord['proposedBy'];
}): ActionPlanRecord {
  const selected = selectCandidates(input.session, input.candidateIds);
  const candidateIds = selected.map((candidate) => candidate.candidateId);
  const blockedCandidateIds = selected
    .filter((candidate) => candidate.questions.length > 0)
    .map((candidate) => candidate.candidateId);
  const context = {
    ...createContextFromRecord(input.session.importSessionRecord, input.generatedAt),
    revision: input.revision ?? input.session.importSessionRecord.revision,
  };

  return ActionPlanRecordSchema.parse({
    ...baseRecordEnvelope(
      'action_plan',
      stableRecordId(
        context.workspaceId,
        'action-plan',
        'import-session-dry-run',
        input.session.importSessionRecord.recordId,
        candidateIds.join(':')
      ),
      context
    ),
    actionKind: 'import_session_dry_run',
    status: 'needs_review',
    proposedBy: input.proposedBy ?? 'import',
    summary: `Dry-run preview for ${candidateIds.length} staged import candidate(s).`,
    input: {
      dryRun: true,
      mutationBoundary: 'project_records_only_no_live_store',
      wouldMutateLiveStores: false,
      wouldWriteLandroidV8: false,
      importSessionRecordId: input.session.importSessionRecord.recordId,
      sourcePackage: input.session.sourcePackage,
      candidateIds,
      blockedCandidateIds,
      questionsByCandidateId: Object.fromEntries(
        selected.map((candidate) => [candidate.candidateId, candidate.questions])
      ),
      typedActions: selected.map((candidate) => candidate.proposedAction),
      candidates: selected.map((candidate) =>
        dryRunInputForCandidate(input.session, candidate)
      ),
    },
  });
}

function readPlanCandidateIds(actionPlan: ActionPlanRecord): string[] {
  const candidateIds = actionPlan.input.candidateIds;
  if (!Array.isArray(candidateIds) || !candidateIds.every((id) => typeof id === 'string')) {
    throw new Error('Import approval requires an ActionPlan dry-run with candidate IDs.');
  }
  return candidateIds;
}

function assertDryRunPlanCoversCandidates(
  actionPlan: ActionPlanRecord,
  candidateIds: readonly string[]
) {
  if (actionPlan.actionKind !== 'import_session_dry_run' || actionPlan.input.dryRun !== true) {
    throw new Error('Import approval requires an ActionPlan dry-run preview first.');
  }
  const planCandidateIds = new Set(readPlanCandidateIds(actionPlan));
  const missing = candidateIds.filter((candidateId) => !planCandidateIds.has(candidateId));
  if (missing.length > 0) {
    throw new Error(
      `ActionPlan dry-run does not cover candidate(s): ${missing.join(', ')}.`
    );
  }
}

function assertCandidatesAreApprovable(candidates: StagedImportCandidate[]) {
  const questioned = candidates.filter((candidate) => candidate.questions.length > 0);
  if (questioned.length > 0) {
    throw new Error(
      `Cannot approve import candidate(s) with unanswered questions: ${questioned
        .map((candidate) => candidate.candidateId)
        .join(', ')}.`
    );
  }
  const rejected = candidates.filter((candidate) => candidate.status === 'rejected');
  if (rejected.length > 0) {
    throw new Error(
      `Cannot approve rejected import candidate(s): ${rejected
        .map((candidate) => candidate.candidateId)
        .join(', ')}.`
    );
  }
}

function rowDocumentId(session: StagedImportSession, row: ImportSourceRow): string {
  const documentId = row.documentId ?? session.sourcePackage.documentIds[0];
  if (!documentId) {
    throw new Error(
      `Approved import source row ${row.sourceRowId} must cite a source document.`
    );
  }
  return documentId;
}

function citationConfidence(candidate: StagedImportCandidate): SourceCitationRecord['confidence'] {
  return candidate.confidence >= 0.85 ? 'supported' : 'partial';
}

function sourceCitationId(input: {
  workspaceId: string;
  actionPlanId: string;
  candidateId: string;
  sourceRowId: string;
}): string {
  return stableRecordId(
    input.workspaceId,
    'source-citation',
    input.actionPlanId,
    input.candidateId,
    input.sourceRowId
  );
}

function citationAnchorId(input: {
  workspaceId: string;
  sourceCitationId: string;
  sourceExcerptId: string;
}): string {
  return stableRecordId(
    input.workspaceId,
    'citation-anchor',
    input.sourceCitationId,
    input.sourceExcerptId
  );
}

function buildApprovedActionPlan(input: {
  actionPlan: ActionPlanRecord;
  approvedAt: string;
  revision?: number;
}): ActionPlanRecord {
  return ActionPlanRecordSchema.parse({
    ...input.actionPlan,
    status: 'approved',
    lastModified: input.approvedAt,
    revision: input.revision ?? input.actionPlan.revision + 1,
  });
}

export async function approveImportSessionCandidates(input: {
  session: StagedImportSession;
  dryRunActionPlan: ActionPlanRecord;
  candidateIds: readonly string[];
  approvedAt: string;
  approvedBy: 'user' | 'system';
  revision?: number;
}): Promise<ImportApprovalDraft> {
  const selected = selectCandidates(input.session, input.candidateIds);
  assertDryRunPlanCoversCandidates(input.dryRunActionPlan, input.candidateIds);
  assertCandidatesAreApprovable(selected);

  const context = createContextFromRecord(
    input.session.importSessionRecord,
    input.approvedAt
  );
  const excerptsByRowId = new Map<string, ImportSourceExcerpt[]>();
  for (const excerpt of input.session.sourceExcerpts) {
    excerptsByRowId.set(excerpt.sourceRowId, [
      ...(excerptsByRowId.get(excerpt.sourceRowId) ?? []),
      excerpt,
    ]);
  }

  const sourceCitationRecords: SourceCitationRecord[] = [];
  const citationAnchorRecords: CitationAnchorRecord[] = [];
  const actionRecordDrafts: StagedActionRecordDraft[] = [];

  for (const candidate of selected) {
    const citationIds: string[] = [];
    for (const row of sourceRowsForCandidate(input.session, candidate)) {
      const documentId = rowDocumentId(input.session, row);
      const excerpts = excerptsByRowId.get(row.sourceRowId) ?? [];
      const primaryExcerpt = excerpts[0];
      const citationRecordId = sourceCitationId({
        workspaceId: context.workspaceId,
        actionPlanId: input.dryRunActionPlan.recordId,
        candidateId: candidate.candidateId,
        sourceRowId: row.sourceRowId,
      });
      const citation = SourceCitationRecordSchema.parse({
        ...baseRecordEnvelope('source_citation', citationRecordId, context),
        documentId,
        documentVersionId: primaryExcerpt?.documentVersionId ?? row.documentVersionId,
        extractionRunId: primaryExcerpt?.extractionRunId ?? row.extractionRunId,
        citedRecordId: row.sourceRowId,
        pageNumber: primaryExcerpt?.pageNumber ?? row.pageNumber,
        quotedText: primaryExcerpt?.text,
        quotedTextHash: primaryExcerpt?.textHash,
        confidence: citationConfidence(candidate),
        createdBy: 'import',
        createdAt: input.approvedAt,
      });
      sourceCitationRecords.push(citation);
      citationIds.push(citation.recordId);

      for (const excerpt of excerpts) {
        if (
          excerpt.vaultObjectId
          && typeof excerpt.pageNumber === 'number'
          && typeof excerpt.charStart === 'number'
          && typeof excerpt.charEnd === 'number'
          && excerpt.charEnd > excerpt.charStart
        ) {
          citationAnchorRecords.push(CitationAnchorRecordSchema.parse({
            ...baseRecordEnvelope(
              'citation_anchor',
              citationAnchorId({
                workspaceId: context.workspaceId,
                sourceCitationId: citation.recordId,
                sourceExcerptId: excerpt.sourceExcerptId,
              }),
              context
            ),
            sourceCitationId: citation.recordId,
            vaultObjectId: excerpt.vaultObjectId,
            pageNumber: excerpt.pageNumber,
            charStart: excerpt.charStart,
            charEnd: excerpt.charEnd,
          }));
        }
      }
    }

    actionRecordDrafts.push({
      draftId: stableRecordId(
        context.workspaceId,
        'action-record-draft',
        input.dryRunActionPlan.recordId,
        candidate.candidateId
      ),
      actionPlanId: input.dryRunActionPlan.recordId,
      actionKind: candidate.proposedAction.actionKind,
      targetRecordType: candidate.proposedAction.targetRecordType,
      targetRecordId: candidate.proposedAction.targetRecordId,
      status: 'draft',
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt,
      input: candidate.proposedAction.input,
      sourceCitationIds: citationIds,
      sourceRowIds: candidate.sourceRowIds,
      sourceExcerptIds: candidate.sourceExcerptIds,
      sourceAttestationId: candidate.sourceAttestationId,
      mutationBoundary: 'project_records_only_no_live_store',
    });
  }

  const approvedActionPlan = buildApprovedActionPlan({
    actionPlan: input.dryRunActionPlan,
    approvedAt: input.approvedAt,
    revision: input.revision,
  });
  const recordsToAppend = [
    ...sourceCitationRecords.map(parseRecord),
    ...citationAnchorRecords.map(parseRecord),
  ];

  return deepFreeze({
    approvedActionPlan,
    actionRecordDrafts,
    targetRecordDrafts: selected.map((candidate) => candidate.proposedAction),
    sourceCitationRecords,
    citationAnchorRecords,
    recordsToAppend,
    wouldMutateLiveStores: false,
    wouldWriteLandroidV8: false,
  }) as ImportApprovalDraft;
}

export function rejectImportSessionCandidates(input: {
  session: StagedImportSession;
  candidateIds: readonly string[];
}): ImportRejectionResult {
  const selected = selectCandidates(input.session, input.candidateIds);
  const rejectedCandidateIds = selected.map((candidate) => candidate.candidateId);
  const rejected = new Set(rejectedCandidateIds);
  const remainingSession = deepFreeze({
    ...input.session,
    candidates: input.session.candidates.filter(
      (candidate) => !rejected.has(candidate.candidateId)
    ),
  }) as StagedImportSession;

  return deepFreeze({
    rejectedCandidateIds,
    remainingSession,
    recordsToAppend: [],
    actionRecordDrafts: [],
    targetRecordDrafts: [],
    mutationCount: 0,
    wouldMutateLiveStores: false,
    wouldWriteLandroidV8: false,
  }) as ImportRejectionResult;
}

function extractionTextAvailable(
  excerpt: ImportSourceExcerpt,
  records: readonly BackendSpineCoreRecord[]
): boolean {
  if (!cleanRecordText(excerpt.text)) return false;
  const extractionRunId = excerpt.extractionRunId;
  if (!extractionRunId) return true;
  const run = records.find(
    (record): record is ExtractionRunRecord =>
      record.recordType === 'extraction_run' && record.recordId === extractionRunId
  );
  if (!run || !['succeeded', 'partial'].includes(run.status)) return false;
  if (!excerpt.vaultObjectId) return true;
  return records.some(
    (record) => record.recordType === 'vault_object'
      && record.recordId === excerpt.vaultObjectId
  );
}

export function buildImportSourceReview(input: {
  session: StagedImportSession;
  records?: readonly BackendSpineCoreRecord[];
  candidateIds?: readonly string[];
}): ImportSourceReviewItem[] {
  const selected = selectCandidates(input.session, input.candidateIds);
  const records = input.records ?? [];

  return selected.flatMap((candidate) => {
    const excerptsByRowId = new Map<string, ImportSourceExcerpt[]>();
    for (const excerpt of sourceExcerptsForCandidate(input.session, candidate)) {
      excerptsByRowId.set(excerpt.sourceRowId, [
        ...(excerptsByRowId.get(excerpt.sourceRowId) ?? []),
        excerpt,
      ]);
    }

    return sourceRowsForCandidate(input.session, candidate).map((row) => {
      const excerpts = excerptsByRowId.get(row.sourceRowId) ?? [];
      const textAvailable = excerpts.some((excerpt) =>
        extractionTextAvailable(excerpt, records)
      );
      return {
        candidateId: candidate.candidateId,
        sourceRowId: row.sourceRowId,
        documentId: row.documentId,
        rowNumber: row.rowNumber,
        textAvailable,
        reviewMode: textAvailable ? 'side_by_side_text' : 'source_row_only',
        sourceRow: {
          rawCells: row.rawCells,
          normalizedCells: row.normalizedCells,
          contentHash: row.contentHash,
        },
        sourceExcerpts: excerpts.map((excerpt) => ({
          sourceExcerptId: excerpt.sourceExcerptId,
          text: excerpt.text,
          pageNumber: excerpt.pageNumber,
          charStart: excerpt.charStart,
          charEnd: excerpt.charEnd,
          vaultObjectId: excerpt.vaultObjectId,
          extractionRunId: excerpt.extractionRunId,
        })),
      };
    });
  });
}

export const PHASE_3_IMPORT_SESSION_MUTATION_BOUNDARY = {
  wouldMutateLiveStores: false,
  wouldWriteLandroidV8: false,
  blockedRecordTypes: [
    'action_record',
    'instrument_record',
    'interest_reference',
    'lease',
    'tract',
  ] satisfies BackendSpineRecordType[],
} as const;
