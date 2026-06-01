import {
  BackendSpineCoreRecordSchema,
  type BackendSpineCoreRecord,
  type ExtractionConfidenceSummary,
  type ExtractionMode,
  type ExtractionProviderDecision,
  type ExtractionRunRecord,
  type ExtractionRunStatus,
  type SourceCitationRecord,
  type VaultObjectRecord,
} from '../backend-spine/contracts';
import {
  baseRecordEnvelope,
  requireContentHash,
  sha256HexOfText,
  stableRecordId,
  type RecordBuildContext,
} from './record-helpers';

export type ExtractionDerivativeObjectKind = Extract<
  VaultObjectRecord['objectKind'],
  'searchable_pdf' | 'hocr_json' | 'text_json' | 'text_file' | 'page_image'
>;

export interface LocalExtractionToolRequirement {
  command: string;
  purpose: string;
  requiredFor: ExtractionMode[];
}

export const LOCAL_DOCUMENT_TEXT_EXTRACTION_TOOLS: LocalExtractionToolRequirement[] = [
  {
    command: 'pdftotext',
    purpose: 'extract embedded text from selectable PDFs without raster OCR',
    requiredFor: ['selectable_pdf_text'],
  },
  {
    command: 'pdftoppm',
    purpose: 'render scanned PDF pages to images for local OCR',
    requiredFor: ['scanned_pdf_ocr'],
  },
  {
    command: 'pdfimages',
    purpose: 'inspect or extract embedded page images for OCR triage',
    requiredFor: ['scanned_pdf_ocr'],
  },
  {
    command: 'tesseract',
    purpose: 'run local OCR and emit text, hOCR, TSV, or PDF derivatives',
    requiredFor: ['scanned_pdf_ocr'],
  },
  {
    command: 'qpdf',
    purpose: 'validate and normalize PDF derivatives without changing originals',
    requiredFor: ['selectable_pdf_text', 'scanned_pdf_ocr'],
  },
  {
    command: 'ocrmypdf',
    purpose: 'produce searchable PDF derivatives from scanned PDFs',
    requiredFor: ['scanned_pdf_ocr'],
  },
];

export const DOCUMENT_TEXT_EXTRACTION_PIPELINES: Record<
  ExtractionMode,
  {
    localDefault: true;
    cloudDefault: false;
    derivativeObjectKinds: ExtractionDerivativeObjectKind[];
  }
> = {
  selectable_pdf_text: {
    localDefault: true,
    cloudDefault: false,
    derivativeObjectKinds: ['text_file', 'text_json'],
  },
  scanned_pdf_ocr: {
    localDefault: true,
    cloudDefault: false,
    derivativeObjectKinds: [
      'searchable_pdf',
      'hocr_json',
      'text_json',
      'text_file',
      'page_image',
    ],
  },
};

interface ExtractionDerivativeDraft {
  objectKind: ExtractionDerivativeObjectKind;
  contentHash: string;
  byteLength: number;
  storageRef: string;
  vaultObjectId?: string;
  localOnly?: boolean;
}

interface ExtractionAnchorDraft {
  pageNumber: number;
  charStart: number;
  charEnd: number;
  bbox?: [number, number, number, number];
  polygon?: Array<[number, number]>;
  vaultObjectId?: string;
}

interface ExtractionCitationDraft {
  citationIdSeed: string;
  citedRecordId?: string;
  pageNumber: number;
  quotedText?: string;
  quotedTextHash?: string;
  confidence: SourceCitationRecord['confidence'];
  anchors: ExtractionAnchorDraft[];
  createdBy?: SourceCitationRecord['createdBy'];
  createdAt?: string;
}

