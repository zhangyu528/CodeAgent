/**
 * uiStore 单元测试
 * 测试 AppStore 的核心逻辑
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

type PiPage = 'loading' | 'welcome' | 'chat';

interface AppStoreState {
  page: PiPage;
  isFirstPress: boolean;
  currentModel: string | null;
  pendingPrompt: string | null;
  hasModalOpen: boolean;
  setPage: (page: PiPage) => void;
  showHint: () => void;
  hideHint: () => void;
  setCurrentModel: (model: string | null) => void;
  setPendingPrompt: (prompt: string | null) => void;
  setHasModalOpen: (isOpen: boolean) => void;
}

const createTestStore = () => create<AppStoreState>((set) => ({
  page: 'loading',
  isFirstPress: false,
  currentModel: null,
  pendingPrompt: null,
  hasModalOpen: false,
  setPage: (page) => set({ page }),
  showHint: () => set({ isFirstPress: true }),
  hideHint: () => set({ isFirstPress: false }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
  setHasModalOpen: (isOpen) => set({ hasModalOpen: isOpen }),
}));

describe('AppStore', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('initial state', () => {
    it('should have page as loading', () => {
      expect(store.getState().page).toBe('loading');
    });

    it('should have isFirstPress as false', () => {
      expect(store.getState().isFirstPress).toBe(false);
    });

    it('should have currentModel as null', () => {
      expect(store.getState().currentModel).toBeNull();
    });

    it('should have pendingPrompt as null', () => {
      expect(store.getState().pendingPrompt).toBeNull();
    });

    it('should have hasModalOpen as false', () => {
      expect(store.getState().hasModalOpen).toBe(false);
    });
  });

  describe('setPage', () => {
    it('should set page to welcome', () => {
      store.getState().setPage('welcome');
      expect(store.getState().page).toBe('welcome');
    });

    it('should set page to chat', () => {
      store.getState().setPage('welcome');
      store.getState().setPage('chat');
      expect(store.getState().page).toBe('chat');
    });

    it('should set page to loading', () => {
      store.getState().setPage('welcome');
      store.getState().setPage('loading');
      expect(store.getState().page).toBe('loading');
    });

    it('should transition through all pages', () => {
      store.getState().setPage('welcome');
      expect(store.getState().page).toBe('welcome');

      store.getState().setPage('chat');
      expect(store.getState().page).toBe('chat');

      store.getState().setPage('loading');
      expect(store.getState().page).toBe('loading');
    });
  });

  describe('showHint / hideHint', () => {
    it('should show hint (set isFirstPress to true)', () => {
      store.getState().showHint();
      expect(store.getState().isFirstPress).toBe(true);
    });

    it('should hide hint (set isFirstPress to false)', () => {
      store.getState().showHint();
      store.getState().hideHint();
      expect(store.getState().isFirstPress).toBe(false);
    });

    it('should allow multiple show/hide cycles', () => {
      store.getState().showHint();
      expect(store.getState().isFirstPress).toBe(true);

      store.getState().hideHint();
      expect(store.getState().isFirstPress).toBe(false);

      store.getState().showHint();
      expect(store.getState().isFirstPress).toBe(true);
    });
  });

  describe('setCurrentModel', () => {
    it('should set currentModel to a string', () => {
      store.getState().setCurrentModel('gpt-4');
      expect(store.getState().currentModel).toBe('gpt-4');
    });

    it('should set currentModel to null', () => {
      store.getState().setCurrentModel('gpt-4');
      store.getState().setCurrentModel(null);
      expect(store.getState().currentModel).toBeNull();
    });

    it('should update model name', () => {
      store.getState().setCurrentModel('gpt-3.5');
      expect(store.getState().currentModel).toBe('gpt-3.5');

      store.getState().setCurrentModel('claude-3');
      expect(store.getState().currentModel).toBe('claude-3');
    });
  });

  describe('setPendingPrompt', () => {
    it('should set pendingPrompt to a string', () => {
      store.getState().setPendingPrompt('Hello world');
      expect(store.getState().pendingPrompt).toBe('Hello world');
    });

    it('should set pendingPrompt to null', () => {
      store.getState().setPendingPrompt('Hello world');
      store.getState().setPendingPrompt(null);
      expect(store.getState().pendingPrompt).toBeNull();
    });

    it('should update pending prompt', () => {
      store.getState().setPendingPrompt('First prompt');
      expect(store.getState().pendingPrompt).toBe('First prompt');

      store.getState().setPendingPrompt('Second prompt');
      expect(store.getState().pendingPrompt).toBe('Second prompt');
    });

    it('should handle empty string', () => {
      store.getState().setPendingPrompt('');
      expect(store.getState().pendingPrompt).toBe('');
    });
  });

  describe('setHasModalOpen', () => {
    it('should set hasModalOpen to true', () => {
      store.getState().setHasModalOpen(true);
      expect(store.getState().hasModalOpen).toBe(true);
    });

    it('should set hasModalOpen to false', () => {
      store.getState().setHasModalOpen(true);
      store.getState().setHasModalOpen(false);
      expect(store.getState().hasModalOpen).toBe(false);
    });
  });

  describe('PiPage type', () => {
    it('should accept loading as valid page', () => {
      store.getState().setPage('loading');
      expect(store.getState().page).toBe('loading');
    });

    it('should accept welcome as valid page', () => {
      store.getState().setPage('welcome');
      expect(store.getState().page).toBe('welcome');
    });

    it('should accept chat as valid page', () => {
      store.getState().setPage('chat');
      expect(store.getState().page).toBe('chat');
    });
  });

  describe('combined state transitions', () => {
    it('should handle welcome to chat transition', () => {
      store.getState().setPage('welcome');
      store.getState().setCurrentModel('gpt-4');

      store.getState().setPage('chat');

      expect(store.getState().page).toBe('chat');
      expect(store.getState().currentModel).toBe('gpt-4');
    });

    it('should handle modal and prompt together', () => {
      store.getState().setPendingPrompt('Test prompt');
      store.getState().setHasModalOpen(true);

      expect(store.getState().pendingPrompt).toBe('Test prompt');
      expect(store.getState().hasModalOpen).toBe(true);
    });

    it('should reset pending prompt when opening modal', () => {
      store.getState().setPendingPrompt('User input');
      store.getState().setHasModalOpen(true);
      store.getState().setPendingPrompt(null);

      expect(store.getState().pendingPrompt).toBeNull();
    });
  });

  describe('state isolation', () => {
    it('should maintain independent state', () => {
      const store1 = createTestStore();
      const store2 = createTestStore();

      store1.getState().setPage('chat');
      store1.getState().setCurrentModel('gpt-4');

      expect(store2.getState().page).toBe('loading');
      expect(store2.getState().currentModel).toBeNull();
    });
  });
});
