/**
 * Canvas persistence — save/load canvas state to IndexedDB.
 *
 * Uses the same debounced auto-save pattern as workspace-persistence.
 */
import db from './db';
import type { CanvasSaveData } from '../store/canvas-store';
import { normalizeCanvasSaveData } from './workspace-persistence';

const CANVAS_ID = 'active-canvas';

export interface CanvasLoadResult {
  status: 'missing' | 'loaded' | 'corrupt';
  data: CanvasSaveData | null;
  error: string | null;
}

export function parsePersistedCanvasData(raw: string): CanvasSaveData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('saved flowchart canvas is not valid JSON');
  }

  const normalized = normalizeCanvasSaveData(parsed);
  if (!normalized) {
    throw new Error('saved flowchart canvas payload must be an object');
  }

  return normalized;
}

export async function saveCanvasToDb(data: CanvasSaveData): Promise<void> {
  await db.canvases.put({
    id: CANVAS_ID,
    data: JSON.stringify(data),
    savedAt: new Date().toISOString(),
  });
}

export async function loadCanvasFromDb(): Promise<CanvasLoadResult> {
  const record = await db.canvases.get(CANVAS_ID);
  if (!record) {
    return {
      status: 'missing',
      data: null,
      error: null,
    };
  }

  try {
    return {
      status: 'loaded',
      data: parsePersistedCanvasData(record.data),
      error: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown corruption';
    return {
      status: 'corrupt',
      data: null,
      error: `Saved flowchart canvas could not be restored because ${reason}. The canvas was reset.`,
    };
  }
}
