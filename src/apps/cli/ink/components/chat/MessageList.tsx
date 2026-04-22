import React, { useMemo, useRef, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import { ChatMessage } from '../../pages/types.js';
import { DateDivider } from './DateDivider.js';
import { MessageItem } from './MessageItem.js';

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

export const MessageList = React.memo(function MessageList({
  messages,
  availableRows,
  isModalOpen = false,
}: MessageListProps) {
  const { stdout } = useStdout();
  const prevMessagesLengthRef = useRef(messages.length);

  // Re-measure on resize
  useEffect(() => {
    const handleResize = () => {
      // No-op: terminal handles scrolling naturally
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  // Track new messages for auto-scroll (terminal native)
  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    if (isNewMessage) {
      // Terminal automatically shows latest output — no explicit scroll needed
    }
  }, [messages.length]);

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  // No ScrollView — terminal handles scrolling naturally
  return (
    <Box flexDirection="column">
      {groupedMessages.map((group, groupIndex) => (
        <Box key={`group-${groupIndex}`} flexDirection="column">
          <DateDivider label={group.dateLabel} />
          {group.messages.map(message => (
            <MessageItem key={message.id} message={message} />
          ))}
        </Box>
      ))}
    </Box>
  );
});
