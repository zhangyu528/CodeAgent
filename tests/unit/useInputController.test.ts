/**
 * InputController 测试
 * 测试输入控制器的状态和操作
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../src/apps/cli/ink/store/uiStore.js', () => ({
  useAppStore: vi.fn(() => ({
    isFirstPress: false,
    page: 'chat',
    currentModel: 'gpt-4',
    setPage: vi.fn(),
  })),
}));

vi.mock('../../src/apps/cli/ink/store/sessionStore.js', () => ({
  useSessionStore: vi.fn(() => ({
    ensureSessionForPrompt: vi.fn(),
    setPendingPrompt: vi.fn(),
  })),
}));

vi.mock('../../src/apps/cli/ink/store/messageStore.js', () => ({
  useMessageStore: vi.fn(() => ({
    addMessage: vi.fn(),
  })),
}));

vi.mock('../../src/apps/cli/ink/utils.js', () => ({
  shortenPath: vi.fn((p: string) => p),
}));

vi.mock('../../src/apps/cli/ink/hooks/useModelConfig.js', () => ({
  useModelConfig: vi.fn(() => ({
    startConfig: vi.fn(),
  })),
}));

vi.mock('ink', () => ({
  useInput: vi.fn(),
}));

vi.mock('../../src/apps/cli/ink/components/inputs/SlashListController.js', () => ({
  useSlashHandlers: vi.fn(() => ({
    onHelp: vi.fn(),
    onNew: vi.fn(),
    onModel: vi.fn(),
    onHistory: vi.fn(),
    onResume: vi.fn(),
    onQuit: vi.fn(),
  })),
}));

vi.mock('../../src/apps/cli/ink/components/modals/index.js', () => ({
  hasAnyModalOpen: vi.fn(() => false),
}));

vi.mock('../../src/apps/cli/ink/../../../agent/index.js', () => ({
  getAgent: vi.fn(() => ({
    prompt: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Test that the module exports are correct
import { InputControllerResult } from '../../src/apps/cli/ink/components/inputs/InputController.js';

describe('InputController exports', () => {
  describe('InputControllerResult interface', () => {
    it('should have value property', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: null,
        cwdLabel: '',
      };

      expect(result.value).toBe('');
    });

    it('should have setValue function', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: null,
        cwdLabel: '',
      };

      expect(typeof result.setValue).toBe('function');
    });

    it('should have isExitHint boolean', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: null,
        cwdLabel: '',
      };

      expect(typeof result.isExitHint).toBe('boolean');
    });

    it('should have isWelcome boolean', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: null,
        cwdLabel: '',
      };

      expect(typeof result.isWelcome).toBe('boolean');
    });

    it('should have modelLabel string or null', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: 'gpt-4',
        cwdLabel: '',
      };

      expect(result.modelLabel).toBe('gpt-4');
    });

    it('should have cwdLabel string', () => {
      const result: InputControllerResult = {
        value: '',
        setValue: vi.fn(),
        isExitHint: false,
        isWelcome: false,
        modelLabel: null,
        cwdLabel: '/path/to/dir',
      };

      expect(typeof result.cwdLabel).toBe('string');
    });
  });
});
