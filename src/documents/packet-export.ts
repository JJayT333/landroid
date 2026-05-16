import {
  buildPacketManifest,
  type DocumentRegistryRow,
} from './document-registry';

export type PacketManifestEntry = ReturnType<typeof buildPacketManifest>[number];

export interface PacketPackageManifestEntry extends PacketManifestEntry {
  nativeFilePath: string;
  nativeFileIncluded: boolean;
}

export interface PacketPackageManifest {
  exportedAt: string;
  projectName: string;
  documentCount: number;
  documents: PacketPackageManifestEntry[];
}

export interface BuildPacketZipOptions {
  projectName?: string;
  exportedAt?: string;
}

export type PacketBlobLoader = (docId: string) => Promise<Blob | undefined>;

interface ZipFileEntry {
  path: string;
  bytes: Uint8Array;
}

interface PreparedZipFileEntry extends ZipFileEntry {
  crc32: number;
  nameBytes: Uint8Array;
  localHeaderOffset: number;
}

const encoder = new TextEncoder();
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

let crcTable: Uint32Array | null = null;

export function packetZipFileName(
  projectName = 'workspace',
  date = new Date()
): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = sanitizeSlug(projectName || 'workspace');
  return `landroid-document-packet-${slug}-${stamp}.zip`;
}

export function buildPacketPackageManifest(
  rows: DocumentRegistryRow[]
): PacketPackageManifestEntry[] {
  const manifest = buildPacketManifest(rows);
  return manifest.map((entry, index) => ({
    ...entry,
    nativeFilePath: `documents/${String(index + 1).padStart(3, '0')}-${sanitizeDocumentFileName(
      rows[index]?.document.fileName || rows[index]?.displayTitle || entry.docId
    )}`,
    nativeFileIncluded: true,
  }));
}

