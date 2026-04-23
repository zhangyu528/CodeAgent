#!/usr/bin/env node
import React from 'react';
import { render, Box, Text } from 'ink';
import { ControlledScrollView } from '/tmp/isv/package/dist/index.js';

const ITEM_HEIGHT = 4;
const TOTAL = 30;
const VIEWPORT = 10;

const items = Array.from({ length: TOTAL }, (_, i) => ({
  key: String(i),
  label: `Item ${i}`,
}));

function Test() {
  const [scrollOffset, setScrollOffset] = React.useState(0);

  React.useEffect(() => {
    let buf = '';
    const h = (chunk: Buffer) => {
      buf += chunk.toString();
      if (buf.includes('\x1b[B')) {
        const max = (TOTAL - VIEWPORT) * ITEM_HEIGHT;
        setScrollOffset(o => Math.min(o + ITEM_HEIGHT, max));
        buf = '';
      }
      if (buf.includes('\x1b[A')) {
        setScrollOffset(o => Math.max(o - ITEM_HEIGHT, 0));
        buf = '';
      }
    };
    process.stdin.on('data', h);
    return () => process.stdin.off('data', h);
  }, []);

  const visStart = Math.floor(scrollOffset / ITEM_HEIGHT);
  const visEnd = Math.min(visStart + VIEWPORT + 2, TOTAL);

  return (
    <Box flexDirection="column">
      <Text bold>Virtual list via ControlledScrollView</Text>
      <Text dimColor>
        offset={scrollOffset} vis={visStart}-{visEnd - 1}
      </Text>
      <ControlledScrollView height={VIEWPORT} overflow="hidden" scrollOffset={scrollOffset}>
        {/* Only visible items */}
        {items.slice(visStart, visEnd).map((item, idx) => (
          <Box key={item.key} height={ITEM_HEIGHT} flexGrow={0} flexShrink={0}>
            <Text>{item.label}</Text>
          </Box>
        ))}
      </ControlledScrollView>
      <Text dimColor>
        ↑↓ scroll | items rendered: {visEnd - visStart}/{TOTAL}
      </Text>
    </Box>
  );
}

render(React.createElement(Test));
