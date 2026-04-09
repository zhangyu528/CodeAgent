import React from 'react';
import { Box, Text } from 'ink';
import { ChatSessionInfo } from '../../pages/types.js';

interface ChatHeaderProps {
  session: ChatSessionInfo | null | undefined;
}

export function ChatHeader({ session }: ChatHeaderProps) {
  return (
    <Box flexShrink={0}>
      <Text color="cyan" bold>{session?.title || 'No Session'}</Text>
      <Text color="gray">  #{session?.id?.slice(0, 8) || 'none'}  </Text>
      <Text color="yellow">{session?.status || 'unknown'}</Text>
      <Text color="gray">  • {session?.messageCount || 0} msgs</Text>
    </Box>
  );
}
