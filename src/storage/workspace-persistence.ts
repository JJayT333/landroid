/**
 * Workspace persistence — auto-save to IndexedDB, export/import .landroid files.
 */
import db from './db';
import type { OwnershipNode, DeskMap } from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';

const WORKSPACE_ID = 'default';

export interface WorkspaceData {
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];
}

export interface LandroidFileData extends WorkspaceData {
  canvas?: CanvasSaveData | null;
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
    return JSON.parse(record.data) as WorkspaceData;
  } catch {
    return null;
  }
}

// ── Export .landroid file ───────────────────────────────

export function exportLandroidFile(data: LandroidFileData): Blob {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export function downloadLandroidFile(data: LandroidFileData) {
  const blob = exportLandroidFile(data);
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

  return {
    projectName: parsed.projectName || 'Imported Workspace',
    nodes: parsed.nodes,
    deskMaps: parsed.deskMaps || [],
    activeDeskMapId: parsed.activeDeskMapId || null,
    instrumentTypes: parsed.instrumentTypes || [],
    canvas: parsed.canvas ?? null,
  };
}
