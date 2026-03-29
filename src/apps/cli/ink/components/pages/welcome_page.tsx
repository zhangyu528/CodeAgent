import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { WelcomeProps } from './types.js';

const ASCII_LOGO = [
  ' ██████  ██████  ██████  ███████  █████   ██████  ███████ ███    ██ ████████ ',
  '██      ██    ██ ██   ██ ██      ██   ██ ██       ██      ████   ██    ██    ',
  '██      ██    ██ ██   ██ █████   ███████ ██   ███ █████   ██ ██  ██    ██    ',
  '██      ██    ██ ██   ██ ██      ██   ██ ██    ██ ██      ██  ██ ██    ██    ',
  ' ██████  ██████  ██████  ███████ ██   ██  ██████  ███████ ██   ████    ██    ',
];



export function WelcomePage(props: WelcomeProps) {
  const { rows = 24, cols = 80, isDimmed } = props;

  // Logo 呼吸效果：cyan 在两个色阶间切换
  const [isPulse, setIsPulse] = useState(false);
  useEffect(() => {
    if (!isDimmed) {
      const interval = setInterval(() => {
        setIsPulse(p => !p);
      }, 500);
      return () => clearInterval(interval);
    }
    return () => {};
  }, [isDimmed]);

  const logoColor = isDimmed ? "gray" : (isPulse ? "#06b6d4" : "#0891b2");

  return (
    <Box flexDirection="column" height="100%" width="100%" justifyContent="center" alignItems="center">
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        {ASCII_LOGO.map((line, idx) => (
          <Text key={idx} color={logoColor} dimColor={!!isDimmed}>{line}</Text>
        ))}
        <Box marginTop={1}>
          <Text bold dimColor={!!isDimmed}>CodeAgent </Text><Text dimColor>v{props.version}</Text>
        </Box>
      </Box>

      {props.children && (
        <Box width={Math.min(cols - 4, 80)} marginTop={0}>
          {props.children}
        </Box>
      )}

      {props.logs.length > 0 && (
        <Box marginTop={2} flexDirection="column" alignItems="center">
          {props.logs.slice(-2).map((log, idx) => (
            <Text key={idx} dimColor italic>· {log}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

