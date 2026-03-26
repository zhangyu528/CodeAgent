import React from 'react';
import { Box, Text } from 'ink';
import { ChatPageProps } from './types.js';

function formatUpdatedAt(updatedAt: number): string {
  try {
    return new Date(updatedAt).toLocaleString();
  } catch {
    return 'unknown';
  }
}

export function ChatPage(props: ChatPageProps) {
  const { isDimmed, session } = props;
  const lines = props.lines.slice(-200);

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
      {lines.length === 0 ? <Text dimColor>暂无消息</Text> : null}
      {lines.map((line) => (
        <Text key={line.id} dimColor={!!isDimmed}>{line.text}</Text>
      ))}
    </Box>
  );
}
