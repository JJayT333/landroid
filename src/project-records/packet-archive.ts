/**
 * Phase 2 — native attorney-packet packaging.
 *
 * Turns the deterministic packet *projection* from `evidence-vault.ts`
 * (`AttorneyPacketExport`) into a real, downloadable archive: the native
 * original files (unaltered), the deterministic manifest JSON, a checksum file,
 * and the source-citation / unresolved-issue / optional eDiscovery sidecars.
 *
 * Design constraints:
 * - Additive and local-only. This module consumes an existing projection and
 *   produces bytes; it never mutates documents, vault objects, or live stores,
 *   and it makes no network calls.
 * - Dependency-free, deterministic archive. A minimal store-only (no
 *   compression) ZIP encoder with a fixed entry order and a fixed DOS
 *   timestamp, so the same packet projection always produces byte-identical
 *   output (reproducible packets).
 * - Hash-verified. Every native file is checked against its recorded SHA-256
 *   `contentHash` while packing; a mismatch throws rather than emitting a
 *   corrupt packet.
 */
import { sha256HexOfBytes } from '../storage/blob-hash';
import { hasPdfMagicBytes } from '../utils/pdf-validation';
import { stampBatesPdf } from '../documents/bates-stamp';
import type {
  AttorneyPacketExport,
  AttorneyPacketManifestItem,
} from './evidence-vault';

export class PacketArchiveHashMismatchError extends Error {
  constructor(
    readonly item: AttorneyPacketManifestItem,
    readonly actualHash: string
  ) {
    super(
      `Packet file "${item.nativeFileName}" (document ${item.documentRecordId}) failed SHA-256 ` +
        `verification: expected ${item.contentHash}, got ${actualHash}. Refusing to write a corrupt packet.`
    );
    this.name = 'PacketArchiveHashMismatchError';
  }
}

/** Returns the native bytes for a packet item (e.g. read from the blob store). */
export type NativeBytesLoader = (
  item: AttorneyPacketManifestItem
) => Promise<Uint8Array | ArrayBuffer | Blob> | Uint8Array | ArrayBuffer | Blob;

/** Bates numbering for a packet production set (see {@link stampBatesPdf}). */
export interface BatesPacketOptions {
  /** Leading label, e.g. "LANDROID". */
  prefix: string;
  /** First number in the running sequence. */
  startNumber: number;
  /** Zero-pad width, e.g. 6 → 000001. */
  padWidth: number;
}

/** One row of the production set's Bates index. */
export interface BatesIndexEntry {
  packetOrder: number;
  documentId: string;
  nativeFileName: string;
  /** Null when the file is not a PDF and was carried through unstamped. */
  firstBates: string | null;
  lastBates: string | null;
  pageCount: number;
}

export interface PacketArchiveResult {
  /** The packaged ZIP archive bytes. */
  bytes: Uint8Array;
  /** Archive entry paths, in packed order. */
  entryPaths: string[];
  /** The packet manifest hash this archive was built from. */
  manifestHash: string;
  /** Total pages Bates-stamped across the production set (0 when not requested). */
  batesPageCount: number;
}

const FILES_DIR = 'files/';
const PRODUCTION_DIR = 'production/';
const textEncoder = new TextEncoder();

async function toBytes(
  value: Uint8Array | ArrayBuffer | Blob
): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(await value.arrayBuffer());
}

function jsonEntry(value: unknown): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Build a downloadable attorney packet archive from a packet projection.
 * Native files are pulled via `loadNativeBytes` and verified against their
 * recorded SHA-256 before packing. `hashBytes` is injectable for tests.
 */
