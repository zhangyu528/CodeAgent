import React from 'react';
import { Box, Text } from 'ink';
import { ModalChoice } from './modalStore.js';
import { ModalFrame } from './ModalFrame.js';
import { padToWidth, wrapToWidth } from './textLayout.js';

export function SelectList(props: {
  title: string;
  message?: string;
  choices: ModalChoice[];
  selected: number;
  width: number;
  footer?: string;
  emptyLabel?: string;
}) {
  const { width } = props;
  const innerWidth = Math.max(1, width - 4);
  const maxVisible = 8;
  const total = props.choices.length;
  const windowStart = Math.min(
    Math.max(0, props.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.choices.slice(windowStart, windowStart + maxVisible);

  return (
    <ModalFrame title={props.title} width={width} footer={props.footer}>
      {props.message && wrapToWidth(props.message, innerWidth).map((line, index) => (
        <Box key={`message-${index}`}>
          <Text>{padToWidth(line, innerWidth)}</Text>
        </Box>
      ))}
      {props.message && <Box height={1} />}
      {windowItems.length === 0 ? (
        <Box>
          <Text dimColor>{padToWidth(props.emptyLabel || 'No items available', innerWidth)}</Text>
        </Box>
      ) : (
        windowItems.map((item, idx) => {
          const globalIndex = windowStart + idx;
          const isSelected = globalIndex === props.selected;
          const prefix = isSelected ? '› ' : '  ';
          return (
            <Box key={`${globalIndex}-${item.value}`}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected} dimColor={!isSelected}>
                {padToWidth(`${prefix}${item.label}`, innerWidth)}
              </Text>
            </Box>
          );
        })
      )}
    </ModalFrame>
  );
}
