import React from 'react';
import { Box, Text } from 'ink';

export function SelectList(props: {
  title: string;
  choices: string[];
  selected: number;
  footer?: string;
}) {
  const maxVisible = 6;
  const total = props.choices.length;
  const windowStart = Math.min(
    Math.max(0, props.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.choices.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      <Box marginBottom={0}>
        <Text bold color="cyan">{props.title}</Text>
      </Box>
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selected;
        return (
          <Box key={`${globalIndex}-${item}`}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>{isSelected ? '┃ ' : '  '}</Text><Text
              dimColor={!isSelected}
              bold={isSelected}
            >
              {item}
            </Text>
          </Box>
        );
      })}
      {props.footer && (
        <Box marginTop={0}>
          <Text dimColor italic>{props.footer}</Text>
        </Box>
      )}
    </Box>
  );
}
