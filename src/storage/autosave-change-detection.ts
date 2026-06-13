import type { Edge, Node, Viewport } from '@xyflow/react';
import type { DeskMap, OwnershipNode } from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdTransferOrderEntry,
  LeaseholdUnit,
} from '../types/leasehold';

export interface WorkspaceAutosaveState {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit?: LeaseholdUnit;
  leaseholdAssignments?: LeaseholdAssignment[];
  leaseholdOrris?: LeaseholdOrri[];
  leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  activeUnitCode?: string | null;
  instrumentTypes: string[];
}

export interface CanvasAutosaveState extends CanvasSaveData {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  gridCols: number;
  gridRows: number;
  orientation: NonNullable<CanvasSaveData['orientation']>;
  pageSize: NonNullable<CanvasSaveData['pageSize']>;
  horizontalSpacingFactor: number;
  verticalSpacingFactor: number;
  snapToGrid: boolean;
  gridSize: number;
}

interface WorkspaceAutosaveSnapshot {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit?: LeaseholdUnit;
  leaseholdAssignments?: LeaseholdAssignment[];
  leaseholdOrris?: LeaseholdOrri[];
  leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  activeUnitCode?: string | null;
  instrumentTypes: string[];
}

interface CanvasAutosaveSnapshot {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  gridCols: number;
  gridRows: number;
  orientation: NonNullable<CanvasSaveData['orientation']>;
  pageSize: NonNullable<CanvasSaveData['pageSize']>;
  horizontalSpacingFactor: number;
  verticalSpacingFactor: number;
  snapToGrid: boolean;
  gridSize: number;
}

export function captureWorkspaceAutosaveSnapshot(
  state: WorkspaceAutosaveState
): WorkspaceAutosaveSnapshot {
  return {
    workspaceId: state.workspaceId,
    projectName: state.projectName,
    nodes: state.nodes,
    deskMaps: state.deskMaps,
    leaseholdUnit: state.leaseholdUnit,
    leaseholdAssignments: state.leaseholdAssignments,
    leaseholdOrris: state.leaseholdOrris,
    leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries,
    activeDeskMapId: state.activeDeskMapId,
    activeUnitCode: state.activeUnitCode,
    instrumentTypes: state.instrumentTypes,
  };
}

export function workspaceAutosaveStateChanged(
  previous: WorkspaceAutosaveSnapshot | null,
  state: WorkspaceAutosaveState
): boolean {
  if (!previous) return true;
  return (
    previous.workspaceId !== state.workspaceId ||
    previous.projectName !== state.projectName ||
    previous.nodes !== state.nodes ||
    previous.deskMaps !== state.deskMaps ||
    previous.leaseholdUnit !== state.leaseholdUnit ||
    previous.leaseholdAssignments !== state.leaseholdAssignments ||
    previous.leaseholdOrris !== state.leaseholdOrris ||
    previous.leaseholdTransferOrderEntries !== state.leaseholdTransferOrderEntries ||
    previous.activeDeskMapId !== state.activeDeskMapId ||
    previous.activeUnitCode !== state.activeUnitCode ||
    previous.instrumentTypes !== state.instrumentTypes
  );
}

export function buildWorkspaceAutosavePayload(
  state: WorkspaceAutosaveState
): WorkspaceAutosaveState {
  return {
    workspaceId: state.workspaceId,
    projectName: state.projectName,
    nodes: state.nodes,
    deskMaps: state.deskMaps,
    leaseholdUnit: state.leaseholdUnit,
    leaseholdAssignments: state.leaseholdAssignments,
    leaseholdOrris: state.leaseholdOrris,
    leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries,
    activeDeskMapId: state.activeDeskMapId,
    activeUnitCode: state.activeUnitCode,
    instrumentTypes: state.instrumentTypes,
  };
}

export function captureCanvasAutosaveSnapshot(
  state: CanvasAutosaveState
): CanvasAutosaveSnapshot {
  return {
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    orientation: state.orientation,
    pageSize: state.pageSize,
    horizontalSpacingFactor: state.horizontalSpacingFactor,
    verticalSpacingFactor: state.verticalSpacingFactor,
    snapToGrid: state.snapToGrid,
    gridSize: state.gridSize,
  };
}

/**
 * True when the only difference between two node arrays is selection or drag
 * state (transient UI flags). Used to skip autosaving on pure selection toggles
 * so clicking around the canvas doesn't queue full IndexedDB rewrites (DA2-F8).
 *
 * Returns false (i.e. "a real change") for any add/remove/reorder or change to
 * a persisted field (position, data, type, size, parent, z-order).
 */
export function isSelectionOrDragOnlyNodeChange(
  prev: Node[],
  next: Node[]
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (
      a.id !== b.id ||
      a.position !== b.position ||
      a.data !== b.data ||
      a.type !== b.type ||
      a.width !== b.width ||
      a.height !== b.height ||
      a.hidden !== b.hidden ||
      a.parentId !== b.parentId ||
      a.zIndex !== b.zIndex
    ) {
      return false;
    }
  }
  return true;
}

export function canvasAutosaveStateChanged(
  previous: CanvasAutosaveSnapshot | null,
  state: CanvasAutosaveState
): boolean {
  if (!previous) return true;
  if (
    previous.edges !== state.edges ||
    previous.viewport !== state.viewport ||
    previous.gridCols !== state.gridCols ||
    previous.gridRows !== state.gridRows ||
    previous.orientation !== state.orientation ||
    previous.pageSize !== state.pageSize ||
    previous.horizontalSpacingFactor !== state.horizontalSpacingFactor ||
    previous.verticalSpacingFactor !== state.verticalSpacingFactor ||
    previous.snapToGrid !== state.snapToGrid ||
    previous.gridSize !== state.gridSize
  ) {
    return true;
  }
  // Nodes changed by reference, but ignore pure selection/drag toggles (F8).
  if (previous.nodes !== state.nodes) {
    return !isSelectionOrDragOnlyNodeChange(previous.nodes, state.nodes);
  }
  return false;
}

// Transient React Flow fields that must never be persisted — they describe the
// live interaction, not the saved diagram (DA2-F6).
const TRANSIENT_NODE_FIELDS = ['selected', 'dragging', 'resizing', 'measured'] as const;

function stripTransientNodeFields(node: Node): Node {
  const next = { ...node } as Record<string, unknown>;
  for (const field of TRANSIENT_NODE_FIELDS) delete next[field];
  return next as Node;
}

function stripTransientEdgeFields(edge: Edge): Edge {
  const next = { ...edge } as Record<string, unknown>;
  delete next.selected;
  return next as Edge;
}

export function buildCanvasAutosavePayload(
  state: CanvasAutosaveState
): CanvasSaveData {
  return {
    nodes: state.nodes.map(stripTransientNodeFields),
    edges: state.edges.map(stripTransientEdgeFields),
    viewport: state.viewport,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    orientation: state.orientation,
    pageSize: state.pageSize,
    horizontalSpacingFactor: state.horizontalSpacingFactor,
    verticalSpacingFactor: state.verticalSpacingFactor,
    snapToGrid: state.snapToGrid,
    gridSize: state.gridSize,
  };
}
