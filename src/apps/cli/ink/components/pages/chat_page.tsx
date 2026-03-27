import React from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, ChatMessageBlock, ChatPageProps, ChatMessageRole } from './types.js';

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
      <Box key={key} marginTop={1}>
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
    <Box key={key} marginTop={1}>
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
      paddingX={1}
      paddingY={0}
      marginBottom={1}
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

export function ChatPage(props: ChatPageProps) {
  const { isDimmed, session } = props;
  const messages = props.messages.slice(-80);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} flexShrink={1}>
      {session ? (
        <Box marginBottom={1}>
          <Text color="cyan" bold>{session.title}</Text>
          <Text color="gray">  #{session.id.slice(0, 8)}  </Text>
          <Text color="yellow">{session.status}</Text>
          <Text color="gray">  • {session.messageCount} msgs • {formatUpdatedAt(session.updatedAt)}</Text>
        </Box>
      ) : null}
      {messages.length === 0 ? <Text dimColor>暂无消息</Text> : null}
      {messages.map((message) => (
        <MessageCard key={message.id} message={message} isDimmed={isDimmed} />
      ))}
    </Box>
  );
}
