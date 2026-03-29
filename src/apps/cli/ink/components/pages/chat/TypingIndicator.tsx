import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

interface TypingIndicatorProps {
  isThinking: boolean;
  isGenerating: boolean;
}

const animChars = ['░', '▒', '▓', '█'];

export function TypingIndicator({ isThinking, isGenerating }: TypingIndicatorProps) {
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    if (!isThinking && !isGenerating) return;
    const interval = setInterval(() => {
      setAnimFrame(f => (f + 1) % 4);
    }, 200);
    return () => clearInterval(interval);
  }, [isThinking, isGenerating]);

  if (!isThinking && !isGenerating) return null;

  const label = isThinking ? 'thinking...' : 'generating...';

  return (
    <Box>
      <Text color="blue" bold>{animChars[animFrame]} </Text>
      <Text color="gray" dimColor>{label}</Text>
    </Box>
  );
}
