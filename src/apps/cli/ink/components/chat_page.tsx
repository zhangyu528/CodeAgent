import React from 'react';
import { Box, Text } from 'ink';
import { ChatPageProps } from './types.js';
import { ChatHeader } from './chat_header.js';

export function ChatPage(props: ChatPageProps) {
  const { isDimmed } = props;
  const lines = props.lines.slice(-200);

  if (isDimmed) {
    return (
      <Box flexDirection="column" paddingX={1} flexGrow={1} flexShrink={1} alignItems="center" justifyContent="center">
        <Text dimColor italic>... 正在进行选择 ...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} flexShrink={1}>
      {lines.length === 0 ? <Text dimColor>暂无消息</Text> : null}
      {lines.map((line) => (
        <Text key={line.id} dimColor={!!isDimmed}>{line.text}</Text>
      ))}
    </Box>
  );
}
