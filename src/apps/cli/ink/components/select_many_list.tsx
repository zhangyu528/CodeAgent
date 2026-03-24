import React from 'react';
import { Box, Text } from 'ink';

export function SelectManyList(props: {
  title: string;
  choices: string[];
  selected: number;
  picked: Set<number>;
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
        const isPicked = props.picked.has(globalIndex);
        const checkbox = isPicked ? '[✓]' : '[ ]';
        return (
          <Box key={`${globalIndex}-${item}`}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>{isSelected ? '┃ ' : '  '}</Text><Text color={isPicked ? "cyan" : "gray"} bold={isSelected || isPicked}>{checkbox}</Text><Text dimColor={!isSelected && !isPicked} bold={isSelected || isPicked}>{' '}{item}</Text>
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
