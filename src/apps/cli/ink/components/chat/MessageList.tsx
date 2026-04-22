/**
 * MessageList - Virtual list: only renders visible messages, rest goes to scrollback.
 *
 * Terminal layout:
 *   Row 1-2:     Header
 *   Row 3-(T-9): Message viewport
 *   Row (T-8)-T: Input
 *
 * Virtual list logic:
 *   - Calculate approximate height of each message
 *   - Only render enough messages to fill availableRows
 *   - Earlier messages → terminal scrollback (free!)
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, ChatMessageBlock, ChatMessageRole } from '../../pages/types.js';
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

// Estimate how many rows a message takes
function estimateMessageHeight(msg: ChatMessage): number {
  let rows = 2; // role label + border line

  for (const block of msg.blocks) {
    const text = block.text || '';
    // Estimate: 2 chars per "block" unit + newline
    // Role label is wide (cyan), so use cols - 20 for estimation
    const estimatedCols = 80 - 20;
    const textRows = Math.ceil(text.length / estimatedCols);
    rows += Math.max(1, textRows);
    rows += 1; // block spacing
  }

  return rows;
}

// Estimate date divider height
const DATE_DIVIDER_HEIGHT = 1;

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

export const MessageList = React.memo(function MessageList({
  messages,
  availableRows,
  isModalOpen = false,
}: MessageListProps) {
  // Group all messages by date
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Virtual list: only render messages that fit in availableRows
  // Earlier messages go to terminal scrollback (free!)
  const visibleGroups = useMemo(() => {
    if (messages.length === 0) return [];

    const result: DateGroup[] = [];
    let usedRows = 0;

    // Iterate groups from newest to oldest
    for (let g = groupedMessages.length - 1; g >= 0; g--) {
      const group = groupedMessages[g];

      // Check if adding this group would overflow
      const groupHeight = DATE_DIVIDER_HEIGHT + group.messages.reduce(
        (sum, m) => sum + estimateMessageHeight(m), 0
      );

      if (usedRows + groupHeight > availableRows && usedRows > 0) {
        // This group doesn't fit - we're done
        break;
      }

      // Try adding messages from this group one by one
      const visibleMsgs: ChatMessage[] = [];
      for (let m = group.messages.length - 1; m >= 0; m--) {
        const msg = group.messages[m];
        const msgHeight = estimateMessageHeight(msg);

        if (usedRows + msgHeight > availableRows) {
          break;
        }

        visibleMsgs.unshift(msg);
        usedRows += msgHeight;
      }

      if (visibleMsgs.length > 0) {
        result.unshift({
          ...group,
          messages: visibleMsgs,
        });
      }
    }

    return result;
  }, [groupedMessages, messages, availableRows]);

  // How many messages are hidden in scrollback?
  const hiddenCount = messages.length - visibleGroups.reduce(
    (sum, g) => sum + g.messages.length, 0
  );

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {hiddenCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>▲ {hiddenCount} 条更早的消息 (滚动查看)</Text>
        </Box>
      )}
      {visibleGroups.map((group, groupIndex) => (
        <Box key={`group-${groupIndex}`} flexDirection="column">
          <DateDivider label={group.dateLabel} />
          {group.messages.map(message => (
            <SimpleMessage key={message.id} message={message} />
          ))}
        </Box>
      ))}
    </Box>
  );
});
