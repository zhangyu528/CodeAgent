import { create } from 'zustand';

export type PiPage = 'loading' | 'welcome' | 'chat';

interface AppStoreState {
  page: PiPage;
  isFirstPress: boolean;
  currentModel: string | null;
  pendingPrompt: string | null;
  setPage: (page: PiPage) => void;
  showHint: () => void;
  hideHint: () => void;
  setCurrentModel: (model: string | null) => void;
  setPendingPrompt: (prompt: string | null) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  page: 'loading',
  isFirstPress: false,
  currentModel: null,
  pendingPrompt: null,
  setPage: (page) => set({ page }),
  showHint: () => set({ isFirstPress: true }),
  hideHint: () => set({ isFirstPress: false }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
}));
