/**
 * Input 组件测试
 * 测试输入组件的组合和状态显示
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text, Box } from 'ink';

// Mock dependencies - using actual ink components for proper rendering
vi.mock('../../src/apps/cli/ink/components/inputs/InputField.js', () => ({
  InputField: ({ value, placeholder, isCommandMode }: any) => (
    <Text>
      InputField: {placeholder} | value: {value} | command: {String(isCommandMode)}
    </Text>
  ),
}));

vi.mock('../../src/apps/cli/ink/components/inputs/SlashList.js', () => ({
  SlashList: ({ inputValue, setInputValue }: any) => (
    <Text>SlashList</Text>
  ),
}));

vi.mock('../../src/apps/cli/ink/components/inputs/InputController.js', () => ({
  useInput: vi.fn(() => ({
    value: '',
    setValue: vi.fn(),
    isExitHint: false,
    isWelcome: true,
    modelLabel: 'gpt-4',
    cwdLabel: '/test',
  })),
}));

import { Input } from '../../src/apps/cli/ink/components/inputs/input.js';

describe('Input', () => {
  describe('基本渲染', () => {
    it('should render Input component', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toBeDefined();
    });

    it('should render SlashList component', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('SlashList');
    });

    it('should render InputField component', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('InputField');
    });
  });

  describe('状态显示', () => {
    it('should display Model label', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('Model:');
    });

    it('should display model name when configured', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('gpt-4');
    });

    it('should display CWD label', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('CWD:');
    });
  });

  describe('命令模式', () => {
    it('should render in command mode indicator', () => {
      // The SlashList is shown when in command mode
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toContain('SlashList');
    });
  });

  describe('无状态组件', () => {
    it('should render without crashing', () => {
      const { lastFrame } = render(<Input />);

      expect(lastFrame()).toBeDefined();
    });
  });
});
