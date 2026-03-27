import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ScrollView, ScrollViewRef } from 'ink-scroll-view';
import { ScrollBar } from '@byteland/ink-scroll-bar';
import { ChatMessage, ChatMessageBlock, ChatMessageRole, ChatPageProps } from './types.js';

function formatUpdatedAt(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleString();
  } catch {
    return 'unknown';
  }
}

function formatMessageTime(createdAt: number): string {
  try {
    return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function roleColor(role: ChatMessageRole): string {
  switch (role) {
    case 'user':
      return 'cyan';
    case 'assistant':
      return 'green';
    case 'error':
      return 'red';
    case 'system':
    default:
      return 'yellow';
  }
}

function roleLabel(message: ChatMessage): string {
  switch (message.role) {
    case 'user':
      return 'You';
    case 'assistant':
      return 'Assistant';
    case 'error':
      return 'Error';
    case 'system':
    default:
      return 'System';
  }
}

function blockPrefix(block: ChatMessageBlock): string {
  switch (block.kind) {
    case 'thinking':
      return '[Reasoning]';
    case 'toolSummary':
      return '[Tools]';
    case 'text':
    default:
      return '';
  }
}

function renderBlock(message: ChatMessage, block: ChatMessageBlock, isDimmed: boolean | undefined, key: string) {
  if (block.kind === 'thinking' && block.collapsed !== false) {
    const hasDetail = block.text.trim().length > 0;
    return (
      <Box key={key}>
        <Text color="gray" dimColor={!!isDimmed}>
          [Reasoning hidden{hasDetail ? ` • ${block.text.length} chars` : ''}]
        </Text>
      </Box>
    );
  }

  const prefix = blockPrefix(block);
  const content = prefix ? `${prefix} ${block.text}` : block.text;
  const color = block.kind === 'thinking' ? 'gray' : roleColor(message.role);

  return (
    <Box key={key}>
      <Text color={color} dimColor={!!isDimmed}>{content}</Text>
    </Box>
  );
}

function MessageCard({ message, isDimmed }: { message: ChatMessage; isDimmed: boolean | undefined }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={roleColor(message.role)}
      paddingX={0}
      paddingY={0}
      marginBottom={0}
    >
      <Box justifyContent="space-between">
        <Text color={roleColor(message.role)} bold dimColor={!!isDimmed}>
          {roleLabel(message)}
        </Text>
        <Text color="gray" dimColor>
          {formatMessageTime(message.createdAt)}
          {message.status === 'streaming' ? ' • streaming' : ''}
          {message.status === 'error' ? ' • error' : ''}
        </Text>
      </Box>
      {message.blocks.map((block, index) => renderBlock(message, block, isDimmed, `${message.id}-${index}`))}
    </Box>
  );
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

export function ChatPage(props: ChatPageProps) {
  const { availableRows, isDimmed, messages, scrollEnabled = true, session } = props;
  const { stdout } = useStdout();
  const scrollRef = useRef<ScrollViewRef>(null);

  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const messageSignature = useMemo(() => buildMessageSignature(messages), [messages]);

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

  useEffect(() => {
    scrollRef.current?.remeasure();

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

  // Keyboard and mouse scrolling
  useInput((input, key) => {
    if (!scrollEnabled || !scrollRef.current) return;

    // Handle mouse scroll events sent as escape sequences
    // SGR mouse format: CSI [ < Pb ; Px ; Py M
    // Pb=64 for scroll up, Pb=65 for scroll down
    if (typeof input === 'string') {
      const scrollMatch = input.match(/\[<(\d+);(\d+);(\d+)M/);
      if (scrollMatch) {
        const button = Number(scrollMatch[1]);
        if (button === 64 || button === 65) {
          const step = Math.max(1, Math.floor(scrollRef.current.getViewportHeight() / 3));

          if (button === 64) {
            // Scroll up (toward older content)
            scrollRef.current.scrollBy(-step);
          } else {
            // Scroll down (toward newer content) - respect bottom boundary
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
      // Don't scroll beyond bottom
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
      // Don't scroll beyond bottom
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

  const headerRows = session ? 2 : 0;
  const unreadRows = hasUnreadBelow ? 1 : 0;
  const viewportHeight = Math.max(1, availableRows - headerRows - unreadRows);

  return (
    <Box flexDirection="column" paddingX={1} height={availableRows} flexShrink={1}>
      {session ? (
        <Box flexShrink={0}>
          <Text color="cyan" bold>{session.title}</Text>
          <Text color="gray">  #{session.id.slice(0, 8)}  </Text>
          <Text color="yellow">{session.status}</Text>
          <Text color="gray">  • {session.messageCount} msgs • {formatUpdatedAt(session.updatedAt)}</Text>
        </Box>
      ) : null}
      <Box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        height={viewportHeight}
        overflow="hidden"
      >
        {messages.length === 0 ? (
          <Text dimColor>暂无消息</Text>
        ) : (
          <Box flexDirection="row" flexGrow={1} flexShrink={1}>
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
              {messages.map((message) => (
                <MessageCard key={message.id} message={message} isDimmed={isDimmed} />
              ))}
            </ScrollView>
            <ScrollBar
              placement="inset"
              style="block"
              contentHeight={contentHeight}
              viewportHeight={viewportHeight}
              scrollOffset={scrollOffset}
              autoHide
            />
          </Box>
        )}
      </Box>
      {hasUnreadBelow ? (
        <Box flexShrink={0}>
          <Text color="gray" dimColor>New messages below</Text>
        </Box>
      ) : null}
    </Box>
  );
}
