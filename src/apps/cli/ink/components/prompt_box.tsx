import React from 'react';
import { Box, Text } from 'ink';

// Simple helper to estimate visual width of a string (considering double-width CJK characters)
function getVisualWidth(str: string): number {
  if (!str) return 0;
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode >= 0x1100) width += 2;
    else width += 1;
  }
  return width;
}

export function PromptBox(props: { title: string; body: string; input?: string; footer?: string; width: number }) {
  const { width } = props;

  // Helper to ensure every line is exactly 'width' characters long
  const renderLine = (content: string, color?: string, bold?: boolean, dim?: boolean) => {
    // We need to account for visual width, not just character length
    const currentWidth = getVisualWidth(content);
    const paddingCount = Math.max(0, width - currentWidth);
    const line = content + ' '.repeat(paddingCount);
    
    return (
      <Box width={width} {...({ backgroundColor: 'black' } as any)}>
        <Text color={color} bold={bold} dimColor={dim}>{line}</Text>
      </Box>
    );
  };

  const bodyLines = props.body.split('\n');

  return (
    <Box flexDirection="column" width={width}>
      {/* Top padding */}
      {renderLine('')}
      
      {/* Title */}
      {renderLine(`  ${props.title}`, 'cyan', true)}
      
      {/* Gap */}
      {renderLine('')}
      
      {/* Body lines */}
      {bodyLines.map((line, idx) => (
        <Box key={idx} width={width}>
          {renderLine(`  ${line}`)}
        </Box>
      ))}
      
      {/* Input section - only show if there's actual input text */}
      {props.input ? (
        <>
          {renderLine('')}
          {renderLine(`  ❯ ${props.input}`, 'white', true)}
        </>
      ) : null}

      {/* Gap */}
      {renderLine('')}
      
      {/* Footer */}
      {props.footer && renderLine(`  ${props.footer}`, 'gray', false, true)}
      
      {/* Bottom padding */}
      {renderLine('')}
    </Box>
  );
}
