/**
 * DebugPanel - Self-contained debug panel
 * Usage: addDebugMessage('log line') to add messages
 */
import React, { useReducer, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

interface DebugState {
  visible: boolean;
  messages: string[];
}

type DebugAction =
  | { type: 'TOGGLE' }
  | { type: 'ADD_MESSAGE'; message: string }
  | { type: 'CLEAR' };

function debugReducer(state: DebugState, action: DebugAction): DebugState {
  switch (action.type) {
    case 'TOGGLE':
      return { ...state, visible: !state.visible };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'CLEAR':
      return { ...state, messages: [] };
    default:
      return state;
  }
}

let debugReducerRef: React.Dispatch<DebugAction> | null = null;
let debugVisibleRef = false;

const SCROLL_STEP = 5;
const VISIBLE_LINES = 15;

export function addDebugMessage(msg: string) {
  debugReducerRef?.({ type: 'ADD_MESSAGE', message: msg });
}

export function toggleDebug() {
  debugReducerRef?.({ type: 'TOGGLE' });
}

export function clearDebug() {
  debugReducerRef?.({ type: 'CLEAR' });
}

export function isDebugVisible() {
  return debugVisibleRef;
}

export function DebugPanel() {
  const [state, dispatch] = useReducer(debugReducer, {
    visible: false,
    messages: [],
  });

  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    debugReducerRef = dispatch;
    debugVisibleRef = state.visible;
    return () => {
      debugReducerRef = null;
      debugVisibleRef = false;
    };
  }, [state.visible]);

  // Ctrl+P toggles debug panel
  useInput((input, key) => {
    if (key.ctrl && input === 'p') {
      dispatch({ type: 'TOGGLE' });
      return;
    }
  });

  // Mouse wheel handler for scrolling
  useInput((_, key) => {
    if (!state.visible) return;

    if ((key as any).wheelUp) {
      setScrollOffset(prev => Math.max(prev - SCROLL_STEP, 0));
    } else if ((key as any).wheelDown) {
      setScrollOffset(prev =>
        Math.min(prev + SCROLL_STEP, Math.max(0, state.messages.length - VISIBLE_LINES))
      );
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setScrollOffset(0);
  }, [state.messages.length]);

  if (!state.visible) {
    return (
      <Box>
        <Text color="gray" dimColor>Press Ctrl+P for debug panel</Text>
      </Box>
    );
  }

  const totalLines = state.messages.length;
  const startIdx = Math.max(0, totalLines - VISIBLE_LINES - scrollOffset);
  const endIdx = Math.min(totalLines, startIdx + VISIBLE_LINES);
  const visibleMessages = state.messages.slice(startIdx, endIdx);
  const hasMoreAbove = startIdx > 0;
  const hasMoreBelow = endIdx < totalLines;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text color="gray">━━━ Debug Panel (↑↓ scroll, PgUp/PgDn, Home/End) ━━━</Text>
      </Box>
      <Box flexDirection="column" height={VISIBLE_LINES}>
        {hasMoreAbove && (
          <Text color="cyan">▲ {startIdx} more</Text>
        )}
        {visibleMessages.length === 0 ? (
          <Text color="gray" dimColor>No debug messages</Text>
        ) : (
          visibleMessages.map((msg, i) => (
            <Text key={startIdx + i} color="gray">{msg}</Text>
          ))
        )}
        {hasMoreBelow && (
          <Text color="cyan">▼ {totalLines - endIdx} more</Text>
        )}
      </Box>
    </Box>
  );
}
