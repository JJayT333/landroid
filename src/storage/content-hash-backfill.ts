import type { DocumentRecord } from '../types/document';
import { sha256HexOfBlob } from './blob-hash';
import db from './db';

type StoredDocumentRecord = DocumentRecord & { dbKey?: string };

interface ContentHashBackfillCollection {
  primaryKeys?: () => Promise<string[]>;
  modify?: (
    callback: (document: StoredDocumentRecord) => void
  ) => Promise<number>;
}

interface ContentHashBackfillWhereClause {
  equals: (value: string) => ContentHashBackfillCollection;
}

export interface ContentHashBackfillDocumentTable {
  get: (docId: string) => Promise<StoredDocumentRecord | undefined>;
  where: (indexName: string) => ContentHashBackfillWhereClause;
}

export interface ContentHashBackfillResult {
  scanned: number;
  updated: number;
}

export async function backfillBlankDocumentContentHashesWithDeps({
  documents,
  hashBlob = sha256HexOfBlob,
}: {
  documents: ContentHashBackfillDocumentTable;
  hashBlob?: (blob: Blob) => Promise<string>;
}): Promise<ContentHashBackfillResult> {
  const blankHashCollection = documents.where('contentHash').equals('');
  const primaryKeys = await blankHashCollection.primaryKeys?.();
  if (!primaryKeys || primaryKeys.length === 0) {
    return { scanned: 0, updated: 0 };
  }

  let updated = 0;
  for (const primaryKey of primaryKeys) {
    const document = await documents.get(primaryKey);
    if (!document || document.contentHash !== '') continue;

    const contentHash = await hashBlob(document.blob);
    const modified = await documents
      .where('docId')
      .equals(document.docId)
      .modify?.((current) => {
        if (current.contentHash === '') {
          current.contentHash = contentHash;
        }
      });
    updated += modified ?? 0;
  }

  return { scanned: primaryKeys.length, updated };
}

export async function backfillBlankDocumentContentHashes(): Promise<ContentHashBackfillResult> {
  return backfillBlankDocumentContentHashesWithDeps({
    documents: db.documents,
  });
}
