import React from 'react';
import { Box, Text } from 'ink';
import { InputField } from './InputField.js';
import { SlashList } from './SlashList.js';
import { useInput } from './InputController.js';
import { ModelIndicator } from './ModelIndicator.js';
import { CwdIndicator } from './CwdIndicator.js';
import { ContextBar } from '../chat/ContextBar.js';

interface InputProps {
  /** Show welcome-mode styling (no context bar, centered layout) */
  isWelcome?: boolean;
}

export function Input({ isWelcome = false }: InputProps) {
  const { value, setValue, isExitHint } = useInput();

  const isCommandMode = value.startsWith('/') && !value.includes(' ');
  const borderColor = isExitHint ? 'red' : (isCommandMode ? 'blue' : 'cyan');
  const placeholder = isWelcome ? 'Ask anything to start...' : 'Type a message...';

  return (
    <Box flexDirection="column" width={isWelcome ? 80 : '100%'} flexGrow={0} flexShrink={0} backgroundColor="#161625" paddingY={1}>
      <SlashList inputValue={value} setInputValue={setValue} />
      <Box paddingY={1}>
        <InputField value={value} placeholder={placeholder} isCommandMode={isCommandMode} />
      </Box>

      <Box height={1} />

      {isExitHint ? (
        <Box width="100%" paddingX={1} justifyContent="center">
          <Text color="white" backgroundColor="red" bold> 再按一次 Ctrl+C 或 Ctrl+D 退出 </Text>
        </Box>
      ) : (
        <Box width="100%" paddingX={1} justifyContent="space-between">
          <Box flexShrink={0} flexDirection="row">
            <ModelIndicator />
            {!isWelcome && (
              <>
                <Text color="gray">  </Text>
                <ContextBar />
              </>
            )}
          </Box>
          <CwdIndicator />
        </Box>
      )}
    </Box>
  );
}
