import { buildCanvasAutosavePayload, buildWorkspaceAutosavePayload } from '../storage/autosave-change-detection';
import { saveCanvasToDb } from '../storage/canvas-persistence';
import {
  createSavedProjectIndexRecord,
  getSavedProject,
  getMostRecentSavedProject,
  listSavedProjects,
  markSavedProjectOpened,
  renameSavedProjectIndexRecord,
  upsertSavedProjectFromWorkspace,
  type SavedProjectSummary,
} from '../storage/saved-project-index';
import {
  deleteProjectStorage,
  duplicateProjectStorage,
  loadProjectCanvas,
  loadProjectWorkspace,
  renameProjectInStorage,
  saveProjectCanvas,
  saveProjectWorkspaceSnapshot,
} from '../storage/project-workspace-storage';
import {
  getActiveWorkspaceStorageKey,
  makeProjectWorkspaceDbKey,
  setActiveWorkspaceStorageKey,
} from '../storage/active-workspace-key';
import {
  saveWorkspaceShardsToDb,
  type LandroidFileData,
  type WorkspaceData,
} from '../storage/workspace-persistence';
import {
  replaceWorkspaceSideStores,
  type WorkspaceSideStoreData,
} from '../storage/workspace-side-store-reset';
import { useCanvasStore, type CanvasSaveData } from '../store/canvas-store';
import { useCurativeStore } from '../store/curative-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import {
  flushTitleActionLogToStorage,
  hydrateTitleActionLogFromStorageOrBaseline,
} from '../store/title-action-log';
import { useWorkspaceStore } from '../store/workspace-store';
import { createWorkspaceId } from '../utils/workspace-id';

export type ProjectOpenResult = {
  project: SavedProjectSummary;
  warning: string | null;
};

export type ImportedWorkspaceData = Omit<WorkspaceData, 'instrumentTypes'>
  & { instrumentTypes?: string[] }
  & Partial<Pick<
    LandroidFileData,
    | 'canvas'
    | 'ownerData'
    | 'documentData'
    | 'mapData'
    | 'researchData'
    | 'curativeData'
  >>;

function readTitleOwnerData() {
  const owner = useOwnerStore.getState();
  return { owners: owner.owners, leases: owner.leases };
}

function blankCanvas(): CanvasSaveData {
  return { nodes: [], edges: [] };
}

function sideStoreDataFromImport(
  data: ImportedWorkspaceData
): WorkspaceSideStoreData {
  return {
    ownerData: data.ownerData,
    documentData: data.documentData,
    mapData: data.mapData,
    researchData: data.researchData,
    curativeData: data.curativeData,
  };
}

function normalizeImportedWorkspaceData(data: ImportedWorkspaceData): WorkspaceData {
  return {
    ...data,
    instrumentTypes: data.instrumentTypes ?? [],
  };
}

export function createBlankWorkspaceData(projectName: string): WorkspaceData {
  return {
    workspaceId: createWorkspaceId(),
    projectName: projectName.trim() || 'Untitled Workspace',
    nodes: [],
    deskMaps: [],
    leaseholdUnit: undefined,
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: [],
  };
}

async function hydrateSideStores(workspaceId: string): Promise<void> {
  await Promise.all([
    useOwnerStore.getState().setWorkspace(workspaceId),
    useMapStore.getState().setWorkspace(workspaceId),
    useResearchStore.getState().setWorkspace(workspaceId),
    useCurativeStore.getState().setWorkspace(workspaceId),
  ]);
}

export async function flushActiveProject(): Promise<void> {
  const workspace = useWorkspaceStore.getState();
  if (!workspace._hydrated) return;

  const workspacePayload = buildWorkspaceAutosavePayload(workspace);
  const result = await saveWorkspaceShardsToDb(workspacePayload);
  if (result.status === 'written') {
    await flushTitleActionLogToStorage(workspacePayload.workspaceId);
  }

  try {
    await saveCanvasToDb(
      buildCanvasAutosavePayload(useCanvasStore.getState()),
      workspace.workspaceId
    );
  } catch (error) {
    console.warn('[landroid] canvas flush before project switch failed:', error);
  }
}

