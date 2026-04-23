#!/usr/bin/env node
import React from 'react';
import { render, Box, Text } from 'ink';

const TOTAL = 30;
const VIEWPORT = 10;
const ITEM_H = 4;

function Test() {
  const [scrollOffset, setScrollOffset] = React.useState(0);

  React.useEffect(() => {
    let buf = '';
    const h = (chunk: Buffer) => {
      buf += chunk.toString();
      if (buf.includes('\x1b[B')) {
        setScrollOffset(o => Math.min(o + ITEM_H, (TOTAL - VIEWPORT) * ITEM_H));
        buf = '';
      }
      if (buf.includes('\x1b[A')) {
        setScrollOffset(o => Math.max(o - ITEM_H, 0));
        buf = '';
      }
    };
    process.stdin.on('data', h);
    return () => process.stdin.off('data', h);
  }, []);

  return (
    <Box flexDirection="column">
      <Text>offset={scrollOffset}</Text>
      <Box flexDirection="column" height={VIEWPORT} overflow="hidden" borderStyle="single">
        <Box flexDirection="column" marginTop={-scrollOffset} height={TOTAL * ITEM_H}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <Box key={i} height={ITEM_H} flexGrow={0} flexShrink={0}>
              <Text dimColor>Item {i}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

render(React.createElement(Test));
