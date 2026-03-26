import React from 'react';
import { Box, Text } from 'ink';
import { SlashPaletteProps } from './types.js';

export function SlashPalette(props: SlashPaletteProps) {
  if (!props.visible || props.items.length === 0) return null;

  const maxVisible = 5;
  const total = props.items.length;
  const windowStart = Math.min(
    Math.max(0, props.selectedIndex - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.items.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" width="100%">
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selectedIndex;
        const matchIndex = item.name.toLowerCase().indexOf(props.query.toLowerCase());
        const hasMatch = matchIndex !== -1 && props.query.length > 0;

        return (
          <Box key={item.name} flexDirection="column">
            <Box>
              <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>{isSelected ? '┃ ' : '  '}</Text>{hasMatch ? (
                <><Text dimColor={!isSelected} bold={isSelected}>{item.name.slice(0, matchIndex)}</Text><Text color="cyan" bold>{item.name.slice(matchIndex, matchIndex + props.query.length)}</Text><Text dimColor={!isSelected} bold={isSelected}>{item.name.slice(matchIndex + props.query.length)}</Text></>
              ) : (
                <Text dimColor={!isSelected} bold={isSelected}>{item.name}</Text>
              )}<Text color="gray" dimColor={!isSelected}>  {item.description}</Text><Text color="blue" dimColor={!isSelected}> [{item.category}]</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
