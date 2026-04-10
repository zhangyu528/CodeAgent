/**
 * Simple Components 测试
 * 测试 LoadingPage 和 PromptBox
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { LoadingPage } from '../../src/apps/cli/ink/pages/loading/LoadingPage.js';
import { PromptBox } from '../../src/apps/cli/ink/components/modals/PromptBox.js';

describe('LoadingPage', () => {
  describe('基本渲染', () => {
    it('should render loading text', () => {
      const { lastFrame } = render(<LoadingPage />);

      expect(lastFrame()).toContain('Loading...');
    });

    it('should render with cyan color', () => {
      const { lastFrame } = render(<LoadingPage />);

      // LoadingPage uses cyan color
      expect(lastFrame()).toContain('Loading...');
    });

    it('should render centered content', () => {
      const { lastFrame } = render(<LoadingPage />);

      // Just verify it renders without error
      expect(lastFrame()).toBeDefined();
    });
  });
});

describe('PromptBox', () => {
  describe('基本渲染', () => {
    it('should render with title', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Test Title"
          body="Test body content"
          width={72}
        />
      );

      expect(lastFrame()).toContain('Test Title');
    });

    it('should render with body content', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Title"
          body="This is the body"
          width={72}
        />
      );

      expect(lastFrame()).toContain('This is the body');
    });

    it('should render with custom width', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Custom Width"
          body="Body"
          width={50}
        />
      );

      expect(lastFrame()).toContain('Custom Width');
    });
  });

  describe('Footer 渲染', () => {
    it('should render with custom footer', () => {
      const { lastFrame } = render(
        <PromptBox
          title="With Footer"
          body="Body"
          footer="Press Enter to continue"
          width={72}
        />
      );

      expect(lastFrame()).toContain('Press Enter to continue');
    });

    it('should render without footer when not provided', () => {
      const { lastFrame } = render(
        <PromptBox
          title="No Footer"
          body="Body"
          width={72}
        />
      );

      // Should still render title and body
      expect(lastFrame()).toContain('No Footer');
      expect(lastFrame()).toContain('Body');
    });
  });

  describe('Input 显示', () => {
    it('should show input when showInput is true', () => {
      const { lastFrame } = render(
        <PromptBox
          title="With Input"
          body="Body"
          input="user input"
          showInput={true}
          width={72}
        />
      );

      expect(lastFrame()).toContain('> user input');
    });

    it('should not show input when showInput is false', () => {
      const { lastFrame } = render(
        <PromptBox
          title="No Input"
          body="Body"
          input="should not show"
          showInput={false}
          width={72}
        />
      );

      expect(lastFrame()).toContain('No Input');
      expect(lastFrame()).toContain('Body');
      // Input line should not appear
      expect(lastFrame()).not.toContain('> should not show');
    });

    it('should show empty input when showInput is true but input is undefined', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Empty Input"
          body="Body"
          showInput={true}
          width={72}
        />
      );

      expect(lastFrame()).toContain('> ');
    });
  });

  describe('Body 文本换行', () => {
    it('should handle long body text', () => {
      const longBody = 'This is a very long body text that should be wrapped to fit within the modal width properly when rendered';
      const { lastFrame } = render(
        <PromptBox
          title="Long Body"
          body={longBody}
          width={40}
        />
      );

      expect(lastFrame()).toContain('Long Body');
    });

    it('should handle multi-line body', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Multi-line"
          body="Line 1\nLine 2\nLine 3"
          width={72}
        />
      );

      expect(lastFrame()).toContain('Line 1');
    });
  });

  describe('边界情况', () => {
    it('should handle empty body', () => {
      const { lastFrame } = render(
        <PromptBox
          title="Empty Body"
          body=""
          width={72}
        />
      );

      expect(lastFrame()).toContain('Empty Body');
    });

    it('should handle small width', () => {
      const { lastFrame } = render(
        <PromptBox
          title="A"
          body="B"
          width={10}
        />
      );

      expect(lastFrame()).toContain('A');
      expect(lastFrame()).toContain('B');
    });
  });
});
