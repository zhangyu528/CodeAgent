/**
 * visibility.ts 测试
 * 测试模态框可见性状态管理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uiStore
vi.mock('../../src/apps/cli/ink/store/uiStore.js', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      hasModalOpen: false,
      setHasModalOpen: vi.fn(),
    })),
  },
}));

// We need to import after mocking
import {
  modalVisibility,
  setModalVisibility,
  hasAnyModalOpen,
} from '../../src/apps/cli/ink/components/modals/visibility.js';

describe('visibility', () => {
  describe('modalVisibility', () => {
    it('should have notice property', () => {
      expect(modalVisibility.notice).toBeDefined();
    });

    it('should have confirm property', () => {
      expect(modalVisibility.confirm).toBeDefined();
    });

    it('should have ask property', () => {
      expect(modalVisibility.ask).toBeDefined();
    });

    it('should have selectOne property', () => {
      expect(modalVisibility.selectOne).toBeDefined();
    });

    it('should initialize all modals as not visible', () => {
      expect(modalVisibility.notice).toBe(false);
      expect(modalVisibility.confirm).toBe(false);
      expect(modalVisibility.ask).toBe(false);
      expect(modalVisibility.selectOne).toBe(false);
    });
  });

  describe('setModalVisibility', () => {
    beforeEach(() => {
      // Reset all modal visibility to false
      modalVisibility.notice = false;
      modalVisibility.confirm = false;
      modalVisibility.ask = false;
      modalVisibility.selectOne = false;
    });

    it('should set notice visibility', () => {
      setModalVisibility('notice', true);
      expect(modalVisibility.notice).toBe(true);

      setModalVisibility('notice', false);
      expect(modalVisibility.notice).toBe(false);
    });

    it('should set confirm visibility', () => {
      setModalVisibility('confirm', true);
      expect(modalVisibility.confirm).toBe(true);

      setModalVisibility('confirm', false);
      expect(modalVisibility.confirm).toBe(false);
    });

    it('should set ask visibility', () => {
      setModalVisibility('ask', true);
      expect(modalVisibility.ask).toBe(true);

      setModalVisibility('ask', false);
      expect(modalVisibility.ask).toBe(false);
    });

    it('should set selectOne visibility', () => {
      setModalVisibility('selectOne', true);
      expect(modalVisibility.selectOne).toBe(true);

      setModalVisibility('selectOne', false);
      expect(modalVisibility.selectOne).toBe(false);
    });
  });

  describe('hasAnyModalOpen', () => {
    beforeEach(() => {
      // Reset all modal visibility to false
      modalVisibility.notice = false;
      modalVisibility.confirm = false;
      modalVisibility.ask = false;
      modalVisibility.selectOne = false;
    });

    it('should return false when no modal is open', () => {
      expect(hasAnyModalOpen()).toBe(false);
    });

    it('should return true when notice is open', () => {
      modalVisibility.notice = true;
      expect(hasAnyModalOpen()).toBe(true);
    });

    it('should return true when confirm is open', () => {
      modalVisibility.confirm = true;
      expect(hasAnyModalOpen()).toBe(true);
    });

    it('should return true when ask is open', () => {
      modalVisibility.ask = true;
      expect(hasAnyModalOpen()).toBe(true);
    });

    it('should return true when selectOne is open', () => {
      modalVisibility.selectOne = true;
      expect(hasAnyModalOpen()).toBe(true);
    });

    it('should return true when multiple modals are open', () => {
      modalVisibility.notice = true;
      modalVisibility.confirm = true;
      modalVisibility.ask = true;
      modalVisibility.selectOne = true;
      expect(hasAnyModalOpen()).toBe(true);
    });

    it('should return false after closing all modals', () => {
      modalVisibility.notice = true;
      modalVisibility.confirm = true;
      modalVisibility.notice = false;
      modalVisibility.confirm = false;
      expect(hasAnyModalOpen()).toBe(false);
    });
  });
});
