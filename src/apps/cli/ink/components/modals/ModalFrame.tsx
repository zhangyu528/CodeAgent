import React from 'react';
import { Box, Text } from 'ink';
import { padToWidth, wrapToWidth } from './textLayout.js';

export const DEFAULT_MODAL_WIDTH = 72;

interface ModalFrameProps {
  title: string;
  width: number;
  footer?: string;
  children?: React.ReactNode;
}

export function ModalFrame({ title, width, footer, children }: ModalFrameProps) {
  const innerWidth = Math.max(1, width - 4);
  const footerLines = footer ? wrapToWidth(footer, innerWidth) : [];

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      backgroundColor="black"
    >
      <Box>
        <Text color="cyan" bold>{padToWidth(title, innerWidth)}</Text>
      </Box>
      <Box>
        <Text>{padToWidth('', innerWidth)}</Text>
      </Box>
      {children}
      {footerLines.length > 0 && (
        <>
          <Box>
            <Text>{padToWidth('', innerWidth)}</Text>
          </Box>
          {footerLines.map((line, index) => (
            <Box key={`footer-${index}`}>
              <Text dimColor>{padToWidth(line, innerWidth)}</Text>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
