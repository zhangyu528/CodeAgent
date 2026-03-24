import React from 'react';
import { Box, Text } from 'ink';
import { HistoryPickerProps } from './types.js';

export function HistoryPicker(props: HistoryPickerProps) {
  if (!props.visible) return null;

  const maxVisible = 5;
  const total = props.items.length;
  const windowStart = Math.min(
    Math.max(0, props.selectedIndex - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.items.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" width="100%">
      {props.items.length === 0 ? <Box paddingX={3}><Text dimColor>No history sessions found</Text></Box> : null}
      {windowItems.map((s, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selectedIndex;
        return (
          <Box key={s.id}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>{isSelected ? '┃ ' : '  '}</Text><Text
              dimColor={!isSelected}
              bold={isSelected}
            >
              {s.title} <Text color="gray" dimColor>({s.id.slice(0, 8)})</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
