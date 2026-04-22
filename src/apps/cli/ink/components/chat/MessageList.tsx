import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Box, Text, useStdout } from 'ink';
import { ScrollView, ScrollViewRef } from 'ink-scroll-view';
import { ScrollBar } from '@byteland/ink-scroll-bar';
import { ChatMessage } from '../../pages/types.js';
import { DateDivider } from './DateDivider.js';
import { MessageItem } from './MessageItem.js';
import { useInput } from 'ink';

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

function buildMessageSignature(messages: ChatMessage[]): string {
  return messages
    .map(message => {
      const blockSignature = message.blocks
        .map(
          block =>
            `${block.kind}:${block.text.length}:${'collapsed' in block ? String(block.collapsed !== false) : 'na'}`
        )
        .join('|');
      return `${message.id}:${message.status || 'none'}:${blockSignature}`;
    })
    .join('::');
}

export const MessageList = React.memo(function MessageList({
  messages,
  scrollEnabled = true,
  availableRows,
  isModalOpen = false,
}: MessageListProps) {
  const { stdout } = useStdout();
  const scrollRef = useRef<ScrollViewRef>(null);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const isPinnedRef = useRef(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const messageSignature = useMemo(() => buildMessageSignature(messages), [messages]);
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Sync pinned state — reads from refs to avoid triggering re-renders
  const syncPinnedState = useCallback(() => {
    const ref = scrollRef.current;
    if (!ref) return;
    const bottomOffset = Math.max(0, ref.getBottomOffset());
    const nextOffset = ref.getScrollOffset();
    const pinned = bottomOffset <= 0 || nextOffset >= bottomOffset - 1;
    isPinnedRef.current = pinned;
    scrollOffsetRef.current = nextOffset;
    if (pinned) {
      setHasUnreadBelow(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.remeasure();
      if (isPinnedRef.current) {
        scrollRef.current?.scrollToBottom();
      }
      syncPinnedState();
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout, syncPinnedState]);

  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (isNewMessage) {
      scrollRef.current?.remeasure();
      queueMicrotask(() => {
        scrollRef.current?.scrollToBottom();
      });
      isPinnedRef.current = true;
      setHasUnreadBelow(false);
      return;
    }

    if (isPinnedRef.current) {
      queueMicrotask(() => {
        scrollRef.current?.scrollToBottom();
      });
    }
    syncPinnedState();
  }, [messageSignature, messages.length]);

  useInput(
    (input, key) => {
      if (isModalOpen || !scrollEnabled || !scrollRef.current) return;

      if (typeof input === 'string') {
        const scrollMatch = input.match(/\[<(\d+);(\d+);(\d+)M/);
        if (scrollMatch) {
          const button = Number(scrollMatch[1]);
          if (button === 64 || button === 65) {
            const step = Math.max(1, Math.floor(scrollRef.current.getViewportHeight() / 3));
            if (button === 64) {
              scrollRef.current.scrollBy(-step);
            } else {
              const currentOffset = scrollRef.current.getScrollOffset();
              const bottomOffset = scrollRef.current.getBottomOffset();
              const maxScroll = Math.min(step, bottomOffset - currentOffset);
              if (maxScroll > 0) {
                scrollRef.current.scrollBy(maxScroll);
              }
            }
            return;
          }
          return;
        }
      }

      const step = Math.max(1, Math.floor(scrollRef.current.getViewportHeight() / 3));

      if (key.upArrow) {
        scrollRef.current.scrollBy(-step);
        return;
      }

      if (key.downArrow) {
        const currentOffset = scrollRef.current.getScrollOffset();
        const bottomOffset = scrollRef.current.getBottomOffset();
        if (currentOffset >= bottomOffset) return;
        const maxScroll = Math.min(step, bottomOffset - currentOffset);
        if (maxScroll > 0) {
          scrollRef.current.scrollBy(maxScroll);
        }
        return;
      }

      if (key.pageUp) {
        scrollRef.current.scrollBy(-step * 3);
        return;
      }

      if (key.pageDown) {
        const currentOffset = scrollRef.current.getScrollOffset();
        const bottomOffset = scrollRef.current.getBottomOffset();
        const maxScroll = Math.min(step * 3, bottomOffset - currentOffset);
        if (maxScroll > 0) {
          scrollRef.current.scrollBy(maxScroll);
        }
        return;
      }
    },
    { isActive: !isModalOpen }
  );

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" width="100%" height="100%" flexShrink={0} overflow="hidden">
      <Box height="100%" width="100%" flexGrow={1} flexShrink={1} overflow="hidden">
        <ScrollView
          ref={scrollRef}
          onScroll={({ scrollOffset: offset }: { scrollOffset: number }) => {
            scrollOffsetRef.current = offset;
            const bottomOffset = Math.max(0, (scrollRef.current as any)?.getBottomOffset?.() ?? 0);
            const pinned = offset >= bottomOffset - 1;
            isPinnedRef.current = pinned;
            if (pinned) {
              setHasUnreadBelow(false);
            } else if (offset < bottomOffset - 10) {
              setHasUnreadBelow(true);
            }
          }}
          onContentHeightChange={(height: number) => {
            contentHeightRef.current = height;
          }}
        >
          {groupedMessages.map((group, groupIndex) => (
            <Box key={`group-${groupIndex}`} flexDirection="column">
              <DateDivider label={group.dateLabel} />
              {group.messages.map(message => (
                <MessageItem key={message.id} message={message} />
              ))}
            </Box>
          ))}
        </ScrollView>
      </Box>
      <ScrollBar
        placement="inset"
        style="line"
        color="cyan"
        contentHeight={contentHeightRef.current}
        viewportHeight={availableRows}
        scrollOffset={scrollOffsetRef.current}
        autoHide
      />
    </Box>
  );
});
