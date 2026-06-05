import { useCanvasStore } from '../store/canvas-store';
import { useCurativeStore } from '../store/curative-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import { useTitleActionLog } from '../store/title-action-log';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  exportDocumentWorkspaceData,
  type LandroidFileData,
  type LandroidFileExportOptions,
} from '../storage/workspace-persistence';

export interface CurrentLandroidExport {
  data: LandroidFileData;
  options: LandroidFileExportOptions;
}

export async function buildCurrentLandroidData(): Promise<LandroidFileData> {
  const state = useWorkspaceStore.getState();
  const canvasState = useCanvasStore.getState();

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
    ownerData: await useOwnerStore.getState().exportWorkspaceData(),
    documentData: await exportDocumentWorkspaceData(
      state.workspaceId,
      state.nodes
    ),
    mapData: await useMapStore.getState().exportWorkspaceData(),
    researchData: await useResearchStore.getState().exportWorkspaceData(),
    curativeData: await useCurativeStore.getState().exportWorkspaceData(),
    canvas: {
      nodes: canvasState.nodes,
      edges: canvasState.edges,
      viewport: canvasState.viewport,
      gridCols: canvasState.gridCols,
      gridRows: canvasState.gridRows,
      orientation: canvasState.orientation,
      pageSize: canvasState.pageSize,
      horizontalSpacingFactor: canvasState.horizontalSpacingFactor,
      verticalSpacingFactor: canvasState.verticalSpacingFactor,
      snapToGrid: canvasState.snapToGrid,
      gridSize: canvasState.gridSize,
    },
  };
}

export async function buildCurrentLandroidExport(): Promise<CurrentLandroidExport> {
  const titleActionLog = useTitleActionLog.getState();
  return {
    data: await buildCurrentLandroidData(),
    options: {
      actionRecords: titleActionLog.actionRecords,
      auditEvents: titleActionLog.auditEvents,
    },
  };
}
