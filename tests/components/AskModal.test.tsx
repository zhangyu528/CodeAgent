/**
 * AskModal 组件测试
 * 测试询问模态框的 reducer 和渲染
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock visibility module
vi.mock('../../src/apps/cli/ink/components/modals/visibility.js', () => ({
  modalVisibility: { ask: false },
  setModalVisibility: vi.fn(),
}));

// Mock ModalFrame
vi.mock('../../src/apps/cli/ink/components/modals/ModalFrame.js', () => ({
  ModalFrame: ({ title, width, footer, children }: any) => (
    <div data-testid="modal-frame">
      Title: {title} | Width: {width}
      {children}
      Footer: {footer}
    </div>
  ),
}));

// Mock textLayout
vi.mock('../../src/apps/cli/ink/components/modals/textLayout.js', () => ({
  padToWidth: (text: string, _width: number) => text,
  wrapToWidth: (text: string, _width: number) => [text],
}));

import {
  AskModal,
  showAsk,
  hideAsk,
  isAskVisible,
} from '../../src/apps/cli/ink/components/modals/AskModal.js';

describe('AskModal', () => {
  describe('基本渲染', () => {
    it('should not render when not visible', () => {
      const { lastFrame } = render(<AskModal />);

      expect(lastFrame()).toBe('');
    });
  });

  describe('导出函数', () => {
    it('should export showAsk function', () => {
      expect(showAsk).toBeDefined();
      expect(typeof showAsk).toBe('function');
    });

    it('should export hideAsk function', () => {
      expect(hideAsk).toBeDefined();
      expect(typeof hideAsk).toBe('function');
    });

    it('should export isAskVisible function', () => {
      expect(isAskVisible).toBeDefined();
      expect(typeof isAskVisible).toBe('function');
    });
  });

  describe('组件导出', () => {
    it('should export AskModal component', () => {
      expect(AskModal).toBeDefined();
      expect(typeof AskModal).toBe('function');
    });
  });
});