export async function buildAttorneyPacketArchive(input: {
  packetExport: AttorneyPacketExport;
  loadNativeBytes: NativeBytesLoader;
  hashBytes?: (bytes: Uint8Array) => Promise<string>;
  /**
   * When set, also emit a Bates-numbered production set under `production/`.
   * Originals in `files/` are left byte-identical (and hash-verified) — the
   * stamped copies are a derived artifact, so evidence integrity is preserved.
   */
  bates?: BatesPacketOptions;
}): Promise<PacketArchiveResult> {
  const { packetExport } = input;
  const hashBytes = input.hashBytes ?? sha256HexOfBytes;

  // Verify + collect native files in deterministic manifest order first, so a
  // hash mismatch aborts before any archive bytes are produced. When a Bates
  // production set is requested, stamp each verified file in the same pass so
  // the numbering runs continuously across the set.
  const fileEntries: Array<{ path: string; data: Uint8Array }> = [];
  const productionEntries: Array<{ path: string; data: Uint8Array }> = [];
  const batesIndex: BatesIndexEntry[] = [];
  let batesCounter = input.bates?.startNumber ?? 1;
  let batesPageCount = 0;

  for (const item of packetExport.manifest.items) {
    const bytes = await toBytes(await input.loadNativeBytes(item));
    const actualHash = await hashBytes(bytes);
    if (actualHash !== item.contentHash) {
      throw new PacketArchiveHashMismatchError(item, actualHash);
    }
    fileEntries.push({ path: `${FILES_DIR}${item.nativeFileName}`, data: bytes });

    if (input.bates) {
      if (hasPdfMagicBytes(bytes)) {
        const stamp = await stampBatesPdf(bytes, {
          prefix: input.bates.prefix,
          startNumber: batesCounter,
          padWidth: input.bates.padWidth,
        });
        productionEntries.push({
          path: `${PRODUCTION_DIR}${item.nativeFileName}`,
          data: stamp.bytes,
        });
        batesIndex.push({
          packetOrder: item.packetOrder,
          documentId: item.documentId,
          nativeFileName: item.nativeFileName,
          firstBates: stamp.firstLabel,
          lastBates: stamp.lastLabel,
          pageCount: stamp.pageCount,
        });
        batesCounter = stamp.nextNumber;
        batesPageCount += stamp.pageCount;
      } else {
        // Not a PDF (no such documents today): carry the original through so
        // the production set is still complete, recorded with no Bates range.
        productionEntries.push({
          path: `${PRODUCTION_DIR}${item.nativeFileName}`,
          data: bytes,
        });
        batesIndex.push({
          packetOrder: item.packetOrder,
          documentId: item.documentId,
          nativeFileName: item.nativeFileName,
          firstBates: null,
          lastBates: null,
          pageCount: 0,
        });
      }
    }
  }

  const checksumLines = [
    `${packetExport.manifestHash}  manifest.json`,
    ...packetExport.manifest.items.map(
      (item) => `${item.contentHash}  ${FILES_DIR}${item.nativeFileName}`
    ),
  ];

  // Fixed entry order => reproducible archive.
  const entries: Array<{ path: string; data: Uint8Array }> = [
    { path: 'manifest.json', data: textEncoder.encode(packetExport.manifestJson) },
    { path: 'checksums.sha256', data: textEncoder.encode(`${checksumLines.join('\n')}\n`) },
    ...fileEntries,
    {
      path: 'sidecars/source-citations.json',
      data: jsonEntry(packetExport.sourceCitationSidecars),
    },
    {
      path: 'sidecars/unresolved-issues.json',
      data: jsonEntry(packetExport.manifest.unresolvedIssues),
    },
  ];
  if (packetExport.eDiscoverySidecars.length > 0) {
    entries.push({
      path: 'sidecars/ediscovery-loadfile.json',
      data: jsonEntry(packetExport.eDiscoverySidecars),
    });
  }
  if (input.bates && productionEntries.length > 0) {
    entries.push(...productionEntries);
    entries.push({
      path: `${PRODUCTION_DIR}bates-index.json`,
      data: jsonEntry({
        prefix: input.bates.prefix,
        startNumber: input.bates.startNumber,
        padWidth: input.bates.padWidth,
        totalPages: batesPageCount,
        items: batesIndex,
      }),
    });
  }

  return {
    bytes: encodeStoredZip(entries),
    entryPaths: entries.map((entry) => entry.path),
    manifestHash: packetExport.manifestHash,
    batesPageCount,
  };
}

// ── minimal, deterministic store-only ZIP ────────────────────────────────────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (~crc) >>> 0;
}

// 1980-01-01 00:00:00 in DOS date/time — a fixed timestamp keeps archives
// byte-reproducible regardless of when they are generated.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;
const UTF8_FLAG = 0x0800;

/**
 * Encode entries as a store-only (uncompressed) ZIP. Deterministic for a given
 * ordered set of entries: every header field is fixed except name/size/crc,
 * which derive from the data.
 */
export function encodeStoredZip(
  entries: Array<{ path: string; data: Uint8Array }>
): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.path);
    const size = entry.data.length;
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, UTF8_FLAG, true); // general purpose flags
    lv.setUint16(8, 0, true); // method: store
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size (= size, stored)
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    locals.push(local, entry.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory header signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk with central dir
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true); // central dir offset
  ev.setUint16(20, 0, true); // comment length

  const chunks = [...locals, ...centrals, eocd];
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of chunks) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/**
 * Read a store-only ZIP produced by {@link encodeStoredZip} back into a
 * path -> bytes map. Supports verifying/round-tripping a packed archive.
 */
export function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, Uint8Array>();
  let cursor = 0;
  while (cursor + 4 <= bytes.length && view.getUint32(cursor, true) === 0x04034b50) {
    const method = view.getUint16(cursor + 8, true);
    if (method !== 0) {
      throw new Error('readStoredZip only supports stored (uncompressed) entries');
    }
    const compSize = view.getUint32(cursor + 18, true);
    const nameLength = view.getUint16(cursor + 26, true);
    const extraLength = view.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    out.set(name, bytes.slice(dataStart, dataStart + compSize));
    cursor = dataStart + compSize;
  }
  return out;
}
