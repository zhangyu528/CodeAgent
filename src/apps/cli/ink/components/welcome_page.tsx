import React from 'react';
import { Box, Text } from 'ink';
import { WelcomeProps } from './types.js';

const ASCII_LOGO = [
  '  ___            _        _                    _  ',
  ' / __|___  __| | ___   /_\\\\  __ _ ___ _ _  __| |_ ',
  "| (__/ _ \\\\/ _` |/ -_) / _ \\\\/ _` / -_) ' \\\\/ _`  _|",
  ' \\\\___\\\\___/\\\\__,_|\\\\___|/_/ \\\\_\\\\__, \\\\___|_||_\\\\__,_\\\\__|',
  '                           |___/                  ',
];

export function WelcomePage(props: WelcomeProps) {
  const { rows = 24, cols = 80, isDimmed } = props;
  return (
    <Box flexDirection="column" height="100%" width="100%" justifyContent="center" alignItems="center">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {ASCII_LOGO.map((line, idx) => (
          <Text key={idx} color={isDimmed ? "gray" : "cyan"} dimColor={!!isDimmed}>{line}</Text>
        ))}
      </Box>

      <Box borderStyle="round" borderColor="gray" borderDimColor={!!isDimmed} paddingX={2} flexDirection="column" alignItems="center">
        <Box marginBottom={1}>
          <Text bold dimColor={!!isDimmed}>CodeAgent </Text>
          <Text dimColor>v{props.version}</Text>
        </Box>
        
        <Box flexDirection="column">
          <Box>
            <Text color="gray" dimColor={!!isDimmed}>Provider: </Text>
            <Text color={isDimmed ? "gray" : "green"} dimColor={!!isDimmed}>{props.provider || 'unknown'}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor={!!isDimmed}>Workspace: </Text>
            <Text dimColor>{props.cwd}</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text dimColor={!!isDimmed}>
          Type a message to <Text color={isDimmed ? "gray" : "cyan"} bold dimColor={!!isDimmed}>Start Chat</Text>
        </Text>
        <Text dimColor>
          or use <Text color={isDimmed ? "gray" : "yellow"} dimColor={!!isDimmed}>/resume</Text> to continue last session • <Text color={isDimmed ? "gray" : "yellow"} dimColor={!!isDimmed}>/history</Text> to pick
        </Text>
      </Box>

      {props.children && (
        <Box width={Math.min(cols - 4, 80)} marginTop={1}>
          {props.children}
        </Box>
      )}

      {props.logs.length > 0 && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          {props.logs.slice(-2).map((log, idx) => (
            <Text key={idx} dimColor italic>· {log}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
