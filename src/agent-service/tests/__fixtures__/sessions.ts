import { tmpdir } from 'os';
import { join } from 'path';

// Test directories
export const TEST_AGENT_DIR = join(tmpdir(), 'codeagent-test-' + Date.now());
export const SESSIONS_DIR = join(TEST_AGENT_DIR, 'sessions');
export const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
export const PROJECT_DIR = join(SESSIONS_DIR, '--D--work-project-Test--');
export const PROJECT_DIR_2 = join(SESSIONS_DIR, '--D--work-project-CodeAgent--');

export const GLOBAL_SESSION_FILE = join(GLOBAL_DIR, '1778830744809_global.jsonl');
export const PROJECT_SESSION_FILE = join(PROJECT_DIR, '1778830744809_project.jsonl');
export const PROJECT_SESSION_FILE_2 = join(PROJECT_DIR_2, '1778830744809_codeagent.jsonl');

// Session headers
export const GLOBAL_SESSION_HEADER = {
  id: 'global1',
  type: 'session',
  version: 2,
  timestamp: 1778830744809,
  name: 'Global Session',
  cwd: '',
};

export const PROJECT_SESSION_HEADER = {
  id: 'project1',
  type: 'session',
  version: 2,
  timestamp: 1778830744809,
  name: 'Project Session',
  cwd: 'D:\\work\\project\\Test',
};

// Sample messages
export const SAMPLE_MESSAGES = [
  {
    role: 'user',
    content: [{ type: 'text', text: '你好' }],
    timestamp: 1777809646048,
  },
  {
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: '用户用中文打招呼，我应该用中文回复。' },
      { type: 'text', text: '你好！有什么我可以帮你的吗？' },
    ],
    timestamp: 1777809646108,
    api: 'anthropic-messages',
    provider: 'minimax-cn',
    model: 'MiniMax-M2.7',
    stopReason: 'stop',
    responseId: 'resp1',
  },
];

export const SAMPLE_MESSAGES_LONG = [
  ...SAMPLE_MESSAGES,
  {
    role: 'user',
    content: [{ type: 'text', text: '分析下当前项目' }],
    timestamp: 1778295186004,
  },
  {
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: '用户想要分析当前项目。' },
      { type: 'toolCall', id: 'call1', name: 'ls', arguments: { path: '.' } },
    ],
    timestamp: 1778295186063,
    stopReason: 'toolUse',
  },
  {
    role: 'tool',
    toolCallId: 'call1',
    toolName: 'ls',
    content: [
      { type: 'text', text: '.git\npackage.json\nsrc\ntests' },
    ],
    isError: false,
    timestamp: 1778295189217,
  },
];

// Test project paths
export const TEST_PROJECT_PATH = 'D:\\work\\project\\Test';
export const TEST_PROJECT_PATH_2 = 'D:\\work\\project\\CodeAgent';
export const TEST_PROJECT_NAME = 'Test';
export const TEST_PROJECT_NAME_2 = 'CodeAgent';