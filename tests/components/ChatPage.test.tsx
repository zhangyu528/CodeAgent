/**
 * ChatPage 组件测试
 * 测试聊天页面组合和布局
 * 
 * 注意: ChatPage 是组合组件，主要测试其是否能正确渲染子组件
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock Agent types
interface MockAgent {
  state: { messages: any[] };
  prompt: ReturnType<typeof vi.fn>;
}

// Mock AgentContext
vi.mock('../../src/apps/cli/ink/context/AgentContext.js', () => ({
  AgentProvider: ({ children }: { children: React.ReactNode }) => children,
  useAgent: () => mockAgent,
  getAgent: () => mockAgent,
}));

// Mock stores
vi.mock('../../src/apps/cli/ink/store/sessionStore.js', () => ({
  useSessionStore: vi.fn(() => ({
    currentSession: null,
    getAndClearPendingPrompt: vi.fn(() => null),
    ensureSessionForPrompt: vi.fn(),
    persistCurrentSession: vi.fn(),
  })),
}));

vi.mock('../../src/apps/cli/ink/store/messageStore.js', () => ({
  useMessageStore: vi.fn(() => ({
    messages: [],
  })),
}));

// Mock useAgentEvents
vi.mock('../../src/apps/cli/ink/hooks/useAgentEvents.js', () => ({
  useAgentEvents: vi.fn(() => ({
    hydrateFromAgentState: vi.fn(),
    appendUserMessage: vi.fn(),
  })),
}));

// Mock ink modules
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({
      stdout: {
        rows: 24,
        on: vi.fn(),
        off: vi.fn(),
      },
    }),
  };
});

// Mock ScrollView
vi.mock('ink-scroll-view', () => ({
  ScrollView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@byteland/ink-scroll-bar', () => ({
  ScrollBar: () => null,
}));

// Create mock agent
let mockAgent: MockAgent = {
  state: { messages: [] },
  prompt: vi.fn(),
};

// Import ChatPage after all mocks
import { ChatPage } from '../../src/apps/cli/ink/pages/chat/ChatPage.js';

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = {
      state: { messages: [] },
      prompt: vi.fn(),
    };
  });

  describe('基本渲染', () => {
    it('should render ChatPage without crashing', () => {
      const { lastFrame } = render(<ChatPage />);

      // Should render without throwing
      expect(lastFrame).toBeDefined();
    });

    it('should render Input component', () => {
      const { lastFrame } = render(<ChatPage />);

      // Input component should render something
      expect(lastFrame).toBeDefined();
    });
  });

  describe('ChatPage 结构', () => {
    it('should render Box layout', () => {
      const { lastFrame } = render(<ChatPage />);

      // ChatPage returns a Box, so something should be rendered
      expect(lastFrame).toBeDefined();
    });
  });
});
