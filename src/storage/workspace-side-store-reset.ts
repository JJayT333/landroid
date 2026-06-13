import { useAIApprovalStore } from '../ai/approval-store';
import { useAIActionJournalStore } from '../ai/action-journal';
import { useAIUndoStore } from '../ai/undo-store';
import { useCurativeStore } from '../store/curative-store';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import type { OwnershipNode } from '../types/node';
import type { CurativeWorkspaceData } from './curative-persistence';
import type { MapWorkspaceData } from './map-persistence';
import type { OwnerWorkspaceData } from './owner-persistence';
import type { ResearchWorkspaceData } from './research-persistence';
import { clearTitleLedgerRowsForActiveKey } from './title-ledger-persistence';
import {
  clearWorkspaceShardsForActiveKey,
  exportDocumentWorkspaceData,
  replaceDocumentWorkspaceData,
  type CanvasAssetWorkspaceData,
  type DocumentWorkspaceData,
} from './workspace-persistence';
import {
  listCanvasAssets,
  replaceCanvasAssetWorkspaceData,
} from './canvas-assets';

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

const EMPTY_CANVAS_ASSET_DATA: CanvasAssetWorkspaceData = {
  assets: [],
};

export interface WorkspaceSideStoreData {
  ownerData?: OwnerWorkspaceData;
  documentData?: DocumentWorkspaceData;
  mapData?: MapWorkspaceData;
  researchData?: ResearchWorkspaceData;
  curativeData?: CurativeWorkspaceData;
  canvasAssetData?: CanvasAssetWorkspaceData;
}

interface ReplaceWorkspaceSideStoresWithRollbackOptions {
  targetWorkspaceId: string;
  targetData?: WorkspaceSideStoreData;
  rollbackWorkspaceId: string;
  rollbackNodes: OwnershipNode[];
}

function sideStoreReplacementPromises(
  workspaceId: string,
  data: WorkspaceSideStoreData = {}
): Array<Promise<void>> {
  return [
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
    replaceCanvasAssetWorkspaceData(
      workspaceId,
      data.canvasAssetData ?? EMPTY_CANVAS_ASSET_DATA
    ),
  ];
}

async function finalizeWorkspaceSideStoreReplacement(): Promise<void> {
  // Drop the prior workspace's shard rows for this DB key so the replacement
  // workspace's autosave starts from a clean set and the reader cannot resolve
  // a stale workspace under the active key.
  await Promise.all([
    clearWorkspaceShardsForActiveKey(),
    clearTitleLedgerRowsForActiveKey(),
  ]);

  useAIApprovalStore.getState().clear();
  useAIActionJournalStore.getState().clear();
  useAIUndoStore.getState().clear();
}

export async function replaceWorkspaceSideStores(
  workspaceId: string,
  data: WorkspaceSideStoreData = {}
): Promise<void> {
  await Promise.all(sideStoreReplacementPromises(workspaceId, data));
  await finalizeWorkspaceSideStoreReplacement();
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

async function settleWorkspaceSideStoreReplacement(
  workspaceId: string,
  data: WorkspaceSideStoreData
): Promise<Error[]> {
  const results = await Promise.allSettled(
    sideStoreReplacementPromises(workspaceId, data)
  );
  return results.flatMap((result) =>
    result.status === 'rejected' ? [toError(result.reason)] : []
  );
}

function replacementFailure(errors: Error[], fallbackMessage: string): Error {
  if (errors.length === 1) return errors[0];
  if (errors.length === 0) return new Error(fallbackMessage);
  return new Error(
    `${fallbackMessage}: ${errors.map((error) => error.message).join('; ')}`
  );
}

async function exportActiveWorkspaceSideStores(
  workspaceId: string,
  nodes: OwnershipNode[]
): Promise<Required<WorkspaceSideStoreData>> {
  const [ownerData, documentData, mapData, researchData, curativeData, canvasAssets] =
    await Promise.all([
      useOwnerStore.getState().exportWorkspaceData(),
      exportDocumentWorkspaceData(workspaceId, nodes),
      useMapStore.getState().exportWorkspaceData(),
      useResearchStore.getState().exportWorkspaceData(),
      useCurativeStore.getState().exportWorkspaceData(),
      listCanvasAssets(workspaceId),
    ]);
  return {
    ownerData,
    documentData,
    mapData,
    researchData,
    curativeData,
    canvasAssetData: { assets: canvasAssets },
  };
}

export async function replaceWorkspaceSideStoresWithRollback({
  targetWorkspaceId,
  targetData = {},
  rollbackWorkspaceId,
  rollbackNodes,
}: ReplaceWorkspaceSideStoresWithRollbackOptions): Promise<void> {
  const rollbackData = await exportActiveWorkspaceSideStores(
    rollbackWorkspaceId,
    rollbackNodes
  );

  const targetErrors = await settleWorkspaceSideStoreReplacement(
    targetWorkspaceId,
    targetData
  );
  if (targetErrors.length === 0) {
    await finalizeWorkspaceSideStoreReplacement();
    return;
  }

  const rollbackErrors = await settleWorkspaceSideStoreReplacement(
    rollbackWorkspaceId,
    rollbackData
  );
  if (rollbackErrors.length === 0) {
    await finalizeWorkspaceSideStoreReplacement();
    throw replacementFailure(
      targetErrors,
      'Side-store replacement failed.'
    );
  }

  throw replacementFailure(
    [...targetErrors, ...rollbackErrors],
    'Side-store replacement failed and rollback also failed.'
  );
}
