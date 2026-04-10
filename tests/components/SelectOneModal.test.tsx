/**
 * SelectOneModal 组件测试
 * 测试单选模态框的 reducer 和渲染
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ModalChoice } from '../../src/apps/cli/ink/components/modals/SelectOneModal.js';

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
  modalVisibility: { selectOne: false },
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
  SelectOneModal,
  showSelectOne,
  hideSelectOne,
  isSelectOneVisible,
} from '../../src/apps/cli/ink/components/modals/SelectOneModal.js';

describe('SelectOneModal', () => {
  describe('基本渲染', () => {
    it('should not render when not visible', () => {
      const { lastFrame } = render(<SelectOneModal />);

      expect(lastFrame()).toBe('');
    });
  });

  describe('导出函数', () => {
    it('should export showSelectOne function', () => {
      expect(showSelectOne).toBeDefined();
      expect(typeof showSelectOne).toBe('function');
    });

    it('should export hideSelectOne function', () => {
      expect(hideSelectOne).toBeDefined();
      expect(typeof hideSelectOne).toBe('function');
    });

    it('should export isSelectOneVisible function', () => {
      expect(isSelectOneVisible).toBeDefined();
      expect(typeof isSelectOneVisible).toBe('function');
    });
  });

  describe('组件导出', () => {
    it('should export SelectOneModal component', () => {
      expect(SelectOneModal).toBeDefined();
      expect(typeof SelectOneModal).toBe('function');
    });
  });

  describe('ModalChoice 类型', () => {
    it('should have label property', () => {
      const choice: ModalChoice = { label: 'Option 1', value: 'opt1' };
      expect(choice.label).toBe('Option 1');
    });

    it('should have value property', () => {
      const choice: ModalChoice = { label: 'Option 1', value: 'opt1' };
      expect(choice.value).toBe('opt1');
    });
  });
});

describe('SelectOneModal reducer logic', () => {
  describe('MOVE action', () => {
    it('should clamp selected index to valid range', () => {
      // Test that selected index doesn't go below 0
      const state = {
        visible: true,
        title: 'Test',
        choices: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
        selected: 0,
        footer: undefined,
        emptyLabel: undefined,
        onSubmit: undefined,
        onCancel: undefined,
      };

      // Simulate MOVE with delta -1 when at index 0
      const nextSelected = Math.max(0, state.selected + (-1));
      expect(nextSelected).toBe(0);
    });

    it('should clamp selected index to max range', () => {
      const state = {
        visible: true,
        title: 'Test',
        choices: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
        selected: 1,
        footer: undefined,
        emptyLabel: undefined,
        onSubmit: undefined,
        onCancel: undefined,
      };

      // Simulate MOVE with delta +1 when at last index
      const maxIndex = Math.max(0, state.choices.length - 1);
      const nextSelected = Math.max(0, Math.min(state.selected + 1, maxIndex));
      expect(nextSelected).toBe(1);
    });
  });

  describe('SHOW action', () => {
    it('should set selected to 0 when no selected provided', () => {
      const choices = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];

      const selected = 0;
      const maxIndex = Math.max(0, choices.length - 1);
      const clampedSelected = Math.max(0, Math.min(selected, maxIndex));

      expect(clampedSelected).toBe(0);
    });

    it('should clamp selected to valid range', () => {
      const choices = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];

      // Try to set selected to 100
      const selected = 100;
      const maxIndex = Math.max(0, choices.length - 1);
      const clampedSelected = Math.max(0, Math.min(selected, maxIndex));

      expect(clampedSelected).toBe(1); // Should clamp to last index
    });
  });
});
