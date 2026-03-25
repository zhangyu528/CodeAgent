import React from 'react';
import { Box, Text } from 'ink';

export function SelectManyList(props: {
  title: string;
  choices: string[];
  selected: number;
  picked: Set<number>;
  width: number;
  footer?: string;
}) {
  const { width } = props;
  const maxVisible = 8;
  const total = props.choices.length;
  const windowStart = Math.min(
    Math.max(0, props.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.choices.slice(windowStart, windowStart + maxVisible);

  const pad = (str: string) => str.padEnd(width - 2, ' ');

  return (
    <Box flexDirection="column" width={width}>
      <Box width={width}>
        <Text bold color="cyan">{pad(props.title)}</Text>
      </Box>
      <Box height={1}><Text>{' '.repeat(width)}</Text></Box>
      
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selected;
        const isPicked = props.picked.has(globalIndex);
        
        const prefix = isSelected ? '┃ ' : '  ';
        const checkbox = isPicked ? '[✓] ' : '[ ] ';
        const content = item.slice(0, width - 10);
        const line = prefix + checkbox + content;
        
        return (
          <Box key={`${globalIndex}-${item}`} width={width}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected || isPicked}>
                {line.padEnd(width, ' ')}
            </Text>
          </Box>
        );
      })}
      
      <Box height={1}><Text>{' '.repeat(width)}</Text></Box>
      
      {props.footer && (
        <Box width={width}>
          <Text dimColor italic>{pad(props.footer)}</Text>
        </Box>
      )}
    </Box>
  );
}