export interface BuildExtractionRunRecordsInput {
  context: RecordBuildContext;
  runIdSeed: string;
  documentId: string;
  inputDocumentVersionId: string;
  inputVaultObjectId: string;
  extractionMode: ExtractionMode;
  engine: string;
  engineVersion: string;
  parameters: Record<string, unknown>;
  providerDecision?: ExtractionProviderDecision;
  status: ExtractionRunStatus;
  startedAt: string;
  completedAt?: string;
  confidenceSummary?: ExtractionConfidenceSummary;
  outputVaultObjects: ExtractionDerivativeDraft[];
  citations?: ExtractionCitationDraft[];
  errorMessage?: string;
}

function parseRecord(record: unknown): BackendSpineCoreRecord {
  return BackendSpineCoreRecordSchema.parse(record);
}

function defaultProviderDecision(engine: string): ExtractionProviderDecision {
  return {
    providerKind: 'local',
    providerName: engine,
  };
}

function assertProviderDecision(
  providerDecision: ExtractionProviderDecision,
  documentId: string
) {
  if (
    providerDecision.providerKind === 'cloud'
    && providerDecision.optInDocumentId !== documentId
  ) {
    throw new Error(
      'Cloud OCR requires an explicit provider decision scoped to the input document.'
    );
  }
}

function assertFailureHasNoDerivatives(input: BuildExtractionRunRecordsInput) {
  if (
    (input.status === 'failed' || input.status === 'canceled')
    && (input.outputVaultObjects.length > 0 || (input.citations?.length ?? 0) > 0)
  ) {
    throw new Error(
      'Failed or canceled extraction runs must not emit derivative vault objects or citations.'
    );
  }
}

function assertAnchorSpan(anchor: ExtractionAnchorDraft) {
  if (anchor.pageNumber < 1 || !Number.isInteger(anchor.pageNumber)) {
    throw new Error('Extraction citation anchors require a positive integer pageNumber.');
  }
  if (!Number.isInteger(anchor.charStart) || !Number.isInteger(anchor.charEnd)) {
    throw new Error('Extraction citation anchors require integer character spans.');
  }
  if (anchor.charEnd <= anchor.charStart) {
    throw new Error('Extraction citation anchor charEnd must be greater than charStart.');
  }
}

function assertCitationAnchorsHaveVaultObjects(input: {
  citations?: ExtractionCitationDraft[];
  defaultTextVaultObjectId?: string;
}) {
  if (input.defaultTextVaultObjectId) return;
  const hasUnresolvedAnchor = (input.citations ?? []).some((citation) =>
    citation.anchors.some((anchor) => !anchor.vaultObjectId)
  );
  if (hasUnresolvedAnchor) {
    throw new Error(
      'Extraction citation anchors require a text derivative vault object or explicit vaultObjectId.'
    );
  }
}

function derivativeVaultObjectId(input: {
  context: RecordBuildContext;
  inputVaultObjectId: string;
  objectKind: ExtractionDerivativeObjectKind;
  contentHash: string;
  storageRef: string;
}): string {
  return stableRecordId(
    input.context.workspaceId,
    'vault-object',
    'derivative',
    input.inputVaultObjectId,
    input.objectKind,
    input.contentHash,
    input.storageRef
  );
}

function sourceCitationId(input: {
  context: RecordBuildContext;
  extractionRunId: string;
  citationIdSeed: string;
  pageNumber: number;
}): string {
  return stableRecordId(
    input.context.workspaceId,
    'source-citation',
    input.extractionRunId,
    input.citationIdSeed,
    String(input.pageNumber)
  );
}

function citationAnchorId(input: {
  context: RecordBuildContext;
  sourceCitationId: string;
  anchorIndex: number;
}): string {
  return stableRecordId(
    input.context.workspaceId,
    'citation-anchor',
    input.sourceCitationId,
    String(input.anchorIndex)
  );
}

