import React from 'react';
import { Box, Text } from 'ink';

export function PromptBox(props: { title: string; body: string; input?: string; footer?: string }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">{props.title}</Text>
      <Text>{props.body}</Text>
      {typeof props.input === 'string' ? (
        <Box>
          <Text color="cyan" bold>❯ </Text>
          <Text bold>{props.input}</Text>
        </Box>
      ) : null}
      {props.footer ? <Text dimColor italic>{props.footer}</Text> : null}
    </Box>
  );
}
