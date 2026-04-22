/**
 * Single-level undo for AI-driven mutations.
 *
 * `runChat.ts` snapshots every store an AI mutating tool could touch before a
 * turn runs, and keeps the snapshot only if the turn actually called a
 * mutating tool. The AIPanel shows an "Undo last AI change" button that
 * restores every store — memory AND IndexedDB — from that snapshot.
 *
 * Why all four stores: `removeNode` cascades into curative (title-issue
 * links), map (asset/region links), and owner (via `clearLinkedLease`).
 * `attach_lease` edits workspace nodes but also depends on the owner store's
 * lease record. Restoring only workspace would leave orphan links behind.
 */
import { create } from 'zustand';
import { useWorkspaceStore } from '../store/workspace-store';
import { useOwnerStore } from '../store/owner-store';
import { useCurativeStore } from '../store/curative-store';
import { useMapStore } from '../store/map-store';
import type { OwnershipNode, DeskMap } from '../types/node';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type { CurativeWorkspaceData } from '../storage/curative-persistence';
import type { MapWorkspaceData } from '../storage/map-persistence';
import {
  exportPdfWorkspaceData,
  replacePdfWorkspaceData,
  type PdfWorkspaceData,
} from '../storage/workspace-persistence';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
  LeaseholdUnit,
} from '../types/leasehold';

interface WorkspaceSnapshot {
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit: LeaseholdUnit;
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  leaseholdTransferOrderEntries: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  activeUnitCode: string | null;
  activeNodeId: string | null;
}

export interface UndoSnapshot {
  capturedAt: number;
  workspaceId: string;
  workspace: WorkspaceSnapshot;
  owner: OwnerWorkspaceData;
  curative: CurativeWorkspaceData;
  map: MapWorkspaceData;
  pdf: PdfWorkspaceData;
  /** Short human-readable summary of what the AI did (for button tooltip). */
  label: string;
}

interface UndoState {
  snapshot: UndoSnapshot | null;
  setSnapshot: (snapshot: UndoSnapshot | null) => void;
  clear: () => void;
}

export const useAIUndoStore = create<UndoState>()((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clear: () => set({ snapshot: null }),
}));

/**
 * Snapshot every store an AI mutator can touch. Deep-cloned via structured
 * cloning so later in-place mutations can't bleed back into the snapshot.
 */
export async function captureSnapshot(label: string): Promise<UndoSnapshot | null> {
  const ws = useWorkspaceStore.getState();
  if (!ws.workspaceId) return null;

  const ownerData = await useOwnerStore.getState().exportWorkspaceData();
  const curativeData = await useCurativeStore.getState().exportWorkspaceData();
  const mapData = await useMapStore.getState().exportWorkspaceData();
  const pdfData = await exportPdfWorkspaceData(ws.nodes);

  return {
    capturedAt: Date.now(),
    workspaceId: ws.workspaceId,
    label,
    workspace: deepClone({
      projectName: ws.projectName,
      nodes: ws.nodes,
      deskMaps: ws.deskMaps,
      leaseholdUnit: ws.leaseholdUnit,
      leaseholdAssignments: ws.leaseholdAssignments,
      leaseholdOrris: ws.leaseholdOrris,
      leaseholdTransferOrderEntries: ws.leaseholdTransferOrderEntries,
      activeDeskMapId: ws.activeDeskMapId,
      activeUnitCode: ws.activeUnitCode,
      activeNodeId: ws.activeNodeId,
    }),
    owner: deepClone(ownerData),
    curative: deepClone(curativeData),
    map: deepClone(mapData),
    pdf: pdfData,
  };
}

/**
 * Restore every store from a snapshot. Peripheral stores go through their
 * `replaceWorkspaceData` actions so IndexedDB matches memory.
 */
export async function restoreSnapshot(snapshot: UndoSnapshot): Promise<void> {
  useWorkspaceStore.getState().loadWorkspace({
    workspaceId: snapshot.workspaceId,
    projectName: snapshot.workspace.projectName,
    nodes: snapshot.workspace.nodes,
    deskMaps: snapshot.workspace.deskMaps,
    leaseholdUnit: snapshot.workspace.leaseholdUnit,
    leaseholdAssignments: snapshot.workspace.leaseholdAssignments,
    leaseholdOrris: snapshot.workspace.leaseholdOrris,
    leaseholdTransferOrderEntries:
      snapshot.workspace.leaseholdTransferOrderEntries,
    activeDeskMapId: snapshot.workspace.activeDeskMapId,
    activeUnitCode: snapshot.workspace.activeUnitCode,
  });

  await useOwnerStore
    .getState()
    .replaceWorkspaceData(snapshot.workspaceId, snapshot.owner);
  await replacePdfWorkspaceData(snapshot.pdf, snapshot.workspace.nodes);
  await useCurativeStore
    .getState()
    .replaceWorkspaceData(snapshot.workspaceId, snapshot.curative);
  await useMapStore
    .getState()
    .replaceWorkspaceData(snapshot.workspaceId, snapshot.map);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON clone for anything structuredClone rejects
      // (Blobs etc — owner docs). JSON clone drops Blob data; that's
      // acceptable for undo since we never mutate Blob contents.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
