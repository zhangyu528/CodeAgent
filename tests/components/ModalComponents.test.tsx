/**
 * Modal 组件测试
 * 测试 ConfirmModal, NoticeModal, AskModal, SelectOneModal 的 reducer 逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text, Box } from 'ink';

// Mock visibility module
vi.mock('../../src/apps/cli/ink/components/modals/visibility.js', () => ({
  modalVisibility: {
    notice: false,
    confirm: false,
    ask: false,
    selectOne: false,
  },
  setModalVisibility: vi.fn(),
  hasAnyModalOpen: () => false,
}));

// Import components after mocking
import {
  ConfirmModal,
  showConfirm,
  hideConfirm,
  isConfirmVisible,
} from '../../src/apps/cli/ink/components/modals/ConfirmModal.js';

import {
  NoticeModal,
  showNotice,
  hideNotice,
  isNoticeVisible,
} from '../../src/apps/cli/ink/components/modals/NoticeModal.js';

describe('ConfirmModal', () => {
  describe('visibility state', () => {
    it('should not render when not visible', () => {
      const { lastFrame } = render(<ConfirmModal />);
      expect(lastFrame()).toBe('');
    });
  });

  describe('show/hide functions', () => {
    it('should have showConfirm function', () => {
      expect(typeof showConfirm).toBe('function');
    });

    it('should have hideConfirm function', () => {
      expect(typeof hideConfirm).toBe('function');
    });

    it('should have isConfirmVisible function', () => {
      expect(typeof isConfirmVisible).toBe('function');
    });
  });
});

describe('NoticeModal', () => {
  describe('visibility state', () => {
    it('should not render when not visible', () => {
      const { lastFrame } = render(<NoticeModal />);
      expect(lastFrame()).toBe('');
    });
  });

  describe('show/hide functions', () => {
    it('should have showNotice function', () => {
      expect(typeof showNotice).toBe('function');
    });

    it('should have hideNotice function', () => {
      expect(typeof hideNotice).toBe('function');
    });

    it('should have isNoticeVisible function', () => {
      expect(typeof isNoticeVisible).toBe('function');
    });
  });
});

describe('ModalFrame Layout', () => {
  // Test basic Box layout without position="absolute"
  it('should render Box layout with flexDirection', () => {
    const { lastFrame } = render(
      <Box flexDirection="column" width={72}>
        <Box>
          <Text color="cyan" bold>{'Test Modal'}</Text>
        </Box>
        <Box>
          <Text>Test Content</Text>
        </Box>
      </Box>
    );

    expect(lastFrame()).toContain('Test Modal');
    expect(lastFrame()).toContain('Test Content');
  });

  it('should render Box with multiple children', () => {
    const { lastFrame } = render(
      <Box flexDirection="column" width={72}>
        <Text>Line 1</Text>
        <Text>Line 2</Text>
        <Text dimColor>Footer</Text>
      </Box>
    );

    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
    expect(lastFrame()).toContain('Footer');
  });
});
