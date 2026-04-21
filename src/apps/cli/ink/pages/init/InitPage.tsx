import React from 'react';
import { Box, Text } from 'ink';
import { isFirstRun } from '@codeagent/core';

export function InitPage() {
  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Text color="cyan">Loading...</Text>
    </Box>
  );
}
