import { useState } from 'react';
import { useDebugStore } from './debugStore.js';
import { useInput } from 'ink';

const SCROLL_STEP = 5;
const VISIBLE_LINES = 15;

export function useDebugController() {
  const messages = useDebugStore(state => state.messages);
  const [isVisible, setIsVisible] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const toggle = () => setIsVisible(v => !v);

  // Ctrl+P toggles debug panel
  useInput((input, key) => {
    if (key.ctrl && input === 'p') {
      toggle();
      return;
    }
  });

  // Mouse wheel handler for scrolling
  useInput((_, key) => {
    if (!isVisible) return;

    if ((key as any).wheelUp) {
      setScrollOffset(prev => Math.max(prev - SCROLL_STEP, 0));
    } else if ((key as any).wheelDown) {
      setScrollOffset(prev =>
        Math.min(prev + SCROLL_STEP, Math.max(0, messages.length - VISIBLE_LINES))
      );
    }
  });

  return {
    messages,
    isVisible,
    scrollOffset,
    setScrollOffset,
  };
}
