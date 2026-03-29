import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ScrollView, ScrollViewRef } from 'ink-scroll-view';
import { ScrollBar } from '@byteland/ink-scroll-bar';
import { ChatMessage } from '../types.js';
import { DateDivider } from './DateDivider.js';
import { MessageItem } from './MessageItem.js';

interface MessageListProps {
  messages: ChatMessage[];
  isDimmed?: boolean | undefined;
  scrollEnabled?: boolean;
  availableRows: number;
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
        .map(block => `${block.kind}:${block.text.length}:${'collapsed' in block ? String(block.collapsed !== false) : 'na'}`)
        .join('|');
      return `${message.id}:${message.status || 'none'}:${blockSignature}`;
    })
    .join('::');
}

export function MessageList({
  messages,
  isDimmed,
  scrollEnabled = true,
  availableRows,
}: MessageListProps) {
  const { stdout } = useStdout();
  const scrollRef = useRef<ScrollViewRef>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const messageSignature = useMemo(() => buildMessageSignature(messages), [messages]);
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  const syncPinnedState = () => {
    const ref = scrollRef.current;
    if (!ref) return;

    const bottomOffset = Math.max(0, ref.getBottomOffset());
    const nextOffset = ref.getScrollOffset();
    const pinned = bottomOffset <= 0 || nextOffset >= bottomOffset - 1;

    setScrollOffset(nextOffset);
    setIsPinnedToBottom(pinned);

    if (pinned) {
      setHasUnreadBelow(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.remeasure();
      if (isPinnedToBottom) {
        scrollRef.current?.scrollToBottom();
      }
      syncPinnedState();
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout, isPinnedToBottom]);

  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    scrollRef.current?.remeasure();

    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (isNewMessage) {
      if (scrollRef.current) {
        queueMicrotask(() => {
          scrollRef.current?.scrollToBottom();
        });
      }
      setIsPinnedToBottom(true);
      setHasUnreadBelow(false);
      return;
    }

    if (isPinnedToBottom) {
      scrollRef.current?.scrollToBottom();
      syncPinnedState();
      return;
    }

    if (messages.length > 0) {
      setHasUnreadBelow(true);
    }

    syncPinnedState();
  }, [messageSignature, availableRows, isPinnedToBottom, messages.length]);

  useEffect(() => {
    if (isPinnedToBottom && scrollRef.current) {
      queueMicrotask(() => {
        scrollRef.current?.scrollToBottom();
      });
    }
  }, [messageSignature]);

  useInput((input, key) => {
    if (!scrollEnabled || !scrollRef.current) return;

    // Handle mouse scroll events
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
          syncPinnedState();
        }
        return;
      }
    }

    const step = Math.max(1, Math.floor(scrollRef.current.getViewportHeight() / 3));

    if (key.upArrow) {
      scrollRef.current.scrollBy(-step);
      syncPinnedState();
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
      syncPinnedState();
      return;
    }

    if (key.pageUp) {
      scrollRef.current.scrollBy(-step * 3);
      syncPinnedState();
      return;
    }

    if (key.pageDown) {
      const currentOffset = scrollRef.current.getScrollOffset();
      const bottomOffset = scrollRef.current.getBottomOffset();
      const maxScroll = Math.min(step * 3, bottomOffset - currentOffset);
      if (maxScroll > 0) {
        scrollRef.current.scrollBy(maxScroll);
      }
      syncPinnedState();
      return;
    }
  });

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        onScroll={(offset: number) => {
          setScrollOffset(offset);
          const ref = scrollRef.current;
          if (!ref) return;

          const bottomOffset = Math.max(0, ref.getBottomOffset());
          const pinned = bottomOffset <= 0 || offset >= bottomOffset - 1;
          setIsPinnedToBottom(pinned);

          if (pinned) {
            setHasUnreadBelow(false);
          }
        }}
        onContentHeightChange={(height: number) => {
          setContentHeight(height);
        }}
      >
        {groupedMessages.map((group, groupIndex) => (
          <Box key={`group-${groupIndex}`} flexDirection="column">
            <DateDivider label={group.dateLabel} />
            {group.messages.map((message) => (
              <MessageItem key={message.id} message={message} isDimmed={isDimmed} />
            ))}
          </Box>
        ))}
      </ScrollView>
      <ScrollBar
        placement="inset"
        style="block"
        contentHeight={contentHeight}
        viewportHeight={availableRows}
        scrollOffset={scrollOffset}
        autoHide
      />
    </>
  );
}

