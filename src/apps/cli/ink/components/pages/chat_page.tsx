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

type DateGroup = {
  dateLabel: string;
  dateTimestamp: number;
  messages: ChatMessage[];
};

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

  // Sort groups by date (oldest first)
  return Array.from(groups.values()).sort((a, b) => a.dateTimestamp - b.dateTimestamp);
}

function roleColor(role: ChatMessageRole): string {
  switch (role) {
    case 'user':
      return 'cyan';
    case 'assistant':
      return 'blue';
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

function formatToolSummary(text: string): string {
  // Parse tool summary text and format as tree structure
  // Expected format: "tool1: args1\ntool2: args2\n..." or similar
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return text;

  const formatted = lines.map((line, i) => {
    const isLast = i === lines.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    return `${prefix}${line}`;
  }).join('\n');

  return `[Tools]\n${formatted}`;
}

function renderBlock(message: ChatMessage, block: ChatMessageBlock, isDimmed: boolean | undefined, key: string) {
  // Handle collapsed thinking
  if (block.kind === 'thinking') {
    const collapsed = block.collapsed !== false; // default to collapsed
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Thinking]
          </Text>
        </Box>
      );
    }
    // Expanded thinking
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Thinking]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{block.text}</Text>
      </Box>
    );
  }

  // Handle reasoning block
  if (block.kind === 'reasoning') {
    const collapsed = block.collapsed !== false; // default to collapsed
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Reasoning]
          </Text>
        </Box>
      );
    }
    // Expanded reasoning
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Reasoning]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{block.text}</Text>
      </Box>
    );
  }

  // Handle collapsed toolSummary
  if (block.kind === 'toolSummary') {
    const collapsed = block.collapsed !== false; // default to collapsed
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Tools]
          </Text>
        </Box>
      );
    }
    // Expanded toolSummary - format as tree
    const formatted = formatToolSummary(block.text);
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Tools]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{formatted}</Text>
      </Box>
    );
  }

  // Handle text block - use white for main content
  return (
    <Box key={key}>
      <Text color="white" dimColor={!!isDimmed}>{block.text}</Text>
    </Box>
  );
}

function MessageCard({ message, isDimmed }: { message: ChatMessage; isDimmed: boolean | undefined }) {
  // Calculate total text length for streaming status
  const totalTextLength = message.blocks.reduce((sum, block) => sum + block.text.length, 0);

  // Check if we're still waiting for first content
  const isWaiting = message.status === 'streaming' && totalTextLength === 0;

  // Check if we have thinking/reasoning block
  const hasThinkingBlock = message.blocks.some(block => block.kind === 'thinking' || block.kind === 'reasoning');

  // Check if we have text block (text started outputting)
  const hasTextBlock = message.blocks.some(block => block.kind === 'text' && block.text.length > 0);

  // Generating state: thinking/reasoning done but text not started yet
  const isGenerating = message.status === 'streaming' && hasThinkingBlock && !hasTextBlock;

  // Streaming animation state
  const [animFrame, setAnimFrame] = useState(0);
  const isStreaming = message.status === 'streaming';

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setAnimFrame(f => (f + 1) % 4);
    }, 200);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const animChars = ['░', '▒', '▓', '█'];
  const color = roleColor(message.role);

  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="bold" borderLeft={true} borderLeftColor={color} borderTop={false} borderRight={false} borderBottom={false} paddingLeft={1}>
      <Box justifyContent="space-between">
        <Text color={color} bold dimColor={!!isDimmed}>
          {roleLabel(message)}
        </Text>
        <Text color="gray" dimColor>
          {formatMessageTime(message.createdAt)}
          {message.status === 'streaming' && totalTextLength > 0 && !isGenerating ? ` • streaming (${totalTextLength} chars)` : ''}
          {isWaiting || isGenerating ? ' • thinking' : ''}
          {message.status === 'error' ? ' • error' : ''}
        </Text>
      </Box>
      {(isWaiting || isGenerating) && (
        <Box>
          <Text color="blue" bold>{animChars[animFrame]} </Text>
          <Text color="gray" dimColor>{isWaiting ? 'thinking...' : 'generating...'}</Text>
        </Box>
      )}
      {message.blocks.map((block, index) => {
        const prevBlock = index > 0 ? message.blocks[index - 1] : null;
        const nextBlock = index < message.blocks.length - 1 ? message.blocks[index + 1] : null;
        const isTextBetweenTexts = block.kind === 'text' && prevBlock?.kind === 'text' && nextBlock?.kind === 'text';

        return (
          <Box key={`${message.id}-${index}`} flexDirection="column">
            {isTextBetweenTexts && (
              <Box>
                <Text color="gray" dimColor>───</Text>
              </Box>
            )}
            {renderBlock(message, block, isDimmed, `${message.id}-${index}`)}
          </Box>
        );
      })}
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

  // Track previous message count to detect new messages
  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    scrollRef.current?.remeasure();

    // New message arrived - scroll to bottom regardless of pinned state
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (isNewMessage) {
      // Always scroll for new messages, ignore isPinnedToBottom
      if (scrollRef.current) {
        // Use queueMicrotask to scroll after current render cycle completes
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

  // Continuously scroll to bottom during streaming and when content updates
  useEffect(() => {
    if (isPinnedToBottom && scrollRef.current) {
      // Use queueMicrotask to scroll after current render cycle completes
      queueMicrotask(() => {
        scrollRef.current?.scrollToBottom();
      });
    }
  }, [messageSignature]);

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
              {groupMessagesByDate(messages).map((group, groupIndex) => (
                <Box key={`group-${groupIndex}`} flexDirection="column">
                  <Box paddingTop={1}>
                    <Text color="gray" dimColor>─── {group.dateLabel} ───</Text>
                  </Box>
                  {group.messages.map((message) => (
                    <MessageCard key={message.id} message={message} isDimmed={isDimmed} />
                  ))}
                </Box>
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
