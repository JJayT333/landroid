import { create } from 'zustand';
import {
  deleteTitleIssue,
  loadCurativeWorkspaceData,
  replaceCurativeWorkspaceData,
  saveTitleIssue,
  type CurativeWorkspaceData,
} from '../storage/curative-persistence';
import {
  normalizeTitleIssue,
  type TitleIssue,
} from '../types/title-issue';

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

function titleIssueIsClosed(issue: TitleIssue) {
  return issue.status === 'Resolved' || issue.status === 'Deferred';
}

function sortTitleIssues(issues: TitleIssue[]) {
  return [...issues].sort((left, right) => {
    if (titleIssueIsClosed(left) !== titleIssueIsClosed(right)) {
      return titleIssueIsClosed(left) ? 1 : -1;
    }

    const leftDueDate = left.dueDate || '9999-12-31';
    const rightDueDate = right.dueDate || '9999-12-31';
    const dueDateDiff = leftDueDate.localeCompare(rightDueDate);
    if (dueDateDiff !== 0) {
      return dueDateDiff;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

interface CurativeState {
  workspaceId: string | null;
  titleIssues: TitleIssue[];
  selectedIssueId: string | null;
  _hydrated: boolean;
  setWorkspace: (workspaceId: string) => Promise<void>;
  replaceWorkspaceData: (
    workspaceId: string,
    data: CurativeWorkspaceData
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<CurativeWorkspaceData>;
  selectIssue: (issueId: string | null) => void;
  addIssue: (issue: TitleIssue) => Promise<void>;
  updateIssue: (id: string, fields: Partial<TitleIssue>) => Promise<void>;
  removeIssue: (id: string) => Promise<void>;
  unlinkDeskMap: (deskMapId: string) => void;
  unlinkNode: (nodeId: string) => void;
  unlinkOwner: (ownerId: string) => void;
  unlinkLease: (leaseId: string) => void;
}

export const useCurativeStore = create<CurativeState>()((set, get) => ({
  workspaceId: null,
  titleIssues: [],
  selectedIssueId: null,
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadCurativeWorkspaceData(workspaceId);
    set({
      workspaceId,
      titleIssues: sortTitleIssues(data.titleIssues),
      selectedIssueId: null,
      _hydrated: true,
    });
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    const titleIssues = data.titleIssues.map((issue) =>
      normalizeTitleIssue({ ...issue, workspaceId }, { workspaceId })
    );
    await replaceCurativeWorkspaceData(workspaceId, { titleIssues });
    set({
      workspaceId,
      titleIssues: sortTitleIssues(titleIssues),
      selectedIssueId: null,
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => ({ titleIssues: get().titleIssues }),

  selectIssue: (selectedIssueId) => set({ selectedIssueId }),

  addIssue: async (issue) => {
    const workspaceId = get().workspaceId ?? issue.workspaceId;
    const next = normalizeTitleIssue({ ...issue, workspaceId }, { workspaceId });
    await saveTitleIssue(next);
    set((state) => ({
      titleIssues: sortTitleIssues([next, ...state.titleIssues]),
      selectedIssueId: next.id,
    }));
  },

  updateIssue: async (id, fields) => {
    const current = get().titleIssues.find((issue) => issue.id === id);
    if (!current) return;
    const next = normalizeTitleIssue(
      touch({ ...current, ...fields, workspaceId: current.workspaceId }),
      { workspaceId: current.workspaceId }
    );
    await saveTitleIssue(next);
    set((state) => ({
      titleIssues: sortTitleIssues(
        state.titleIssues.map((issue) => (issue.id === id ? next : issue))
      ),
    }));
  },

  removeIssue: async (id) => {
    await deleteTitleIssue(id);
    set((state) => ({
      titleIssues: state.titleIssues.filter((issue) => issue.id !== id),
      selectedIssueId:
        state.selectedIssueId === id ? null : state.selectedIssueId,
    }));
  },

  unlinkDeskMap: (deskMapId) =>
    set((state) => {
      const nextIssues = state.titleIssues.map((issue) =>
        issue.affectedDeskMapId === deskMapId
          ? touch({ ...issue, affectedDeskMapId: null, affectedNodeId: null })
          : issue
      );
      void Promise.all(
        nextIssues
          .filter((issue, index) => issue !== state.titleIssues[index])
          .map((issue) => saveTitleIssue(issue))
      );
      return { titleIssues: nextIssues };
    }),

  unlinkNode: (nodeId) =>
    set((state) => {
      const nextIssues = state.titleIssues.map((issue) =>
        issue.affectedNodeId === nodeId
          ? touch({ ...issue, affectedNodeId: null })
          : issue
      );
      void Promise.all(
        nextIssues
          .filter((issue, index) => issue !== state.titleIssues[index])
          .map((issue) => saveTitleIssue(issue))
      );
      return { titleIssues: nextIssues };
    }),

  unlinkOwner: (ownerId) =>
    set((state) => {
      const nextIssues = state.titleIssues.map((issue) =>
        issue.affectedOwnerId === ownerId
          ? touch({ ...issue, affectedOwnerId: null })
          : issue
      );
      void Promise.all(
        nextIssues
          .filter((issue, index) => issue !== state.titleIssues[index])
          .map((issue) => saveTitleIssue(issue))
      );
      return { titleIssues: nextIssues };
    }),

  unlinkLease: (leaseId) =>
    set((state) => {
      const nextIssues = state.titleIssues.map((issue) =>
        issue.affectedLeaseId === leaseId
          ? touch({ ...issue, affectedLeaseId: null })
          : issue
      );
      void Promise.all(
        nextIssues
          .filter((issue, index) => issue !== state.titleIssues[index])
          .map((issue) => saveTitleIssue(issue))
      );
      return { titleIssues: nextIssues };
    }),
}));
