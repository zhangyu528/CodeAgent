/**
 * ScrollableMessageList — overflowToBackbuffer scroll implementation
 *
 * Architecture:
 * - overflowY="scroll" + overflowToBackbuffer={true} + stableScrollback={true}
 * - Completed messages are pushed into terminal scrollback (native scroll, mouse wheel ✅)
 * - scrollTop is controlled via React state → Ink reconciler reads it each frame
 * - Render window: last 150 messages in React, full history in store
 */
import React, { useRef, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage } from '../../pages/types.js';
import { MessageItem } from './MessageItem.js';

interface ScrollableMessageListProps {
  messages: ChatMessage[];
  availableRows: number;
}

const RENDER_WINDOW_SIZE = 150;

export function ScrollableMessageList({ messages, availableRows }: ScrollableMessageListProps) {
  const containerRef = useRef<any>(null);
  // Controlled scrollTop — Ink reconciler reads node.style.scrollTop on every render.
  // Writing to DOM ref is overwritten on next reconcile (style.scrollTop defaults to 0).
  const [scrollTop, setScrollTop] = useState<number | undefined>(undefined);

  // Visible window: last N messages
  const visibleMessages =
    messages.length > RENDER_WINDOW_SIZE ? messages.slice(-RENDER_WINDOW_SIZE) : messages;

  // Sync scrollTop to DOM after Ink reconciliation
  useEffect(() => {
    if (containerRef.current && typeof scrollTop === 'number') {
      try {
        containerRef.current.scrollTop = scrollTop;
      } catch {}
    }
  }, [scrollTop]);

  // Auto-scroll to bottom when new messages arrive and user is at bottom
  const prevLenRef = useRef(0);
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    if (visibleMessages.length > prevLenRef.current) {
      prevLenRef.current = visibleMessages.length;
      if (isAtBottomRef.current) {
        // Large number — Ink clamps to max valid scrollTop
        setScrollTop(Number.MAX_SAFE_INTEGER);
      }
    }
  }, [visibleMessages.length]);

  if (visibleMessages.length === 0) {
    return (
      <Box height={availableRows} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      height={availableRows}
      overflowY="scroll"
      overflowToBackbuffer={true}
      stableScrollback={true}
      scrollTop={scrollTop}
    >
      {visibleMessages.map(msg => (
        <Box key={msg.id} flexGrow={0} flexShrink={0}>
          <MessageItem message={msg} />
        </Box>
      ))}
    </Box>
  );
}
