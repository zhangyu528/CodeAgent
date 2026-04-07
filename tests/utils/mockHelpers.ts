/**
 * 测试 Mock 工具函数
 */
import { vi } from 'vitest';

// Mock Agent 实例
export function createMockAgent() {
  return {
    sessionId: undefined as string | undefined,
    state: {
      messages: [],
      model: null,
    },
    replaceMessages: vi.fn(),
    prompt: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
}

// Mock sessionManager
export function createMockSessionManager() {
  return {
    saveSession: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue(null),
    getHistory: vi.fn().mockResolvedValue([]),
    getLatestSessionId: vi.fn().mockResolvedValue(null),
  };
}

// Mock modal store
export function createMockModalStore() {
  return {
    openNotice: vi.fn(),
    openSelectOne: vi.fn(),
    openSelectMany: vi.fn(),
    closeModal: vi.fn(),
  };
}

// Mock app store
export function createMockAppStore() {
  return {
    page: 'welcome' as 'welcome' | 'chat' | 'loading',
    setPage: vi.fn(),
    isFirstPress: false,
    currentModel: null as string | null,
  };
}

// 模拟键盘事件
export function simulateInput(handler: (input: string, key: any) => void, input: string, key: any = {}) {
  handler(input, key);
}
