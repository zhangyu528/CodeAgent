import React from 'react';
import { Box, Text } from 'ink';
import { InputBarProps } from './types.js';

export function InputBar(props: InputBarProps) {
  const hasValue = props.value.length > 0;
  return (
    <Box flexDirection="column" paddingX={1}><Box><Text color="cyan" bold>❯ </Text>{hasValue ? (
          <Text bold>{props.value}</Text>
        ) : (
          <Text color="gray" dimColor italic>{props.placeholder || 'Type a message...'}</Text>
        )}</Box></Box>
  );
}
