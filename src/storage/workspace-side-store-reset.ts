import { useAIApprovalStore } from '../ai/approval-store';
import { useAIUndoStore } from '../ai/undo-store';
import { useCurativeStore } from '../store/curative-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import type { CurativeWorkspaceData } from './curative-persistence';
import type { MapWorkspaceData } from './map-persistence';
import type { OwnerWorkspaceData } from './owner-persistence';
import type { ResearchWorkspaceData } from './research-persistence';
import {
  replaceDocumentWorkspaceData,
  type DocumentWorkspaceData,
} from './workspace-persistence';

const EMPTY_OWNER_DATA: OwnerWorkspaceData = {
  owners: [],
  leases: [],
  contacts: [],
  docs: [],
};

const EMPTY_DOCUMENT_DATA: DocumentWorkspaceData = {
  documents: [],
  attachments: [],
};

const EMPTY_MAP_DATA: MapWorkspaceData = {
  mapAssets: [],
  mapRegions: [],
  mapReferences: [],
};

const EMPTY_RESEARCH_DATA: ResearchWorkspaceData = {
  imports: [],
  sources: [],
  formulas: [],
  projectRecords: [],
  questions: [],
};

const EMPTY_CURATIVE_DATA: CurativeWorkspaceData = {
  titleIssues: [],
};

export interface WorkspaceSideStoreData {
  ownerData?: OwnerWorkspaceData;
  documentData?: DocumentWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
}

export async function replaceWorkspaceSideStores(
  workspaceId: string,
  data: WorkspaceSideStoreData = {}
): Promise<void> {
  await Promise.all([
    useOwnerStore
      .getState()
      .replaceWorkspaceData(workspaceId, data.ownerData ?? EMPTY_OWNER_DATA),
    replaceDocumentWorkspaceData(
      data.documentData ?? EMPTY_DOCUMENT_DATA,
      workspaceId
    ),
    useMapStore
      .getState()
      .replaceWorkspaceData(workspaceId, data.mapData ?? EMPTY_MAP_DATA),
    useResearchStore
      .getState()
      .replaceWorkspaceData(workspaceId, data.researchData ?? EMPTY_RESEARCH_DATA),
    useCurativeStore
      .getState()
      .replaceWorkspaceData(workspaceId, data.curativeData ?? EMPTY_CURATIVE_DATA),
  ]);

  useAIApprovalStore.getState().clear();
  useAIUndoStore.getState().clear();
}
