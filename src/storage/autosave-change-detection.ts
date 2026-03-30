import type { Edge, Node, Viewport } from '@xyflow/react';
import type { DeskMap, OwnershipNode } from '../types/node';
import type { CanvasSaveData } from '../store/canvas-store';
import type { LeaseholdOrri, LeaseholdUnit } from '../types/leasehold';

export interface WorkspaceAutosaveState {
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit?: LeaseholdUnit;
  leaseholdOrris?: LeaseholdOrri[];
  activeDeskMapId: string | null;
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
  leaseholdOrris?: LeaseholdOrri[];
  activeDeskMapId: string | null;
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
    leaseholdOrris: state.leaseholdOrris,
    activeDeskMapId: state.activeDeskMapId,
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
    previous.leaseholdOrris !== state.leaseholdOrris ||
    previous.activeDeskMapId !== state.activeDeskMapId ||
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
    leaseholdOrris: state.leaseholdOrris,
    activeDeskMapId: state.activeDeskMapId,
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

export function canvasAutosaveStateChanged(
  previous: CanvasAutosaveSnapshot | null,
  state: CanvasAutosaveState
): boolean {
  if (!previous) return true;
  return (
    previous.nodes !== state.nodes ||
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
  );
}

export function buildCanvasAutosavePayload(
  state: CanvasAutosaveState
): CanvasSaveData {
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
