/**
 * Canvas persistence — save/load canvas state to IndexedDB.
 *
 * Uses the same debounced auto-save pattern as workspace-persistence.
 */
import db from './db';
import type { CanvasSaveData } from '../store/canvas-store';

const CANVAS_ID = 'active-canvas';

export async function saveCanvasToDb(data: CanvasSaveData): Promise<void> {
  await db.canvases.put({
    id: CANVAS_ID,
    data: JSON.stringify(data),
    savedAt: new Date().toISOString(),
  });
}

export async function loadCanvasFromDb(): Promise<CanvasSaveData | null> {
  try {
    const record = await db.canvases.get(CANVAS_ID);
    if (!record) return null;
    return JSON.parse(record.data);
  } catch {
    return null;
  }
}
