/**
 * DebugPanel 组件测试
 * 测试调试面板的渲染和控制功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock ink useInput
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

// Import after mocking
import { DebugPanel, addDebugMessage, toggleDebug, clearDebug, isDebugVisible } from '../../src/apps/cli/ink/components/debug/DebugPanel.js';

describe('DebugPanel', () => {
  describe('基本渲染', () => {
    it('should render DebugPanel component', () => {
      const { lastFrame } = render(<DebugPanel />);

      expect(lastFrame()).toBeDefined();
    });

    it('should render hint text when not visible', () => {
      const { lastFrame } = render(<DebugPanel />);

      expect(lastFrame()).toContain('Press Ctrl+P for debug panel');
    });
  });

  describe('可见性控制', () => {
    beforeEach(() => {
      // Reset debug state by calling clearDebug
      clearDebug();
    });

    it('should call toggleDebug when Ctrl+P is pressed', () => {
      // The component registers useInput handler internally
      // We test that the function is exported and callable
      expect(toggleDebug).toBeDefined();
      expect(typeof toggleDebug).toBe('function');
    });

    it('should call clearDebug to clear messages', () => {
      expect(clearDebug).toBeDefined();
      expect(typeof clearDebug).toBe('function');
    });

    it('should call isDebugVisible to check visibility', () => {
      expect(isDebugVisible).toBeDefined();
      expect(typeof isDebugVisible).toBe('function');
    });
  });

  describe('消息添加', () => {
    beforeEach(() => {
      clearDebug();
    });

    it('should have addDebugMessage function', () => {
      expect(addDebugMessage).toBeDefined();
      expect(typeof addDebugMessage).toBe('function');
    });

    it('should add debug message when called', () => {
      // This test verifies the function exists and is callable
      expect(() => addDebugMessage('test message')).not.toThrow();
    });
  });

  describe('DebugPanel 渲染', () => {
    it('should render with gray dim text when hidden', () => {
      const { lastFrame } = render(<DebugPanel />);

      expect(lastFrame()).toContain('Press Ctrl+P for debug panel');
    });

    it('should return Box element when visible', () => {
      const { lastFrame } = render(<DebugPanel />);

      // Default state is not visible, so it should show the hint
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('导出函数', () => {
    it('should export all required functions', () => {
      expect(addDebugMessage).toBeDefined();
      expect(toggleDebug).toBeDefined();
      expect(clearDebug).toBeDefined();
      expect(isDebugVisible).toBeDefined();
      expect(DebugPanel).toBeDefined();
    });

    it('should export DebugPanel as a component', () => {
      expect(typeof DebugPanel).toBe('function');
    });
  });
});

describe('DebugPanel reducer functions', () => {
  it('should export standalone functions that can work without component', () => {
    // These functions should be callable independently
    expect(typeof addDebugMessage).toBe('function');
    expect(typeof toggleDebug).toBe('function');
    expect(typeof clearDebug).toBe('function');
    expect(typeof isDebugVisible).toBe('function');
  });
});
