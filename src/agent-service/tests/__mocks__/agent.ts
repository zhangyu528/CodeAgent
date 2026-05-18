import { vi } from 'vitest';

// Mock AgentSession
export const mockAgentSession = {
  sessionId: 'test-session-id',
  sessionName: 'Test Session',
  sessionFile: '/test/session.jsonl',
  cwd: '/test',
  messages: [],

  prompt: vi.fn().mockResolvedValue(undefined),
  switchSession: vi.fn().mockResolvedValue(undefined),
  getSessionStats: vi.fn().mockReturnValue({
    totalMessages: 10,
    totalTokens: 1000,
  }),
  getContextUsage: vi.fn().mockReturnValue({
    tokens: 500,
    contextWindow: 100000,
    percent: 0.5,
  }),
  subscribe: vi.fn().mockReturnValue(() => {}),
  setModel: vi.fn().mockResolvedValue(undefined),
  compact: vi.fn().mockResolvedValue(undefined),
  setAutoCompactionEnabled: vi.fn(),
  getAutoCompactionEnabled: vi.fn().mockReturnValue(false),
  isCompacting: vi.fn().mockReturnValue(false),
  abort: vi.fn(),
  getSessionId: vi.fn().mockReturnValue('test-session-id'),
  getSessionName: vi.fn().mockReturnValue('Test Session'),
};

// Mock SessionManager
export const mockSessionManager = {
  appendSessionInfo: vi.fn(),
  getSessionInfo: vi.fn().mockReturnValue({
    id: 'test-id',
    name: 'Test',
    cwd: '/test',
  }),
};

// Mock createAgentSession
export const createAgentSessionMock = vi.fn().mockResolvedValue({
  session: mockAgentSession,
  modelFallbackMessage: null,
});

// Mock SessionManager static methods
export const SessionManagerMock = {
  open: vi.fn().mockReturnValue(mockSessionManager),
  listAll: vi.fn().mockResolvedValue([]),
};

// Mock coding tools
export const codingToolsMock = [];
export const findToolMock = { name: 'find', description: 'Find files' };
export const grepToolMock = { name: 'grep', description: 'Grep search' };
export const lsToolMock = { name: 'ls', description: 'List directory' };