import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, ChatMessageBlock, ChatMessageRole } from '../types.js';
import { TypingIndicator } from './TypingIndicator.js';

interface MessageItemProps {
  message: ChatMessage;
}

// Helper functions
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
    const collapsed = block.collapsed !== false;
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Thinking]
          </Text>
        </Box>
      );
    }
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Thinking]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{block.text}</Text>
      </Box>
    );
  }

  // Handle reasoning block
  if (block.kind === 'reasoning') {
    const collapsed = block.collapsed !== false;
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Reasoning]
          </Text>
        </Box>
      );
    }
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Reasoning]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{block.text}</Text>
      </Box>
    );
  }

  // Handle collapsed toolSummary
  if (block.kind === 'toolSummary') {
    const collapsed = block.collapsed !== false;
    if (collapsed) {
      return (
        <Box key={key}>
          <Text color="gray" dimColor={!!isDimmed}>
            ▸ [Tools]
          </Text>
        </Box>
      );
    }
    const formatted = formatToolSummary(block.text);
    return (
      <Box key={key} flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor={!!isDimmed}>▾ [Tools]</Text>
        <Text color="gray" dimColor={!!isDimmed}>{formatted}</Text>
      </Box>
    );
  }

  // Handle text block
  return (
    <Box key={key}>
      <Text color="white" dimColor={!!isDimmed}>{block.text}</Text>
    </Box>
  );
}

export const MessageItem = memo(function MessageItem({ message }: MessageItemProps) {
  const totalTextLength = message.blocks.reduce((sum, block) => sum + block.text.length, 0);
  const isWaiting = message.status === 'streaming' && totalTextLength === 0;
  const isGenerating = message.status === 'streaming';
  const isStreaming = message.status === 'streaming';

  const color = roleColor(message.role);
  const isUser = message.role === 'user';

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
      <Box backgroundColor={isUser ? '#383838' : undefined} paddingLeft={2} paddingRight={2} paddingY={1}>
        <Box flexDirection="column" justifyContent="center" flexGrow={1}>
          <TypingIndicator isThinking={isWaiting} isGenerating={isGenerating && !isWaiting} />
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
                {renderBlock(message, block, false, `${message.id}-${index}`)}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
});
