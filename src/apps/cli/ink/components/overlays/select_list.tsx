import React from 'react';
import { Box, Text } from 'ink';

export function SelectList(props: {
  title: string;
  choices: string[];
  selected: number;
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

  // Helper to ensure every line is exactly 'width' characters long
  const renderLine = (content: string, color?: string, bold?: boolean, dim?: boolean) => {
    const line = content.slice(0, width).padEnd(width, ' ');
    return (
      <Box width={width} {...({ backgroundColor: 'black' } as any)}>
        <Text color={color || 'white'} bold={bold || false} dimColor={dim || false}>{line}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width={width}>
      {/* Top Padding Row */}
      {renderLine('')}
      
      {/* Title Row */}
      {renderLine(`  ${props.title}`, 'cyan', true)}
      
      {/* Gap Row */}
      {renderLine('')}
      
      {/* Choice Rows */}
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selected;
        const prefix = isSelected ? ' ┃ ' : '   ';
        return (
          <Box key={`${globalIndex}-${item}`} width={width}>
            {renderLine(`${prefix}${item}`, isSelected ? 'cyan' : 'gray', isSelected, !isSelected)}
          </Box>
        );
      })}
      
      {/* Gap Row */}
      {renderLine('')}
      
      {/* Footer Row */}
      {props.footer && renderLine(`  ${props.footer}`, 'gray', false, true)}

      {/* Bottom Padding Row */}
      {renderLine('')}
    </Box>
  );
}
