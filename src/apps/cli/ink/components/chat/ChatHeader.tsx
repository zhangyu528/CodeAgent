import React from 'react';
import { Box, Text } from 'ink';
import { ChatSessionInfo } from '../../pages/types.js';

interface ChatHeaderProps {
  session: ChatSessionInfo | null | undefined;
}

function formatUpdatedAt(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleString();
  } catch {
    return 'unknown';
  }
}

export function ChatHeader({ session }: ChatHeaderProps) {
  if (!session) return null;

  return (
    <Box flexShrink={0}>
      <Text color="cyan" bold>{session.title}</Text>
      <Text color="gray">  #{session.id.slice(0, 8)}  </Text>
      <Text color="yellow">{session.status}</Text>
      <Text color="gray">  • {session.messageCount} msgs • {formatUpdatedAt(session.updatedAt)}</Text>
    </Box>
  );
}
