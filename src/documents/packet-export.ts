/**
 * Wire the (previously dormant) attorney-packet ZIP into the Documents view.
 *
 * Chain: assemble the live workspace + scoped document data + curative issues →
 * `buildProjectRecordsWithEvidenceVault` (produces the document / version /
 * vault-object / link / curative records) → `buildAttorneyPacketExport`
 * (deterministic, hash-checksummed manifest + sidecars) → `buildAttorneyPacketArchive`
 * (the store-only ZIP, every file SHA-256-verified before packing).
 *
 * v1 scope is the document vault + unresolved curative issues — owner/lease/map/
 * research document attachments wait on the deferred `.landroid` export-scope
 * decision (LLA-M04), so those data slices are intentionally not gathered here.
 */
import { readCurrentWorkspaceData } from '../store/workspace-store';
import {
  exportDocumentWorkspaceData,
  type DocumentWorkspaceData,
  type WorkspaceData,
} from '../storage/workspace-persistence';
import {
  loadCurativeWorkspaceData,
  type CurativeWorkspaceData,
} from '../storage/curative-persistence';
import { getDocBlob } from '../storage/document-store';
import { LANDROID_FILE_VERSION } from '../storage/landroid-file-version';
import {
  buildAttorneyPacketExport,
  buildProjectRecordsWithEvidenceVault,
} from '../project-records/evidence-vault';
import {
  buildAttorneyPacketArchive,
  type BatesPacketOptions,
  type NativeBytesLoader,
  type PacketArchiveResult,
} from '../project-records/packet-archive';

/** Default loader: pull each packet item's native bytes from the doc blob store. */
const loadDocumentNativeBytes: NativeBytesLoader = async (item) => {
  const blob = await getDocBlob(item.documentId);
  if (!blob) {
    throw new Error(
      `Document blob not found for "${item.nativeFileName}" (id ${item.documentId}). `
        + 'The packet was not written.'
    );
  }
  return blob;
};

export interface PacketArchiveDataInput {
  workspace: WorkspaceData;
  documentData: DocumentWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  title: string;
  generatedAt: string;
  packetId?: string;
  /** When set, also emit a Bates-numbered production set under `production/`. */
  bates?: BatesPacketOptions;
  /** Injectable for tests; defaults to the doc blob store. */
  loadNativeBytes?: NativeBytesLoader;
}

/** Pure-ish: data in → packet ZIP out (the projection + archive chain). */
export async function buildPacketArchiveFromData(
  input: PacketArchiveDataInput
): Promise<PacketArchiveResult> {
  const bundle = await buildProjectRecordsWithEvidenceVault({
    workspace: input.workspace,
    documentData: input.documentData,
    curativeData: input.curativeData,
    generatedAt: input.generatedAt,
    landroidFileVersion: LANDROID_FILE_VERSION,
  });
  const packetExport = await buildAttorneyPacketExport({
    records: bundle.records,
    packetId: input.packetId ?? 'attorney',
    title: input.title,
    generatedAt: input.generatedAt,
  });
  return buildAttorneyPacketArchive({
    packetExport,
    loadNativeBytes: input.loadNativeBytes ?? loadDocumentNativeBytes,
    bates: input.bates,
  });
}

/** Build the packet ZIP for the current workspace, scoped to `packetDocIds`. */
export async function buildWorkspacePacketArchive(input: {
  packetDocIds: ReadonlySet<string>;
  title: string;
  bates?: BatesPacketOptions;
}): Promise<PacketArchiveResult> {
  const workspace = readCurrentWorkspaceData();
  const [documentData, curativeData] = await Promise.all([
    exportDocumentWorkspaceData(workspace.workspaceId),
    loadCurativeWorkspaceData(workspace.workspaceId),
  ]);
  const scoped: DocumentWorkspaceData = {
    documents: documentData.documents.filter((doc) => input.packetDocIds.has(doc.docId)),
    attachments: documentData.attachments.filter((att) => input.packetDocIds.has(att.docId)),
  };
  return buildPacketArchiveFromData({
    workspace,
    documentData: scoped,
    curativeData,
    title: input.title,
    generatedAt: new Date().toISOString(),
    bates: input.bates,
  });
}

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '-') || 'workspace';
}

/** Build the packet ZIP and trigger a browser download. */
export async function downloadWorkspacePacket(input: {
  packetDocIds: ReadonlySet<string>;
  projectName: string;
  bates?: BatesPacketOptions;
}): Promise<PacketArchiveResult> {
  const result = await buildWorkspacePacketArchive({
    packetDocIds: input.packetDocIds,
    title: `${input.projectName || 'LANDroid'} — Attorney Packet`,
    bates: input.bates,
  });
  const blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileNamePart(input.projectName)}-attorney-packet.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
  return result;
}
