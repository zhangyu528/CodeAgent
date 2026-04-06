import React from 'react';
import { Box, Text } from 'ink';
import { ASCII_LOGO } from './constants.js';

const VERSION = '1.0.0';

export function Logo() {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={2}>
      {ASCII_LOGO.map((line, idx) => (
        <Text key={idx} color="cyan">{line}</Text>
      ))}
      <Box marginTop={1}>
        <Text bold>CodeAgent </Text><Text dimColor>v{VERSION}</Text>
      </Box>
    </Box>
  );
}
