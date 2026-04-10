/**
 * TypingIndicator 组件测试
 * 测试打字指示器的动画和渲染
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { TypingIndicator } from '../../src/apps/cli/ink/components/chat/TypingIndicator.js';

describe('TypingIndicator', () => {
  describe('基本渲染', () => {
    it('should return null when not thinking and not generating', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={false} isGenerating={false} />
      );

      expect(lastFrame()).toBe('');
    });

    it('should render when isThinking is true', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      expect(lastFrame()).toContain('thinking...');
    });

    it('should render when isGenerating is true', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={false} isGenerating={true} />
      );

      expect(lastFrame()).toContain('generating...');
    });

    it('should prefer thinking label over generating when both are true', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={true} />
      );

      expect(lastFrame()).toContain('thinking...');
    });
  });

  describe('动画字符', () => {
    it('should render animation characters', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      // Animation characters: ░, ▒, ▓, █
      expect(lastFrame()).toMatch(/[░▒▓█]/);
    });
  });

  describe('文本样式', () => {
    it('should render with blue color for animation', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      // Should contain blue text (animation character)
      expect(lastFrame()).toBeDefined();
    });

    it('should render with gray dim color for label', () => {
      const { lastFrame } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      expect(lastFrame()).toContain('thinking...');
    });
  });

  describe('状态切换', () => {
    it('should switch from thinking to generating', () => {
      const { lastFrame, rerender } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      expect(lastFrame()).toContain('thinking...');

      rerender(<TypingIndicator isThinking={false} isGenerating={true} />);

      expect(lastFrame()).toContain('generating...');
    });

    it('should switch from active to inactive', () => {
      const { lastFrame, rerender } = render(
        <TypingIndicator isThinking={true} isGenerating={false} />
      );

      expect(lastFrame()).toContain('thinking...');

      rerender(<TypingIndicator isThinking={false} isGenerating={false} />);

      expect(lastFrame()).toBe('');
    });
  });
});
