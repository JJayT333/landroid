/**
 * UI state — view, modals, sidebar.
 */
import { create } from 'zustand';

export type ViewMode =
  | 'chart'
  | 'leasehold'
  | 'master'
  | 'flowchart'
  | 'owners'
  | 'maps'
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

  setView: (view: ViewMode) => void;
  openModal: (mode: ModalMode) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  view: 'chart',
  modalMode: null,
  showModal: false,
  sidebarOpen: false,

  setView: (view) => set({ view }),
  openModal: (mode) => set({ modalMode: mode, showModal: true }),
  closeModal: () => set({ modalMode: null, showModal: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
