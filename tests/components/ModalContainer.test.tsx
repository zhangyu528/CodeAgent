/**
 * ModalContainer 组件测试
 * 测试模态框容器的渲染
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock all modal components
vi.mock('../../src/apps/cli/ink/components/modals/NoticeModal.js', () => ({
  NoticeModal: () => null,
}));

vi.mock('../../src/apps/cli/ink/components/modals/ConfirmModal.js', () => ({
  ConfirmModal: () => null,
}));

vi.mock('../../src/apps/cli/ink/components/modals/AskModal.js', () => ({
  AskModal: () => null,
}));

vi.mock('../../src/apps/cli/ink/components/modals/SelectOneModal.js', () => ({
  SelectOneModal: () => null,
}));

// Import after mocking
import { ModalContainer } from '../../src/apps/cli/ink/components/modals/ModalContainer.js';

describe('ModalContainer', () => {
  describe('基本渲染', () => {
    it('should render ModalContainer component', () => {
      const { lastFrame } = render(<ModalContainer />);

      expect(lastFrame()).toBeDefined();
    });

    it('should render without crashing', () => {
      const { lastFrame } = render(<ModalContainer />);

      // Should render empty fragment (all modals are invisible by default)
      expect(lastFrame()).toBe('');
    });
  });

  describe('子组件渲染', () => {
    it('should render all modals (render without error)', () => {
      // All modals are rendered by ModalContainer
      // The test verifies the container doesn't throw
      const { lastFrame } = render(<ModalContainer />);
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('无状态组件', () => {
    it('should render consistently without props', () => {
      const { lastFrame: first } = render(<ModalContainer />);
      const { lastFrame: second } = render(<ModalContainer />);

      expect(first()).toBe(second());
    });
  });
});
