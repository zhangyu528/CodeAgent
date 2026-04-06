import React from 'react';
import { Box, Text } from 'ink';

interface InputFieldProps {
  value: string;
  placeholder: string;
}

export function InputField({ value, placeholder }: InputFieldProps) {
  const hasValue = value.length > 0;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Box>
        <Text color="cyan" bold>{'❯ '}</Text>
        {hasValue ? (
          <>
            <Text bold>{value}</Text>
            <Text color="cyan" bold>{'▌'}</Text>
          </>
        ) : (
          <>
            <Text color="cyan" bold>{'▌ '}</Text>
            <Text color="gray" dimColor italic>{placeholder}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