export async function buildExtractionRunRecords(
  input: BuildExtractionRunRecordsInput
): Promise<BackendSpineCoreRecord[]> {
  const providerDecision = input.providerDecision ?? defaultProviderDecision(input.engine);
  assertProviderDecision(providerDecision, input.documentId);
  assertFailureHasNoDerivatives(input);

  const extractionRunId = stableRecordId(
    input.context.workspaceId,
    'extraction-run',
    input.inputDocumentVersionId,
    input.extractionMode,
    input.runIdSeed
  );
  const derivativeRecords = input.outputVaultObjects.map((draft) => {
    const contentHash = requireContentHash(draft.contentHash, draft.storageRef);
    const vaultObjectId = draft.vaultObjectId ?? derivativeVaultObjectId({
      context: input.context,
      inputVaultObjectId: input.inputVaultObjectId,
      objectKind: draft.objectKind,
      contentHash,
      storageRef: draft.storageRef,
    });
    return parseRecord({
      ...baseRecordEnvelope('vault_object', vaultObjectId, input.context),
      objectId: vaultObjectId,
      objectKind: draft.objectKind,
      derivedFromVaultObjectId: input.inputVaultObjectId,
      contentHash,
      byteLength: draft.byteLength,
      storageRef: draft.storageRef,
      localOnly: draft.localOnly ?? true,
    }) as VaultObjectRecord;
  });
  const outputVaultObjectIds = derivativeRecords.map((record) => record.recordId);
  const defaultTextVaultObjectId = derivativeRecords.find((record) =>
    ['text_json', 'text_file', 'hocr_json'].includes(record.objectKind)
  )?.recordId;
  assertCitationAnchorsHaveVaultObjects({
    citations: input.citations,
    defaultTextVaultObjectId,
  });
  const extractionRun = parseRecord({
    ...baseRecordEnvelope('extraction_run', extractionRunId, input.context),
    extractionRunId,
    documentId: input.documentId,
    inputDocumentVersionId: input.inputDocumentVersionId,
    inputVaultObjectId: input.inputVaultObjectId,
    extractionMode: input.extractionMode,
    engine: input.engine,
    engineVersion: input.engineVersion,
    parameters: input.parameters,
    providerDecision,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    confidenceSummary: input.confidenceSummary ?? {},
    outputVaultObjectIds,
    errorMessage: input.errorMessage,
  }) as ExtractionRunRecord;

  const citationRecords: BackendSpineCoreRecord[] = [];
  for (const citation of input.citations ?? []) {
    const quotedTextHash = citation.quotedTextHash
      ?? (citation.quotedText ? await sha256HexOfText(citation.quotedText) : undefined);
    const citationRecordId = sourceCitationId({
      context: input.context,
      extractionRunId,
      citationIdSeed: citation.citationIdSeed,
      pageNumber: citation.pageNumber,
    });
    citationRecords.push(parseRecord({
      ...baseRecordEnvelope('source_citation', citationRecordId, input.context),
      documentId: input.documentId,
      documentVersionId: input.inputDocumentVersionId,
      extractionRunId,
      citedRecordId: citation.citedRecordId,
      pageNumber: citation.pageNumber,
      quotedText: citation.quotedText,
      quotedTextHash,
      confidence: citation.confidence,
      createdBy: citation.createdBy ?? 'extraction',
      createdAt: citation.createdAt ?? input.completedAt ?? input.startedAt,
    }));

    citation.anchors.forEach((anchor, index) => {
      assertAnchorSpan(anchor);
      citationRecords.push(parseRecord({
        ...baseRecordEnvelope(
          'citation_anchor',
          citationAnchorId({
            context: input.context,
            sourceCitationId: citationRecordId,
            anchorIndex: index,
          }),
          input.context
        ),
        sourceCitationId: citationRecordId,
        vaultObjectId: anchor.vaultObjectId ?? defaultTextVaultObjectId,
        pageNumber: anchor.pageNumber,
        charStart: anchor.charStart,
        charEnd: anchor.charEnd,
        bbox: anchor.bbox,
        polygon: anchor.polygon,
      }));
    });
  }

  return [extractionRun, ...derivativeRecords, ...citationRecords];
}
