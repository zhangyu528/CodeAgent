/**
 * useKeyboardShortcuts - 全局快捷键处理
 * - Ctrl+C/Ctrl+D: 连续两次才退出（防误触）
 */
import { useRef, useCallback } from 'react';
import { useApp } from 'ink';
import { useAppStore } from './store/uiStore.js';
import { useInput } from 'ink';

export function useKeyboardShortcuts() {
  const { exit } = useApp();
  const showHint = useAppStore(state => state.showHint);
  const hideHint = useAppStore(state => state.hideHint);
  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleExitAttempt = useCallback(() => {
    // 第一次按：显示提示
    if (!exitTimeoutRef.current) {
      showHint();
      exitTimeoutRef.current = setTimeout(() => {
        exitTimeoutRef.current = null;
        hideHint();
      }, 2000);
      return;
    }

    // 第二次按：真正退出
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
      hideHint();
      exit();
    }
  }, [exit, showHint, hideHint]);

  useInput((input, key) => {
    // Exit keys: Ctrl+C / Ctrl+D (need double press)
    if (key.ctrl && (input === 'c' || input === 'd')) {
      handleExitAttempt();
      return;
    }
  });
}
