import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import readline from 'readline';

interface DebugPanelProps {
  messages: string[];
  isVisible: boolean;
}

const VISIBLE_LINES = 15;
const SCROLL_STEP = 5;

export function DebugPanel({ messages, isVisible }: DebugPanelProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const isScrollingRef = useRef(false);

  // Keyboard handler for scrolling
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyPress = (_: string, key: { name: string }) => {
      if (key.name === 'up') {
        setScrollOffset(prev => Math.min(prev + SCROLL_STEP, Math.max(0, messages.length - VISIBLE_LINES)));
        isScrollingRef.current = true;
      } else if (key.name === 'down') {
        setScrollOffset(prev => Math.max(prev - SCROLL_STEP, 0));
        isScrollingRef.current = true;
      } else if (key.name === 'pageup') {
        setScrollOffset(prev => Math.min(prev + VISIBLE_LINES, Math.max(0, messages.length - VISIBLE_LINES)));
        isScrollingRef.current = true;
      } else if (key.name === 'pagedown') {
        setScrollOffset(prev => Math.max(prev - VISIBLE_LINES, 0));
        isScrollingRef.current = true;
      } else if (key.name === 'home') {
        setScrollOffset(Math.max(0, messages.length - VISIBLE_LINES));
        isScrollingRef.current = true;
      } else if (key.name === 'end') {
        setScrollOffset(0);
        isScrollingRef.current = true;
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.on('keypress', handleKeyPress);

    return () => {
      process.stdin.off('keypress', handleKeyPress);
    };
  }, [isVisible, messages.length]);

  // Auto-scroll to bottom when new messages arrive (if not manually scrolling)
  useEffect(() => {
    if (!isScrollingRef.current) {
      setScrollOffset(0);
    }
  }, [messages.length]);

  if (!isVisible) {
    return (
      <Box>
        <Text color="gray" dimColor>Press Ctrl+P for debug panel</Text>
      </Box>
    );
  }

  const totalLines = messages.length;
  const startIdx = Math.max(0, totalLines - VISIBLE_LINES - scrollOffset);
  const endIdx = Math.min(totalLines, startIdx + VISIBLE_LINES);
  const visibleMessages = messages.slice(startIdx, endIdx);
  const hasMoreAbove = startIdx > 0;
  const hasMoreBelow = endIdx < totalLines;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text color="gray">━━━ Debug Panel (↑↓ scroll, PgUp/PgDn, Home/End) ━━━</Text>
      </Box>
      <Box flexDirection="column" maxHeight={VISIBLE_LINES}>
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
