import React from 'react';
import { Box, Text } from 'ink';
import { InputField } from './InputField.js';
import { SlashList } from './SlashList.js';
import { useInput } from './InputController.js';

export function Input() {
  const {
    value,
    setValue,
    isExitHint,
    isWelcome,
    modelLabel,
    cwdLabel,
  } = useInput();

  const isCommandMode = value.startsWith('/') && !value.includes(' ');
  const borderColor = isExitHint ? 'red' : (isCommandMode ? 'blue' : 'cyan');
  const placeholder = isWelcome ? 'Ask anything to start...' : 'Type a message...';

  return (
    <Box 
      flexDirection="column" 
      width={isWelcome ? 80 : '100%'}
      backgroundColor="#161625"
      paddingY={1}
    >
      <SlashList inputValue={value} setInputValue={setValue} />
      <Box paddingY={1}>
        <InputField value={value} placeholder={placeholder} isCommandMode={isCommandMode} />
      </Box>

      <Box height={1} />

      <Box paddingX={1} justifyContent="space-between">
        {isExitHint ? (
          <Box width="100%" justifyContent="center">
            <Text color="white" backgroundColor="red" bold> 再按一次 Ctrl+C 或 Ctrl+D 退出 </Text>
          </Box>
        ) : (
          <>
            <Text>
              <Text color="gray">Model: </Text>
              {modelLabel ? (
                <Text color="blue" bold>{modelLabel}</Text>
              ) : (
                <Text color="red" italic>not configured</Text>
              )}
            </Text>
            <Box paddingLeft={2}>
              <Text color="gray">CWD: </Text>
              <Text color="yellow" dimColor>{cwdLabel}</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
