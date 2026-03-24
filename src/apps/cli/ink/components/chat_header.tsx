import React from 'react';
import { Box, Text } from 'ink';
import { ChatHeaderProps } from './types.js';

export function ChatHeader(props: ChatHeaderProps) {
  return (
    <Box flexDirection="column">
      <Text>{props.title}  (#{props.shortSessionId})</Text>
      <Text>{'-'.repeat(72)}</Text>
    </Box>
  );
}
