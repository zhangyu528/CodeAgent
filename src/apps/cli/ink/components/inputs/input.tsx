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

  const borderColor = isExitHint ? 'red' : 'cyan';
  const placeholder = isWelcome ? 'Ask anything to start...' : 'Type a message...';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={borderColor} 
      paddingY={1}
      width={isWelcome ? 80 : '100%'}
    >
      {isWelcome ? (
        <>
          <InputField value={value} placeholder={placeholder} />
          <SlashList inputValue={value} setInputValue={setValue} />
        </>
      ) : (
        <>
          <SlashList inputValue={value} setInputValue={setValue} />
          <InputField value={value} placeholder={placeholder} />
        </>
      )}

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
