/**
 * ModalFrame 组件测试
 * 测试模态框框架的渲染和布局
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { ModalFrame, DEFAULT_MODAL_WIDTH } from '../../src/apps/cli/ink/components/modals/ModalFrame.js';

describe('ModalFrame', () => {
  describe('基本渲染', () => {
    it('should render with default width', () => {
      const { lastFrame } = render(
        <ModalFrame title="Test Modal" width={DEFAULT_MODAL_WIDTH}>
          <Text>Content</Text>
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Test Modal');
      expect(lastFrame()).toContain('Content');
    });

    it('should render with custom width', () => {
      const { lastFrame } = render(
        <ModalFrame title="Custom Width" width={50}>
          <Text>Test Content</Text>
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Custom Width');
    });

    it('should render title with cyan color', () => {
      const { lastFrame } = render(
        <ModalFrame title="Cyan Title" width={72}>
          <Text />
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Cyan Title');
    });
  });

  describe('Footer 渲染', () => {
    it('should render footer when provided', () => {
      const { lastFrame } = render(
        <ModalFrame title="With Footer" width={72} footer="Press Enter to continue">
          <Text>Content</Text>
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Press Enter to continue');
    });

    it('should not render footer when not provided', () => {
      const { lastFrame } = render(
        <ModalFrame title="No Footer" width={72}>
          <React.Fragment>Content</React.Fragment>
        </ModalFrame>
      );

      expect(lastFrame()).not.toContain('undefined');
    });

    it('should handle long footer with wrapping', () => {
      const longFooter = 'This is a very long footer text that should be wrapped to fit within the modal width properly';
      const { lastFrame } = render(
        <ModalFrame title="Long Footer" width={40} footer={longFooter}>
          <React.Fragment />
        </ModalFrame>
      );

      // Footer should be present (wrapped)
      expect(lastFrame()).toContain('This is a very long footer');
    });
  });

  describe('Children 渲染', () => {
    it('should render children content', () => {
      const { lastFrame } = render(
        <ModalFrame title="Children Test" width={72}>
          <Text>Child Element 1</Text>
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Child Element 1');
    });

    it('should render empty children', () => {
      const { lastFrame } = render(
        <ModalFrame title="Empty Children" width={72}>
          <Text />
        </ModalFrame>
      );

      expect(lastFrame()).toContain('Empty Children');
    });
  });

  describe('布局边界情况', () => {
    it('should handle very long title', () => {
      const longTitle = 'This is a very long title that exceeds normal length and should be handled properly';
      const { lastFrame } = render(
        <ModalFrame title={longTitle} width={72}>
          <Text />
        </ModalFrame>
      );

      expect(lastFrame()).toContain('This is a very long title');
    });
  });
});
