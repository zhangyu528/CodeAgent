import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, ChatMessageBlock, ChatMessageRole } from '../../pages/types.js';
import { TypingIndicator } from './TypingIndicator.js';

interface MessageItemProps {
  message: ChatMessage;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function formatToolSummary(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return text;

  const formatted = lines
    .map((line, i) => {
      const isLast = i === lines.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      return `${prefix}${line}`;
    })
    .join('\n');

  return `[Tools]\n${formatted}`;
}

// ─── Block renderer ────────────────────────────────────────────────────────

function renderBlock(block: ChatMessageBlock, key: string) {
  switch (block.kind) {
    case 'thinking': {
      const collapsed = block.collapsed !== false;
      if (collapsed) {
        return (
          <Box key={key}>
            <Text color="gray" dimColor>
              ▸ [Thinking]
            </Text>
          </Box>
        );
      }
      return (
        <Box key={key} flexDirection="column" paddingLeft={2}>
          <Text color="gray" dimColor>
            ▾ [Thinking]
          </Text>
          <Text color="gray" dimColor>
            {block.text}
          </Text>
        </Box>
      );
    }

    case 'reasoning': {
      const collapsed = block.collapsed !== false;
      if (collapsed) {
        return (
          <Box key={key}>
            <Text color="gray" dimColor>
              ▸ [Reasoning]
            </Text>
          </Box>
        );
      }
      return (
        <Box key={key} flexDirection="column" paddingLeft={2}>
          <Text color="gray" dimColor>
            ▾ [Reasoning]
          </Text>
          <Text color="gray" dimColor>
            {block.text}
          </Text>
        </Box>
      );
    }

    case 'toolSummary': {
      const collapsed = block.collapsed !== false;
      if (collapsed) {
        return (
          <Box key={key}>
            <Text color="gray" dimColor>
              ▸ [Tools]
            </Text>
          </Box>
        );
      }
      return (
        <Box key={key} flexDirection="column" paddingLeft={2}>
          <Text color="gray" dimColor>
            ▾ [Tools]
          </Text>
          <Text color="gray" dimColor>
            {formatToolSummary(block.text)}
          </Text>
        </Box>
      );
    }

    case 'text':
    default:
      return (
        <Box key={key}>
          <Text color="white">{block.text}</Text>
        </Box>
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export const MessageItem = memo(
  function MessageItem({ message }: MessageItemProps) {
    const color = roleColor(message.role);
    const isUser = message.role === 'user';
    const isWaiting = message.status === 'streaming' && message.blocks.length === 0;
    const isGenerating = message.status === 'streaming' && !isWaiting;

    // 是否在两个 text block 之间（用于分隔线）
    const hasTextBetweenTexts = (blocks: ChatMessageBlock[], idx: number): boolean => {
      const prev = blocks[idx - 1];
      const next = blocks[idx + 1];
      const curr = blocks[idx];
      return curr?.kind === 'text' && prev?.kind === 'text' && next?.kind === 'text';
    };

    return (
      <Box
        flexDirection="column"
        marginBottom={1}
        marginRight={3}
        borderStyle="bold"
        borderLeft={true}
        borderLeftColor={color}
        borderTop={false}
        borderRight={false}
        borderBottom={false}
      >
        {/* User: full-width background; Assistant: transparent */}
        <Box
          backgroundColor={isUser ? '#383838' : undefined}
          paddingLeft={2}
          paddingRight={2}
          paddingY={1}
          width="100%"
        >
          <Box flexDirection="column" flexGrow={1}>
            <TypingIndicator isThinking={isWaiting} isGenerating={isGenerating} />

            {message.blocks.map((block, index) => {
              const showDivider = hasTextBetweenTexts(message.blocks, index);

              return (
                <Box key={`${message.id}-${index}`} flexDirection="column">
                  {showDivider && (
                    <Box paddingY={1}>
                      <Text color="gray" dimColor>
                        ───
                      </Text>
                    </Box>
                  )}
                  {renderBlock(block, `${message.id}-${index}`)}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  },
  // Custom comparison: re-render only when id, status, or blocks change
  (prevProps, nextProps) =>
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.blocks === nextProps.message.blocks
);
