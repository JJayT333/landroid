/**
 * UI state — view, modals, sidebar.
 */
import { create } from 'zustand';
import type { NodeEditorRoute } from '../utils/node-editor-route';

export type ViewMode =
  | 'chart'
  | 'leasehold'
  | 'master'
  | 'flowchart'
  | 'owners'
  | 'curative'
  | 'maps'
  | 'federalLeasing'
  | 'research';
export type ModalMode =
  | null
  | 'edit'
  | 'convey'
  | 'precede'
  | 'rebalance'
  | 'attach'
  | 'add_related'
  | 'add_chain';

interface UIState {
  view: ViewMode;
  modalMode: ModalMode;
  showModal: boolean;
  sidebarOpen: boolean;
  pendingNodeEditorRoute: NodeEditorRoute | null;

  setView: (view: ViewMode) => void;
  setPendingNodeEditorRoute: (route: NodeEditorRoute | null) => void;
  openModal: (mode: ModalMode) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  view: 'chart',
  modalMode: null,
  showModal: false,
  sidebarOpen: false,
  pendingNodeEditorRoute: null,

  setView: (view) => set({ view }),
  setPendingNodeEditorRoute: (pendingNodeEditorRoute) =>
    set({ pendingNodeEditorRoute }),
  openModal: (mode) => set({ modalMode: mode, showModal: true }),
  closeModal: () => set({ modalMode: null, showModal: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
