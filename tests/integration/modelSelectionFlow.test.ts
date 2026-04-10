/**
 * Integration test for model selection flow
 * Simulates the actual flow in useModelConfig.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../src/apps/cli/ink/store/uiStore.js';

// Mock dependencies
vi.mock('@mariozechner/pi-ai', () => ({
  getProviders: vi.fn(() => ['zai', 'minimax-cn']),
  getModels: vi.fn((provider: string) => {
    if (provider === 'zai') {
      return [
        { id: 'gpt-4', provider: 'zai' },
        { id: 'gpt-3.5-turbo', provider: 'zai' },
      ];
    }
    return [{ id: 'abab-5-chat', provider: 'minimax-cn' }];
  }),
}));

vi.mock('../../src/agent/index.js', () => ({
  checkApiKeyConfigured: vi.fn(() => true),
  saveApiKey: vi.fn(),
  saveModelConfig: vi.fn(),
  getAgent: vi.fn(() => ({
    setModel: vi.fn(),
    state: { messages: [] },
    sessionId: 'test-session',
  })),
}));

describe('Model Selection Flow Integration', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({ currentModel: null });
    vi.clearAllMocks();
  });

  describe('When user selects a model from SelectOneModal', () => {
    it('should update store with selected model id', () => {
      // Simulate the choice made by user in SelectOneModal
      const choice = { value: 'gpt-4', label: 'gpt-4' };
      
      // Simulate models array (from getModels('zai'))
      const models = [
        { id: 'gpt-4', provider: 'zai' },
        { id: 'gpt-3.5-turbo', provider: 'zai' },
      ];
      
      // Find the selected model (same logic as useModelConfig.ts line 188)
      const selectedModel = models.find((model) => model.id === choice.value);
      
      expect(selectedModel).toBeDefined();
      expect(selectedModel?.id).toBe('gpt-4');
      expect(selectedModel?.provider).toBe('zai');
      
      // Get setCurrentModel from store
      const setCurrentModel = useAppStore.getState().setCurrentModel;
      
      // Call setCurrentModel (same logic as useModelConfig.ts line 196)
      setCurrentModel(selectedModel!.id);
      
      // Verify store was updated
      expect(useAppStore.getState().currentModel).toBe('gpt-4');
    });

    it('should update store when switching to a different model', () => {
      // Initial model
      const setCurrentModel = useAppStore.getState().setCurrentModel;
      setCurrentModel('gpt-4');
      expect(useAppStore.getState().currentModel).toBe('gpt-4');
      
      // User switches to a different model
      const choice = { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' };
      const models = [
        { id: 'gpt-4', provider: 'zai' },
        { id: 'gpt-3.5-turbo', provider: 'zai' },
      ];
      const selectedModel = models.find((model) => model.id === choice.value);
      
      setCurrentModel(selectedModel!.id);
      expect(useAppStore.getState().currentModel).toBe('gpt-3.5-turbo');
    });

    it('should update store when switching to a different provider model', () => {
      // Start with zai provider
      let setCurrentModel = useAppStore.getState().setCurrentModel;
      setCurrentModel('gpt-4');
      expect(useAppStore.getState().currentModel).toBe('gpt-4');
      
      // User switches to minimax-cn provider
      const choice = { value: 'abab-5-chat', label: 'abab-5-chat' };
      const models = [{ id: 'abab-5-chat', provider: 'minimax-cn' }];
      const selectedModel = models.find((model) => model.id === choice.value);
      
      setCurrentModel = useAppStore.getState().setCurrentModel;
      setCurrentModel(selectedModel!.id);
      expect(useAppStore.getState().currentModel).toBe('abab-5-chat');
    });
  });

  describe('UI Display verification via useInput hook', () => {
    it('should reflect model changes for UI display', () => {
      // This simulates what InputController.ts does
      const setCurrentModel = useAppStore.getState().setCurrentModel;
      
      // Simulate model being set
      setCurrentModel('gpt-4');
      
      // Get the value that would be used for display
      const currentModel = useAppStore.getState().currentModel;
      const modelLabel = currentModel;
      
      expect(modelLabel).toBe('gpt-4');
      
      // Simulate switching models
      setCurrentModel('claude-3-opus');
      const newModelLabel = useAppStore.getState().currentModel;
      expect(newModelLabel).toBe('claude-3-opus');
    });
  });
});