async function applyLoadedProject(
  project: SavedProjectSummary,
  data: WorkspaceData,
  canvas: CanvasSaveData | null,
  loadWarning: string | null
): Promise<ProjectOpenResult> {
  const warnings: string[] = [];
  if (loadWarning) warnings.push(loadWarning);

  setActiveWorkspaceStorageKey(project.workspaceDbKey);
  useWorkspaceStore.getState().loadWorkspace(data);
  await hydrateSideStores(data.workspaceId);
  await useWorkspaceStore
    .getState()
    .hydrateNodeAttachments({ strict: true })
    .catch(() => {});
  await hydrateTitleActionLogFromStorageOrBaseline(
    data,
    readTitleOwnerData()
  ).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Title ledger hydration failed: ${message}`);
  });
  useCanvasStore.getState().loadCanvas(canvas ?? blankCanvas());
  const openedProject = await markSavedProjectOpened(data.workspaceId);
  useWorkspaceStore.getState().setStartupWarning(
    warnings.length > 0 ? warnings.join(' ') : null
  );
  return { project: openedProject ?? project, warning: warnings.join(' ') || null };
}

async function loadAndApplySavedProject(
  project: SavedProjectSummary
): Promise<ProjectOpenResult> {
  const [workspaceResult, canvas] = await Promise.all([
    loadProjectWorkspace(project),
    loadProjectCanvas(project).catch((error) => {
      console.warn('[landroid] saved project canvas load failed:', error);
      return null;
    }),
  ]);

  if (workspaceResult.status !== 'loaded' || !workspaceResult.data) {
    throw new Error(
      workspaceResult.error ?? `Saved project ${project.projectName} could not be opened.`
    );
  }

  return applyLoadedProject(
    project,
    workspaceResult.data,
    canvas,
    workspaceResult.warning
  );
}

export async function openSavedProject(
  project: SavedProjectSummary
): Promise<ProjectOpenResult> {
  await flushActiveProject();
  return loadAndApplySavedProject(project);
}

export async function openMostRecentSavedProject(): Promise<ProjectOpenResult | null> {
  const project = await getMostRecentSavedProject();
  if (!project) return null;
  const [workspaceResult, canvas] = await Promise.all([
    loadProjectWorkspace(project),
    loadProjectCanvas(project).catch((error) => {
      console.warn('[landroid] saved project canvas load failed:', error);
      return null;
    }),
  ]);
  if (workspaceResult.status !== 'loaded' || !workspaceResult.data) return null;
  return applyLoadedProject(project, workspaceResult.data, canvas, workspaceResult.warning);
}

export async function createAndOpenSavedProject(
  projectName: string,
  options: { flushCurrent?: boolean } = {}
): Promise<ProjectOpenResult> {
  if (options.flushCurrent ?? true) await flushActiveProject();
  const data = createBlankWorkspaceData(projectName);
  const project = await createSavedProjectIndexRecord(data.workspaceId, data.projectName);
  setActiveWorkspaceStorageKey(project.workspaceDbKey);
  await Promise.all([
    saveProjectWorkspaceSnapshot(data, project.workspaceDbKey),
    saveProjectCanvas(blankCanvas(), project.workspaceDbKey),
  ]);
  return applyLoadedProject(project, data, blankCanvas(), null);
}

export async function importAndOpenWorkspace(
  data: ImportedWorkspaceData
): Promise<ProjectOpenResult> {
  const workspaceData = normalizeImportedWorkspaceData(data);
  const previousWorkspaceDbKey = getActiveWorkspaceStorageKey();
  await flushActiveProject();

  const existingProject = await getSavedProject(workspaceData.workspaceId);
  const workspaceDbKey =
    existingProject?.workspaceDbKey
      ?? makeProjectWorkspaceDbKey(workspaceData.workspaceId);

  setActiveWorkspaceStorageKey(workspaceDbKey);
  try {
    await replaceWorkspaceSideStores(
      workspaceData.workspaceId,
      sideStoreDataFromImport(data)
    );
    await Promise.all([
      saveProjectWorkspaceSnapshot(workspaceData, workspaceDbKey),
      saveProjectCanvas(data.canvas ?? blankCanvas(), workspaceDbKey),
    ]);
    const project = await upsertSavedProjectFromWorkspace({
      workspaceId: workspaceData.workspaceId,
      projectName: workspaceData.projectName,
      workspaceDbKey,
      openedAt: new Date().toISOString(),
    });
    useWorkspaceStore.getState().loadWorkspace(workspaceData);
    useCanvasStore.getState().loadCanvas(data.canvas ?? blankCanvas());
    await useWorkspaceStore
      .getState()
      .hydrateNodeAttachments({ strict: true })
      .catch(() => {});
    useWorkspaceStore.getState().setStartupWarning(null);
    return { project, warning: null };
  } catch (error) {
    setActiveWorkspaceStorageKey(previousWorkspaceDbKey);
    throw error;
  }
}

export async function renameSavedProject(
  project: SavedProjectSummary,
  projectName: string
): Promise<SavedProjectSummary> {
  const activeWorkspace = useWorkspaceStore.getState();
  const active = activeWorkspace.workspaceId === project.workspaceId;
  if (active) {
    activeWorkspace.setProjectName(projectName);
    await flushActiveProject();
  }
  const renamed = active
    ? await renameSavedProjectIndexRecord(project.workspaceId, projectName)
    : await renameProjectInStorage(project, projectName);
  return renamed ?? { ...project, projectName };
}

export async function duplicateSavedProject(
  project: SavedProjectSummary,
  projectName: string
): Promise<SavedProjectSummary> {
  await flushActiveProject();
  const [workspaceResult, canvas] = await Promise.all([
    loadProjectWorkspace(project),
    loadProjectCanvas(project).catch((error) => {
      console.warn('[landroid] saved project canvas load failed:', error);
      return null;
    }),
  ]);
  if (workspaceResult.status !== 'loaded' || !workspaceResult.data) {
    throw new Error(
      workspaceResult.error ?? `Saved project ${project.projectName} could not be duplicated.`
    );
  }

  const targetData = {
    ...workspaceResult.data,
    workspaceId: createWorkspaceId(),
    projectName: projectName.trim() || `${project.projectName} Copy`,
  };
  const target = await createSavedProjectIndexRecord(
    targetData.workspaceId,
    targetData.projectName
  );
  await duplicateProjectStorage(project, target, targetData, canvas);
  return target;
}

export async function deleteSavedProject(project: SavedProjectSummary): Promise<void> {
  await deleteProjectStorage(project);
  const activeWorkspace = useWorkspaceStore.getState();
  if (activeWorkspace.workspaceId !== project.workspaceId) return;

  const replacement = (await listSavedProjects())[0] ?? null;
  if (replacement) {
    await loadAndApplySavedProject(replacement);
    return;
  }
  await createAndOpenSavedProject('Untitled Workspace', { flushCurrent: false });
}
