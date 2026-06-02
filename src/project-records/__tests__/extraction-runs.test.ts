import { describe, expect, it } from 'vitest';
import { type ExtractionRunRecord } from '../../backend-spine/contracts';
import { buildRecordValidationRequest } from '../record-validation';
import {
  buildExtractionRunRecords,
  DOCUMENT_TEXT_EXTRACTION_PIPELINES,
} from '../extraction-runs';
import type { RecordBuildContext } from '../record-helpers';

const NOW = '2026-06-01T12:00:00.000Z';
const LATER = '2026-06-01T12:00:03.000Z';
const TEXT_HASH = '1'.repeat(64);
const JSON_HASH = '2'.repeat(64);
const PDF_HASH = '3'.repeat(64);
const HOCR_HASH = '4'.repeat(64);
const IMAGE_HASH = '5'.repeat(64);

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'local',
  syncState: 'local_only',
};

const baseInput = {
  context,
  documentId: 'document-1',
  inputDocumentVersionId: 'document-version-1',
  inputVaultObjectId: 'vault-original-1',
  startedAt: NOW,
};

describe('extraction run project records', () => {
  it('models selectable-PDF text extraction as local derivatives with span anchors', async () => {
    const records = await buildExtractionRunRecords({
      ...baseInput,
      runIdSeed: 'selectable-run',
      extractionMode: 'selectable_pdf_text',
      engine: 'pdftotext',
      engineVersion: '26.04.0',
      parameters: { layout: true },
      status: 'succeeded',
      completedAt: LATER,
      confidenceSummary: { pageCount: 1 },
      outputVaultObjects: [
        {
          objectKind: 'text_file',
          contentHash: TEXT_HASH,
          byteLength: 128,
          storageRef: 'documents/document-1/extractions/selectable-run/text.txt',
        },
        {
          objectKind: 'text_json',
          contentHash: JSON_HASH,
          byteLength: 256,
          storageRef: 'documents/document-1/extractions/selectable-run/text.json',
        },
      ],
      citations: [
        {
          citationIdSeed: 'royalty-clause',
          citedRecordId: 'lease-1',
          pageNumber: 2,
          quotedText: 'The royalty is one-eighth.',
          confidence: 'supported',
          anchors: [
            {
              pageNumber: 2,
              charStart: 120,
              charEnd: 147,
              bbox: [72, 144, 310, 168],
            },
          ],
        },
      ],
    });

    expect(buildRecordValidationRequest(records).records).toHaveLength(records.length);
    const run = records.find(
      (record): record is ExtractionRunRecord => record.recordType === 'extraction_run'
    );
    expect(run).toMatchObject({
      documentId: 'document-1',
      inputDocumentVersionId: 'document-version-1',
      inputVaultObjectId: 'vault-original-1',
      extractionMode: 'selectable_pdf_text',
      engine: 'pdftotext',
      providerDecision: { providerKind: 'local' },
      status: 'succeeded',
    });
    expect(run?.outputVaultObjectIds).toHaveLength(2);
    const derivativeVaultObjects = records.filter(
      (record) => record.recordType === 'vault_object'
    );
    expect(derivativeVaultObjects).toHaveLength(2);
    expect(derivativeVaultObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectKind: 'text_file',
          derivedFromVaultObjectId: 'vault-original-1',
          localOnly: true,
        }),
        expect.objectContaining({
          objectKind: 'text_json',
          derivedFromVaultObjectId: 'vault-original-1',
          localOnly: true,
        }),
      ])
    );
    const citation = records.find((record) => record.recordType === 'source_citation');
    expect(citation).toMatchObject({
      documentId: 'document-1',
      documentVersionId: 'document-version-1',
      extractionRunId: run?.recordId,
      citedRecordId: 'lease-1',
      pageNumber: 2,
      confidence: 'supported',
      createdBy: 'extraction',
      createdAt: LATER,
    });
    expect(citation).toHaveProperty('quotedTextHash', expect.stringMatching(/^[a-f0-9]{64}$/));
    const anchor = records.find((record) => record.recordType === 'citation_anchor');
    expect(anchor).toMatchObject({
      sourceCitationId: citation?.recordId,
      pageNumber: 2,
      charStart: 120,
      charEnd: 147,
      bbox: [72, 144, 310, 168],
      vaultObjectId: derivativeVaultObjects[0].recordId,
    });
  });

  it('keeps scanned-PDF OCR separate from selectable-PDF extraction', async () => {
    expect(DOCUMENT_TEXT_EXTRACTION_PIPELINES.selectable_pdf_text.derivativeObjectKinds)
      .toEqual(['text_file', 'text_json']);
    expect(DOCUMENT_TEXT_EXTRACTION_PIPELINES.scanned_pdf_ocr.derivativeObjectKinds)
      .toEqual(['searchable_pdf', 'hocr_json', 'text_json', 'text_file', 'page_image']);

    const records = await buildExtractionRunRecords({
      ...baseInput,
      runIdSeed: 'ocr-run',
      extractionMode: 'scanned_pdf_ocr',
      engine: 'tesseract',
      engineVersion: '5.5.2',
      parameters: { language: 'eng', pageDpi: 300 },
      status: 'partial',
      completedAt: LATER,
      confidenceSummary: {
        mean: 0.88,
        minimum: 0.71,
        pageCount: 1,
        lowConfidencePageCount: 0,
      },
      outputVaultObjects: [
        {
          objectKind: 'searchable_pdf',
          contentHash: PDF_HASH,
          byteLength: 1024,
          storageRef: 'documents/document-1/extractions/ocr-run/searchable.pdf',
        },
        {
          objectKind: 'hocr_json',
          contentHash: HOCR_HASH,
          byteLength: 512,
          storageRef: 'documents/document-1/extractions/ocr-run/hocr.json',
        },
        {
          objectKind: 'page_image',
          contentHash: IMAGE_HASH,
          byteLength: 2048,
          storageRef: 'documents/document-1/extractions/ocr-run/page-0001.png',
        },
      ],
    });

    expect(records.find((record) => record.recordType === 'extraction_run')).toMatchObject({
      extractionMode: 'scanned_pdf_ocr',
      engine: 'tesseract',
      status: 'partial',
    });
    expect(records.filter((record) => record.recordType === 'vault_object')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectKind: 'searchable_pdf' }),
        expect.objectContaining({ objectKind: 'hocr_json' }),
        expect.objectContaining({ objectKind: 'page_image' }),
      ])
    );
  });

  it('records extraction failure without emitting derivatives or replacing the original', async () => {
    const records = await buildExtractionRunRecords({
      ...baseInput,
      runIdSeed: 'failed-run',
      extractionMode: 'scanned_pdf_ocr',
      engine: 'tesseract',
      engineVersion: '5.5.2',
      parameters: { language: 'eng' },
      status: 'failed',
      completedAt: LATER,
      confidenceSummary: { pageCount: 0 },
      outputVaultObjects: [],
      errorMessage: 'OCR command failed before derivative creation.',
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      recordType: 'extraction_run',
      status: 'failed',
      inputVaultObjectId: 'vault-original-1',
      outputVaultObjectIds: [],
      errorMessage: 'OCR command failed before derivative creation.',
    });

    await expect(buildExtractionRunRecords({
      ...baseInput,
      runIdSeed: 'invalid-failed-run',
      extractionMode: 'scanned_pdf_ocr',
      engine: 'tesseract',
      engineVersion: '5.5.2',
      parameters: {},
      status: 'failed',
      outputVaultObjects: [
        {
          objectKind: 'text_file',
          contentHash: TEXT_HASH,
          byteLength: 12,
          storageRef: 'documents/document-1/extractions/failed/text.txt',
        },
      ],
    })).rejects.toThrow('Failed or canceled extraction runs');
  });

  it('rejects cloud OCR decisions that are not scoped to the input document', async () => {
    await expect(buildExtractionRunRecords({
      ...baseInput,
      runIdSeed: 'cloud-run',
      extractionMode: 'scanned_pdf_ocr',
      engine: 'cloud-ocr',
      engineVersion: 'unimplemented',
      parameters: {},
      providerDecision: {
        providerKind: 'cloud',
        providerName: 'Cloud OCR',
        optInDocumentId: 'other-document',
        approvedAt: NOW,
        approvedBy: 'user',
        dataResidencyWarningAccepted: true,
        retentionPolicyAcknowledged: true,
        retentionPolicyNote: 'Reviewed externally before upload.',
      },
      status: 'queued',
      outputVaultObjects: [],
    })).rejects.toThrow('Cloud OCR requires an explicit provider decision');
  });
});
