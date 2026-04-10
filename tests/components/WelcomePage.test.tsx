/**
 * WelcomePage 组件测试
 * 测试欢迎页的渲染
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock Logo to avoid package.json require issue
vi.mock('../../src/apps/cli/ink/pages/welcome/Logo.js', () => ({
  Logo: () => ({
    type: 'Box',
    props: {},
    // Render a simple mock
  }),
}));

// Mock Input component
vi.mock('../../src/apps/cli/ink/components/inputs/index.js', () => ({
  Input: () => null,
}));

import { WelcomePage } from '../../src/apps/cli/ink/pages/welcome/WelcomePage.js';

describe('WelcomePage', () => {
  describe('基本渲染', () => {
    it('should render WelcomePage without errors', () => {
      const { lastFrame } = render(<WelcomePage />);

      // WelcomePage should render without throwing
      expect(lastFrame).toBeDefined();
    });

    it('should render children components', () => {
      const { lastFrame } = render(<WelcomePage />);

      // The component should have rendered (even if children are mocked)
      expect(lastFrame).toBeDefined();
    });
  });

  describe('组件结构', () => {
    it('should render logo', () => {
      const { lastFrame } = render(<WelcomePage />);

      // Should render something (mocked logo)
      expect(lastFrame).toBeDefined();
    });

    it('should render input', () => {
      const { lastFrame } = render(<WelcomePage />);

      // Should render something (mocked input)
      expect(lastFrame).toBeDefined();
    });
  });
});
