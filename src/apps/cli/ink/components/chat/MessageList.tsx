import React, { useRef, useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ScrollView, ScrollViewRef } from 'ink-scroll-view';
import { ChatMessage, ChatMessageRole } from '../../pages/types.js';
import { DateDivider } from './DateDivider.js';

interface MessageListProps {
  messages: ChatMessage[];
  scrollEnabled?: boolean;
  availableRows: number;
  isModalOpen?: boolean;
}

type DateGroup = {
  dateLabel: string;
  dateTimestamp: number;
  messages: ChatMessage[];
};

function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return '今天';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return '昨天';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function groupMessagesByDate(messages: ChatMessage[]): DateGroup[] {
  const groups: Map<string, DateGroup> = new Map();

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        dateLabel: formatDateLabel(message.createdAt),
        dateTimestamp: message.createdAt,
        messages: [],
      });
    }
    groups.get(dateKey)!.messages.push(message);
  }

  return Array.from(groups.values()).sort((a, b) => a.dateTimestamp - b.dateTimestamp);
}

function roleColor(role: ChatMessageRole): string {
  switch (role) {
    case 'user': return 'cyan';
    case 'assistant': return 'blue';
    case 'error': return 'red';
    default: return 'yellow';
  }
}

function SimpleMessage({ message }: { message: ChatMessage }) {
  const color = roleColor(message.role);
  const text = message.blocks.map(b => b.text).join('\n');

  return (
    <Box flexDirection="column" marginBottom={1} marginRight={3}>
      <Box
        borderStyle="bold"
        borderLeft={true}
        borderLeftColor={color}
        borderTop={false}
        borderRight={false}
        borderBottom={false}
      >
        <Text color={color}>{message.role}: </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{text}</Text>
      </Box>
    </Box>
  );
}

// Track if user is manually scrolling (not auto-scrolling)
const userScrollingRef = { current: false };

export const MessageList = React.memo(function MessageList({
  messages,
  availableRows,
}: MessageListProps) {
  const scrollRef = useRef<ScrollViewRef>(null);
  const prevMessageCountRef = useRef(0);

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Auto-scroll to bottom when new messages arrive, UNLESS user is scrolling manually
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // New message arrived
      if (!userScrollingRef.current) {
        // Auto-scroll to bottom
        scrollRef.current?.scrollToBottom();
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1}>
      <ScrollView
        ref={scrollRef}
        // Fixed height viewport
        height={availableRows}
        // Don't trigger React re-render on scroll - just track via ref
        onScroll={(offset) => {
          // If user scrolls up, mark as user-scrolling
          const bottomOffset = scrollRef.current?.getBottomOffset?.() ?? 0;
          userScrollingRef.current = offset < bottomOffset - 1;
        }}
        // No onScroll state update - this is the key to performance
      >
        {groupedMessages.map((group, groupIndex) => (
          <Box key={`group-${groupIndex}`} flexDirection="column">
            <DateDivider label={group.dateLabel} />
            {group.messages.map(message => (
              <SimpleMessage key={message.id} message={message} />
            ))}
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
});
