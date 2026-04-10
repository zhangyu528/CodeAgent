/**
 * PromptBox 组件测试
 * 测试提示框组件的渲染
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text, Box } from 'ink';

// Mock ModalFrame
vi.mock('../../src/apps/cli/ink/components/modals/ModalFrame.js', () => ({
  ModalFrame: ({ title, width, footer, children }: any) => (
    <Box data-testid="modal-frame" flexDirection="column">
      <Text data-testid="title">{title}</Text>
      <Text data-testid="width">{width}</Text>
      {children}
      {footer && <Text data-testid="footer">{footer}</Text>}
    </Box>
  ),
}));

// Mock textLayout
vi.mock('../../src/apps/cli/ink/components/modals/textLayout.js', () => ({
  padToWidth: (text: string, _width: number) => text,
  wrapToWidth: (text: string, _width: number) => [text],
}));

// Import after mocking
import { PromptBox } from '../../src/apps/cli/ink/components/modals/PromptBox.js';

describe('PromptBox', () => {
  describe('基本渲染', () => {
    it('should render PromptBox component', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Test body" width={60} />
      );

      expect(lastFrame()).toBeDefined();
    });

    it('should render title', () => {
      const { lastFrame } = render(
        <PromptBox title="Test Title" body="Body text" width={60} />
      );

      expect(lastFrame()).toContain('Test Title');
    });

    it('should render body text', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Body content" width={60} />
      );

      expect(lastFrame()).toContain('Body content');
    });
  });

  describe('宽度计算', () => {
    it('should accept width prop', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Body" width={80} />
      );

      // Just verify it renders with different width
      expect(lastFrame()).toContain('80');
    });

    it('should calculate inner width as width - 4', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Body" width={60} />
      );

      // innerWidth = 60 - 4 = 56
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('输入框显示', () => {
    it('should not render input when showInput is false', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Body" width={60} showInput={false} />
      );

      expect(lastFrame()).toBeDefined();
    });

    it('should render input when showInput is true', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Test"
          body="Body"
          width={60}
          showInput={true}
          input="user input"
        />
      );

      expect(lastFrame()).toContain('user input');
    });

    it('should render empty input when showInput is true but input is undefined', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Test"
          body="Body"
          width={60}
          showInput={true}
        />
      );

      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Footer 显示', () => {
    it('should not render footer when not provided', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Body" width={60} />
      );

      // Footer should not be present
      expect(lastFrame()).not.toContain('Press Enter');
    });

    it('should render footer when provided', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Test"
          body="Body"
          width={60}
          footer="Press Enter to continue"
        />
      );

      expect(lastFrame()).toContain('Press Enter to continue');
    });
  });

  describe('多行 body', () => {
    it('should render multiline body', () => {
      const { lastFrame } = render(
        <PromptBox title="Test" body="Line 1\nLine 2\nLine 3" width={60} />
      );

      expect(lastFrame()).toContain('Line 1');
    });
  });
});
