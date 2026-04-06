import React from 'react';
import { Box, Text } from 'ink';

export function LoadingPage() {
  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Text color="cyan">Loading...</Text>
    </Box>
  );
}
