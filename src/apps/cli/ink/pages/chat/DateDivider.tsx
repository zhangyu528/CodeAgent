import React from 'react';
import { Box, Text } from 'ink';

interface DateDividerProps {
  label: string;
}

export function DateDivider({ label }: DateDividerProps) {
  return (
    <Box paddingTop={1}>
      <Text color="gray" dimColor>─── {label} ───</Text>
    </Box>
  );
}
