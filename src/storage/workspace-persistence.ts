/**
 * Workspace persistence — auto-save to IndexedDB, export/import .landroid files.
 */
import db from './db';
import { deserializeBlob, serializeBlob, type SerializedBlob } from './blob-serialization';
import { createWorkspaceId } from '../utils/workspace-id';
import {
  normalizeOwnershipNode,
  type OwnershipNode,
  type DeskMap,
} from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';
import type { OwnerDoc } from '../types/owner';
import type { MapAsset, MapExternalReference, MapRegion } from '../types/map';
import type { ResearchImport } from '../types/research';
import type { OwnerWorkspaceData } from './owner-persistence';
import type { MapWorkspaceData } from './map-persistence';
import type { ResearchWorkspaceData } from './research-persistence';

const WORKSPACE_ID = 'default';

export interface WorkspaceData {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
}

export interface LandroidFileData extends WorkspaceData {
  canvas?: CanvasSaveData | null;
  ownerData?: OwnerWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
}

interface SerializedOwnerDoc extends Omit<OwnerDoc, 'blob'> {
  blob: SerializedBlob;
}

interface SerializedMapAsset extends Omit<MapAsset, 'blob'> {
  blob: SerializedBlob;
}

interface SerializedMapRegion extends MapRegion {}

interface SerializedMapExternalReference extends MapExternalReference {}

interface SerializedResearchImport extends Omit<ResearchImport, 'blob'> {
  blob: SerializedBlob;
}

// ── Auto-save to IndexedDB ─────────────────────────────

export async function saveWorkspaceToDb(data: WorkspaceData): Promise<void> {
  await db.workspaces.put({
    id: WORKSPACE_ID,
    projectName: data.projectName,
    data: JSON.stringify(data),
    savedAt: new Date().toISOString(),
  });
}

export async function loadWorkspaceFromDb(): Promise<WorkspaceData | null> {
  const record = await db.workspaces.get(WORKSPACE_ID);
  if (!record) return null;
  try {
    const parsed = JSON.parse(record.data) as Partial<WorkspaceData>;
    return {
      workspaceId: parsed.workspaceId ?? createWorkspaceId(),
      projectName: parsed.projectName ?? 'Untitled Workspace',
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.map((node) => normalizeOwnershipNode(node))
        : [],
      deskMaps: Array.isArray(parsed.deskMaps) ? parsed.deskMaps : [],
      activeDeskMapId: parsed.activeDeskMapId ?? null,
      instrumentTypes: Array.isArray(parsed.instrumentTypes)
        ? parsed.instrumentTypes
        : [],
    };
  } catch {
    return null;
  }
}

// ── Export .landroid file ───────────────────────────────

async function serializeOwnerData(
  ownerData: OwnerWorkspaceData | undefined
): Promise<
  | undefined
  | {
      owners: OwnerWorkspaceData['owners'];
      leases: OwnerWorkspaceData['leases'];
      contacts: OwnerWorkspaceData['contacts'];
      docs: SerializedOwnerDoc[];
    }
> {
  if (!ownerData) return undefined;

  return {
    owners: ownerData.owners,
    leases: ownerData.leases,
    contacts: ownerData.contacts,
    docs: await Promise.all(
      ownerData.docs.map(async (doc) => ({
        ...doc,
        blob: await serializeBlob(doc.blob),
      }))
    ),
  };
}

async function serializeMapData(
  mapData: MapWorkspaceData | undefined
): Promise<
  | undefined
  | {
      mapAssets: SerializedMapAsset[];
      mapRegions: SerializedMapRegion[];
      mapReferences: SerializedMapExternalReference[];
    }
> {
  if (!mapData) return undefined;

  return {
    mapAssets: await Promise.all(
      mapData.mapAssets.map(async (asset) => ({
        ...asset,
        blob: await serializeBlob(asset.blob),
      }))
    ),
    mapRegions: mapData.mapRegions,
    mapReferences: mapData.mapReferences,
  };
}

