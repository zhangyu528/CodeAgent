import React from 'react';
import { Box, Text } from 'ink';
import { ModalFrame } from './ModalFrame.js';
import { padToWidth, wrapToWidth } from './textLayout.js';

export function PromptBox(props: { title: string; body: string; input?: string; footer?: string; showInput?: boolean; width: number }) {
  const innerWidth = Math.max(1, props.width - 4);
  const bodyLines = wrapToWidth(props.body, innerWidth);

  return (
    <ModalFrame title={props.title} width={props.width} footer={props.footer}>
      {bodyLines.map((line, index) => (
        <Box key={`body-${index}`}>
          <Text>{padToWidth(line, innerWidth)}</Text>
        </Box>
      ))}
      {props.showInput && (
        <>
          <Box height={1} />
          <Box>
            <Text bold>{padToWidth(`> ${props.input || ''}`, innerWidth)}</Text>
          </Box>
        </>
      )}
    </ModalFrame>
  );
}
