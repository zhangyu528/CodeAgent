import React from 'react';
import { Box, Text } from 'ink';

interface DateDividerProps {
  label: string;
}

export function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return '今天';
  if (messageDate.getTime() === yesterday.getTime()) return '昨天';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function DateDivider({ label }: DateDividerProps) {
  return (
    <Box paddingTop={1}>
      <Text color="gray" dimColor>─── {label} ───</Text>
    </Box>
  );
}