export function buildPacketManifestCsv(
  entries: PacketPackageManifestEntry[]
): string {
  const headers = [
    'packetOrder',
    'nativeFilePath',
    'docId',
    'fileName',
    'displayTitle',
    'area',
    'kind',
    'byteLength',
    'contentHash',
    'instrumentType',
    'county',
    'state',
    'instrumentNumber',
    'volume',
    'page',
    'instrumentDate',
    'recordingDate',
    'grantor',
    'grantee',
    'lessor',
    'lessee',
    'partyNotes',
    'notes',
    'sourceRef',
    'externalRefs',
    'linkedEntities',
    'missingMetadata',
    'duplicateDocIds',
    'needsOcr',
    'nativeFileIncluded',
  ] as const;
  const rows = entries.map((entry) => [
    entry.packetOrder,
    entry.nativeFilePath,
    entry.docId,
    entry.fileName,
    entry.displayTitle,
    entry.area,
    entry.kind,
    entry.byteLength,
    entry.contentHash,
    entry.instrumentType,
    entry.county,
    entry.state,
    entry.instrumentNumber,
    entry.volume,
    entry.page,
    entry.instrumentDate,
    entry.recordingDate,
    entry.parties.grantor,
    entry.parties.grantee,
    entry.parties.lessor,
    entry.parties.lessee,
    entry.parties.notes,
    entry.notes,
    entry.sourceRef,
    JSON.stringify(entry.externalRefs),
    JSON.stringify(entry.linkedEntities),
    entry.missingMetadata.join('; '),
    entry.duplicateDocIds.join('; '),
    entry.needsOcr,
    entry.nativeFileIncluded,
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
}

export async function buildPacketZip(
  rows: DocumentRegistryRow[],
  loadBlob: PacketBlobLoader,
  options: BuildPacketZipOptions = {}
): Promise<Blob> {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const documents = buildPacketPackageManifest(rows);
  const manifest: PacketPackageManifest = {
    exportedAt,
    projectName: options.projectName?.trim() || 'Untitled Workspace',
    documentCount: documents.length,
    documents,
  };
  const blobResults = await Promise.all(
    rows.map((row) => loadBlob(row.document.docId))
  );
  const missingDocIds = rows
    .filter((_, index) => !blobResults[index])
    .map((row) => row.document.docId);
  if (missingDocIds.length > 0) {
    throw new Error(
      `Packet ZIP export failed: missing stored document file for ${missingDocIds.join(', ')}.`
    );
  }

  const nativeFiles = await Promise.all(
    documents.map(async (entry, index) => ({
      path: entry.nativeFilePath,
      bytes: new Uint8Array((await blobResults[index]!.arrayBuffer())),
    }))
  );

  return createZipBlob([
    {
      path: 'manifest.json',
      bytes: encoder.encode(JSON.stringify(manifest, null, 2)),
    },
    {
      path: 'manifest.csv',
      bytes: encoder.encode(buildPacketManifestCsv(documents)),
    },
    ...nativeFiles,
  ]);
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function sanitizeSlug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'workspace';
}

function sanitizeDocumentFileName(value: string): string {
  const leaf = value.split(/[\\/]/).filter(Boolean).pop() ?? value;
  const cleaned = leaf
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'document';
  return cleaned;
}

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function createZipBlob(files: ZipFileEntry[]): Blob {
  if (files.length > MAX_UINT16) {
    throw new Error('Packet ZIP export failed: too many files.');
  }

  const fileDate = dosDateTime();
  const chunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;
  const prepared = files.map((file) => {
    if (file.bytes.byteLength > MAX_UINT32) {
      throw new Error(`Packet ZIP export failed: ${file.path} is too large.`);
    }
    const nameBytes = encoder.encode(file.path);
    if (nameBytes.byteLength > MAX_UINT16) {
      throw new Error(`Packet ZIP export failed: ${file.path} name is too long.`);
    }
    const entry: PreparedZipFileEntry = {
      ...file,
      crc32: crc32(file.bytes),
      nameBytes,
      localHeaderOffset: offset,
    };
    const localHeader = buildLocalHeader(entry, fileDate);
    chunks.push(localHeader, file.bytes);
    offset += localHeader.byteLength + file.bytes.byteLength;
    if (offset > MAX_UINT32) {
      throw new Error('Packet ZIP export failed: package is too large.');
    }
    return entry;
  });

  const centralDirectoryOffset = offset;
  for (const entry of prepared) {
    const centralDirectory = buildCentralDirectoryHeader(entry, fileDate);
    centralDirectoryChunks.push(centralDirectory);
    offset += centralDirectory.byteLength;
  }
  const centralDirectorySize = offset - centralDirectoryOffset;
  if (centralDirectorySize > MAX_UINT32 || offset > MAX_UINT32) {
    throw new Error('Packet ZIP export failed: package is too large.');
  }

  const zipBuffer = concatenateBytes([
    ...chunks,
    ...centralDirectoryChunks,
    buildEndOfCentralDirectory(
      prepared.length,
      centralDirectorySize,
      centralDirectoryOffset
    ),
  ]);
  return new Blob([zipBuffer], { type: 'application/zip' });
}

function concatenateBytes(chunks: Uint8Array[]): ArrayBuffer {
  const totalBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const out = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

function buildLocalHeader(
  entry: PreparedZipFileEntry,
  fileDate: { date: number; time: number }
): Uint8Array {
  const header = new Uint8Array(30 + entry.nameBytes.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, ZIP_UTF8_FLAG, true);
  view.setUint16(8, ZIP_STORE_METHOD, true);
  view.setUint16(10, fileDate.time, true);
  view.setUint16(12, fileDate.date, true);
  view.setUint32(14, entry.crc32, true);
  view.setUint32(18, entry.bytes.byteLength, true);
  view.setUint32(22, entry.bytes.byteLength, true);
  view.setUint16(26, entry.nameBytes.byteLength, true);
  view.setUint16(28, 0, true);
  header.set(entry.nameBytes, 30);
  return header;
}

function buildCentralDirectoryHeader(
  entry: PreparedZipFileEntry,
  fileDate: { date: number; time: number }
): Uint8Array {
  const header = new Uint8Array(46 + entry.nameBytes.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, ZIP_UTF8_FLAG, true);
  view.setUint16(10, ZIP_STORE_METHOD, true);
  view.setUint16(12, fileDate.time, true);
  view.setUint16(14, fileDate.date, true);
  view.setUint32(16, entry.crc32, true);
  view.setUint32(20, entry.bytes.byteLength, true);
  view.setUint32(24, entry.bytes.byteLength, true);
  view.setUint16(28, entry.nameBytes.byteLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, entry.localHeaderOffset, true);
  header.set(entry.nameBytes, 46);
  return header;
}

function buildEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return header;
}
