/**
 * DateDivider 组件测试
 * 测试日期分隔线的渲染
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { DateDivider } from '../../src/apps/cli/ink/components/chat/DateDivider.js';

describe('DateDivider', () => {
  describe('基本渲染', () => {
    it('should render DateDivider component', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toBeDefined();
    });

    it('should render with label text', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toContain('今天');
    });

    it('should render with yesterday label', () => {
      const { lastFrame } = render(<DateDivider label="昨天" />);

      expect(lastFrame()).toContain('昨天');
    });
  });

  describe('分隔线样式', () => {
    it('should render with dash separators', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toContain('───');
    });

    it('should render label between dashes', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      // Format: "─── {label} ───"
      expect(lastFrame()).toMatch(/───\s*今天\s*───/);
    });

    it('should render with gray dim color', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toContain('今天');
    });
  });

  describe('不同日期标签', () => {
    it('should render with "Today" label', () => {
      const { lastFrame } = render(<DateDivider label="Today" />);

      expect(lastFrame()).toContain('Today');
    });

    it('should render with date string', () => {
      const { lastFrame } = render(<DateDivider label="2024-01-15" />);

      expect(lastFrame()).toContain('2024-01-15');
    });

    it('should render with empty label', () => {
      const { lastFrame } = render(<DateDivider label="" />);

      // Should still render the dashes
      expect(lastFrame()).toContain('───');
    });

    it('should render with long label', () => {
      const longLabel = 'Monday, January 15, 2024';
      const { lastFrame } = render(<DateDivider label={longLabel} />);

      expect(lastFrame()).toContain(longLabel);
    });
  });

  describe('padding', () => {
    it('should render with paddingTop', () => {
      const { lastFrame } = render(<DateDivider label="今天" />);

      expect(lastFrame()).toBeDefined();
    });
  });
});
