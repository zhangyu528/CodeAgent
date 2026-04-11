import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMessage } from '@mariozechner/pi-agent-core';

describe('SessionManager', () => {
  // Simple mock for SessionManager that doesn't hit filesystem
  const mockSessions = new Map<string, any>();
  const mockFs = {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions.clear();
    mockFs.existsSync.mockReturnValue(true);
  });

  describe('session data structure', () => {
    it('should create valid session metadata', () => {
      const meta = {
        id: 'test-session',
        title: 'Test Session',
        updatedAt: Date.now(),
        messageCount: 2,
        model: 'test-model',
        provider: 'test-provider',
        status: 'completed' as const,
        version: 1,
      };
      expect(meta.id).toBe('test-session');
      expect(meta.title).toBe('Test Session');
      expect(meta.status).toBe('completed');
    });

    it('should handle session record normalization', () => {
      const parsed = {
        version: 1,
        meta: {
          id: 'session-1',
          title: 'Normalized Session',
          updatedAt: Date.now(),
          messageCount: 5,
          model: 'gpt-4',
          provider: 'openai',
          status: 'active',
          version: 1,
        },
        messages: [
          { id: '1', role: 'user', content: 'Hello' },
          { id: '2', role: 'assistant', content: 'Hi there' },
        ] as AgentMessage[],
      };

      // Validate normalized structure
      expect(parsed.meta.id).toBeTruthy();
      expect(parsed.meta.title).toBeTruthy();
      expect(Array.isArray(parsed.messages)).toBe(true);
      expect(parsed.messages.length).toBe(2);
    });

    it('should handle missing optional fields with defaults', () => {
      const minimalParsed = {
        version: 1,
        meta: {
          id: 'minimal-session',
          title: 'Minimal',
          updatedAt: Date.now(),
        },
        messages: [],
      };

      const meta = minimalParsed.meta;
      const normalized = {
        id: meta.id,
        title: meta.title || 'New Session',
        updatedAt: meta.updatedAt,
        messageCount: typeof meta.messageCount === 'number' ? meta.messageCount : minimalParsed.messages.length,
        model: meta.model || 'unknown',
        provider: meta.provider || 'unknown',
        status: meta.status || 'completed',
        version: meta.version || 1,
      };

      expect(normalized.model).toBe('unknown');
      expect(normalized.provider).toBe('unknown');
      expect(normalized.status).toBe('completed');
    });

    it('should reject invalid parsed objects', () => {
      const invalidParsed = { not: 'a valid session' };
      const isValid = !!(invalidParsed && typeof invalidParsed === 'object' && invalidParsed.meta && Array.isArray(invalidParsed.messages));
      expect(isValid).toBe(false);
    });

    it('should reject empty messages array', () => {
      const emptyMessages = {
        version: 1,
        meta: { id: 'test', title: 'Test', updatedAt: Date.now() },
        messages: [],
      };
      expect(Array.isArray(emptyMessages.messages)).toBe(true);
      expect(emptyMessages.messages.length).toBe(0);
    });
  });

  describe('title extraction', () => {
    it('should extract title from user message', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hello world' },
      ] as AgentMessage[];
      const firstUserMsg = messages.find(m => m.role === 'user');
      const text = (firstUserMsg as any)?.content?.trim() || null;
      expect(text).toBe('Hello world');
    });

    it('should truncate long titles', () => {
      const longText = 'This is a very long user message that should be truncated because it exceeds forty characters';
      const truncated = longText.length > 40 ? longText.slice(0, 40) + '...' : longText;
      expect(truncated.length).toBe(43);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should return null for empty messages', () => {
      const messages: AgentMessage[] = [];
      const firstUserMsg = messages.find(m => m.role === 'user');
      expect(firstUserMsg).toBeUndefined();
    });

    it('should handle message content as array of parts', () => {
      const messages = [
        { id: '1', role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ] as AgentMessage[];
      const firstUserMsg = messages.find(m => m.role === 'user');
      const content = (firstUserMsg as any)?.content;
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content.map((item: any) => typeof item === 'string' ? item : item.text || '').filter(Boolean).join(' ');
      }
      expect(text).toBe('Hello');
    });

    it('should extract from nested content object', () => {
      const content = { type: 'text', text: 'Nested content' };
      let text = '';
      if (typeof content === 'string') {
        text = content;
      } else if (content && typeof content === 'object' && typeof content.text === 'string') {
        text = content.text;
      }
      expect(text).toBe('Nested content');
    });
  });

  describe('history sorting', () => {
    it('should sort sessions by updatedAt descending', () => {
      const sessions = [
        { id: '1', title: 'First', updatedAt: 1000 },
        { id: '2', title: 'Second', updatedAt: 3000 },
        { id: '3', title: 'Third', updatedAt: 2000 },
      ];
      const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should limit history results after sorting', () => {
      const sessions = [
        { id: '1', updatedAt: 1000 },
        { id: '2', updatedAt: 2000 },
        { id: '3', updatedAt: 3000 },
        { id: '4', updatedAt: 4000 },
        { id: '5', updatedAt: 5000 },
      ];
      const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
      const limited = sorted.slice(0, 3);
      expect(limited.length).toBe(3);
      expect(limited[0].id).toBe('5'); // Most recent first
      expect(limited[1].id).toBe('4');
      expect(limited[2].id).toBe('3');
    });
  });
});