async function serializeResearchData(
  researchData: ResearchWorkspaceData | undefined
): Promise<
  | undefined
  | {
      imports: SerializedResearchImport[];
    }
> {
  if (!researchData) return undefined;

  return {
    imports: await Promise.all(
      researchData.imports.map(async (researchImport) => ({
        ...researchImport,
        blob: await serializeBlob(researchImport.blob),
      }))
    ),
  };
}

export async function exportLandroidFile(data: LandroidFileData): Promise<Blob> {
  const payload = {
    version: 4,
    exportedAt: new Date().toISOString(),
    ...data,
    ownerData: await serializeOwnerData(data.ownerData),
    mapData: await serializeMapData(data.mapData),
    researchData: await serializeResearchData(data.researchData),
  };
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export async function downloadLandroidFile(data: LandroidFileData) {
  const blob = await exportLandroidFile(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.projectName || 'workspace'}.landroid`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import .landroid file ──────────────────────────────

export async function importLandroidFile(file: File): Promise<LandroidFileData> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Invalid .landroid file: missing nodes array');
  }

  const workspaceId = parsed.workspaceId || createWorkspaceId();
  const ownerData =
    parsed.ownerData && typeof parsed.ownerData === 'object'
      ? {
          owners: Array.isArray(parsed.ownerData.owners) ? parsed.ownerData.owners : [],
          leases: Array.isArray(parsed.ownerData.leases) ? parsed.ownerData.leases : [],
          contacts: Array.isArray(parsed.ownerData.contacts) ? parsed.ownerData.contacts : [],
          docs: Array.isArray(parsed.ownerData.docs)
            ? parsed.ownerData.docs.map((doc: SerializedOwnerDoc) => ({
                ...doc,
                workspaceId: doc.workspaceId ?? workspaceId,
                blob: deserializeBlob(doc.blob),
              }))
            : [],
        }
      : { owners: [], leases: [], contacts: [], docs: [] };

  const mapData =
    parsed.mapData && typeof parsed.mapData === 'object'
      ? {
          mapAssets: Array.isArray(parsed.mapData.mapAssets)
            ? parsed.mapData.mapAssets.map((asset: SerializedMapAsset) => ({
                ...asset,
                workspaceId: asset.workspaceId ?? workspaceId,
                blob: deserializeBlob(asset.blob),
              }))
            : [],
          mapRegions: Array.isArray(parsed.mapData.mapRegions)
            ? parsed.mapData.mapRegions.map(
                (region: SerializedMapRegion) => ({
                  ...region,
                  workspaceId: region.workspaceId ?? workspaceId,
                })
              )
            : [],
          mapReferences: Array.isArray(parsed.mapData.mapReferences)
            ? parsed.mapData.mapReferences.map(
                (reference: SerializedMapExternalReference) => ({
                  ...reference,
                  workspaceId: reference.workspaceId ?? workspaceId,
                })
              )
            : [],
        }
      : { mapAssets: [], mapRegions: [], mapReferences: [] };

  const researchData =
    parsed.researchData && typeof parsed.researchData === 'object'
      ? {
          imports: Array.isArray(parsed.researchData.imports)
            ? parsed.researchData.imports.map(
                (researchImport: SerializedResearchImport) => ({
                  ...researchImport,
                  workspaceId: researchImport.workspaceId ?? workspaceId,
                  blob: deserializeBlob(researchImport.blob),
                })
              )
            : [],
        }
      : { imports: [] };

  return {
    workspaceId,
    projectName: parsed.projectName || 'Imported Workspace',
    nodes: parsed.nodes.map((node: OwnershipNode) => normalizeOwnershipNode(node)),
    deskMaps: parsed.deskMaps || [],
    activeDeskMapId: parsed.activeDeskMapId || null,
    instrumentTypes: parsed.instrumentTypes || [],
    canvas: parsed.canvas ?? null,
    ownerData,
    mapData,
    researchData,
  };
}
