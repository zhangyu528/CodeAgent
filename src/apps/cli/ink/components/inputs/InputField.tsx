import React from 'react';
import { Box, Text } from 'ink';

interface InputFieldProps {
  value: string;
  placeholder: string;
  isCommandMode?: boolean;
}

export function InputField({ value, placeholder, isCommandMode }: InputFieldProps) {
  const hasValue = value.length > 0;

  const labelText = isCommandMode ? ' COMMAND ' : ' CHAT ';
  const labelColor = isCommandMode ? 'white' : 'black';
  const labelBg = isCommandMode ? '#2a2a3a' : 'cyan';

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box alignItems="center">
        <Box backgroundColor={labelBg} marginRight={1}>
          <Text color={labelColor} bold>{labelText}</Text>
        </Box>
        {hasValue ? (
          <>
            <Text bold color={isCommandMode ? '#e0e0e0' : 'white'}>{value}</Text>
            <Text color={isCommandMode ? 'blue' : 'cyan'} bold>{'▌'}</Text>
          </>
        ) : (
          <>
            <Text color={isCommandMode ? 'blue' : 'cyan'} bold>{'▌ '}</Text>
            <Text color="#606060" italic>{placeholder}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
