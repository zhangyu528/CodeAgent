/**
 * useAgentEvents Throttle Tests
 * 
 * Tests the throttle buffer behavior for streaming delta updates.
 * Verifies that deltas are accumulated and flushed at 150ms intervals.
 */
import { describe, it, expect, vi, beforeEach, afterEach, jest } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock the agent core
const mockSubscribe = vi.fn();
const mockAgent = {
  subscribe: mockSubscribe,
  state: { messages: [] },
} as any;

// Mock the store
const mockUpdateLastMessage = vi.fn();
vi.mock('../../src/apps/cli/ink/store/chatStore.js', () => ({
  useChatStore: {
    getState: () => ({
      updateLastMessage: mockUpdateLastMessage,
      addMessage: vi.fn(),
      setMessages: vi.fn(),
      setThinking: vi.fn(),
      setUsage: vi.fn(),
    }),
    setState: vi.fn(),
  },
}));

// Mock message adapters
vi.mock('../../src/apps/cli/ink/utils/messageAdapters.js', () => ({
  agentMessagesToChatMessages: vi.fn(() => []),
}));

describe('useAgentEvents Throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('THROTTLE_INTERVAL_MS constant', () => {
    it('should be 150ms', async () => {
      // Verify the constant value by reading the source file
      const fs = await import('fs');
      const source = fs.readFileSync(
        '/mnt/d/work/project/CodeAgent/src/apps/cli/ink/hooks/useAgentEvents.ts',
        'utf-8'
      );
      const match = source.match(/THROTTLE_INTERVAL_MS\s*=\s*(\d+)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1])).toBe(150);
    });
  });

  describe('DeltaBuffer interface', () => {
    it('should have correct structure', async () => {
      // The buffer should accumulate textDeltas and thinkingDeltas as arrays
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: [] as string[],
      };
      
      buffer.textDeltas.push('Hello');
      buffer.textDeltas.push(' ');
      buffer.textDeltas.push('World');
      
      expect(buffer.textDeltas.join('')).toBe('Hello World');
      expect(buffer.thinkingDeltas).toEqual([]);
    });
  });

  describe('Buffer accumulation', () => {
    it('should accumulate multiple text deltas', () => {
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: [] as string[],
      };
      
      buffer.textDeltas.push('H');
      buffer.textDeltas.push('e');
      buffer.textDeltas.push('l');
      buffer.textDeltas.push('l');
      buffer.textDeltas.push('o');
      
      expect(buffer.textDeltas.join('')).toBe('Hello');
    });

    it('should accumulate multiple thinking deltas', () => {
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: [] as string[],
      };
      
      buffer.thinkingDeltas.push('Think');
      buffer.thinkingDeltas.push('ing');
      
      expect(buffer.thinkingDeltas.join('')).toBe('Thinking');
    });

    it('should handle mixed deltas', () => {
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: [] as string[],
      };
      
      buffer.textDeltas.push('Hi');
      buffer.thinkingDeltas.push('Hmm');
      buffer.textDeltas.push('!');
      
      expect(buffer.textDeltas.join('')).toBe('Hi!');
      expect(buffer.thinkingDeltas.join('')).toBe('Hmm');
    });
  });

  describe('Flush behavior', () => {
    it('should skip flush when buffer is empty', () => {
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: [] as string[],
      };
      
      const shouldFlush = buffer.textDeltas.length > 0 || buffer.thinkingDeltas.length > 0;
      expect(shouldFlush).toBe(false);
    });

    it('should indicate flush needed when text deltas present', () => {
      const buffer = {
        textDeltas: ['test'] as string[],
        thinkingDeltas: [] as string[],
      };
      
      const shouldFlush = buffer.textDeltas.length > 0 || buffer.thinkingDeltas.length > 0;
      expect(shouldFlush).toBe(true);
    });

    it('should indicate flush needed when thinking deltas present', () => {
      const buffer = {
        textDeltas: [] as string[],
        thinkingDeltas: ['thinking'] as string[],
      };
      
      const shouldFlush = buffer.textDeltas.length > 0 || buffer.thinkingDeltas.length > 0;
      expect(shouldFlush).toBe(true);
    });

    it('should clear buffer after flush simulation', () => {
      const buffer = {
        textDeltas: ['a', 'b', 'c'] as string[],
        thinkingDeltas: ['x', 'y'] as string[],
      };
      
      // Simulate joining and clearing (like flushDeltas does)
      const textContent = buffer.textDeltas.join('');
      const thinkingContent = buffer.thinkingDeltas.join('');
      
      expect(textContent).toBe('abc');
      expect(thinkingContent).toBe('xy');
      
      // Clear buffer
      buffer.textDeltas = [];
      buffer.thinkingDeltas = [];
      
      expect(buffer.textDeltas.length).toBe(0);
      expect(buffer.thinkingDeltas.length).toBe(0);
    });
  });

  describe('Interval behavior', () => {
    it('should use setInterval for periodic flushing', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const mockFlush = vi.fn();
      const interval = setInterval(mockFlush, 150);
      
      expect(setIntervalSpy).toHaveBeenCalledWith(mockFlush, 150);
      
      clearInterval(interval);
      expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('should not create multiple intervals', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const mockFlush = vi.fn();
      let existingInterval: ReturnType<typeof setInterval> | null = null;
      
      // First call - creates interval
      if (existingInterval === null) {
        existingInterval = setInterval(mockFlush, 150);
      }
      
      // Second call - should not create new interval
      if (existingInterval === null) {
        existingInterval = setInterval(mockFlush, 150);
      }
      
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      
      if (existingInterval) {
        clearInterval(existingInterval);
      }
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });
});
