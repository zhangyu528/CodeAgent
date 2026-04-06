/**
 * DebugStore - Debug messages (shared across app)
 */
import { create } from 'zustand';

interface DebugState {
  messages: string[];
}

interface DebugActions {
  addMessage: (msg: string) => void;
}

export const useDebugStore = create<DebugState & DebugActions>((set) => ({
  messages: [],

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
}));
