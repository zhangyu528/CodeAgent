import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useDebugController } from './useDebugController.js';

const VISIBLE_LINES = 15;

export function DebugPanel() {
  const { messages, isVisible, scrollOffset, setScrollOffset } = useDebugController();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setScrollOffset(0);
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
