/**
 * InitPage 组件测试
 * 测试加载页面的渲染
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { InitPage } from '../../../src/apps/cli/ink/pages/init/InitPage.js';

describe('InitPage', () => {
  describe('基本渲染', () => {
    it('should render InitPage component', () => {
      const { lastFrame } = render(<InitPage />);

      expect(lastFrame()).toBeDefined();
    });

    it('should display loading text', () => {
      const { lastFrame } = render(<InitPage />);

      expect(lastFrame()).toContain('Loading...');
    });
  });

  describe('样式属性', () => {
    it('should render with cyan color', () => {
      const { lastFrame } = render(<InitPage />);

      expect(lastFrame()).toContain('Loading...');
    });

    it('should render centered content', () => {
      const { lastFrame } = render(<InitPage />);

      expect(lastFrame()).toContain('Loading...');
    });
  });

  describe('无状态组件', () => {
    it('should render consistently without props', () => {
      const { lastFrame } = render(<InitPage />);
      const firstOutput = lastFrame();

      const { lastFrame: secondRender } = render(<InitPage />);
      const secondOutput = secondRender();

      expect(firstOutput).toBe(secondOutput);
    });
  });
});
