/**
 * MessageStore - Shared message state across app
 */
import { create } from 'zustand';
import { ChatMessage } from '../pages/types.js';

interface MessageStore {
  messages: ChatMessage[];
  thinking: boolean;
  usage: { input: number; output: number; cost: number } | null;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (update: (msg: ChatMessage) => ChatMessage) => void;
  clearMessages: () => void;
  setThinking: (thinking: boolean) => void;
  setUsage: (usage: { input: number; output: number; cost: number } | null) => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messages: [],
  thinking: false,
  usage: null,

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  updateLastMessage: (update) => set((state) => {
    if (state.messages.length === 0) return state;
    const newMessages = [...state.messages];
    newMessages[newMessages.length - 1] = update(newMessages[newMessages.length - 1]);
    return { messages: newMessages };
  }),

  clearMessages: () => set({ messages: [], thinking: false, usage: null }),

  setThinking: (thinking) => set({ thinking }),

  setUsage: (usage) => set({ usage }),
}));
