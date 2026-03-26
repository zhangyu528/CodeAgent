import React from 'react';
import { Box, Text } from 'ink';

export interface ModelConfigOverlayProps {
  step: 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';
  message: string;
  choices: string[];
  selectedIndex: number;
  apiKeyInput: string;
  onUp: () => void;
  onDown: () => void;
  onEnter: () => void;
  onApiKeyInput: (key: { backspace?: boolean; delete?: boolean }, input: string) => void;
  onCancel: () => void;
}

export const ModelConfigOverlay: React.FC<ModelConfigOverlayProps> = ({
  step,
  message,
  choices,
  selectedIndex,
  apiKeyInput,
  onUp,
  onDown,
  onEnter,
  onApiKeyInput,
  onCancel,
}) => {
  if (step === 'idle') {
    return null;
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="blue">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="blue">Model Configuration</Text>
      </Box>

      {/* API Key Input Mode */}
      {step === 'entering_api_key' && (
        <Box flexDirection="column">
          <Text>{message}</Text>
          <Box marginTop={1}>
            <Text dimColor>  ❯ {apiKeyInput}</Text>
            <Text dimColor>_</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter: save | Esc: cancel | Backspace: delete</Text>
          </Box>
        </Box>
      )}

      {/* Selection Mode */}
      {(step === 'selecting_provider' || step === 'selecting_model') && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>{message}</Text>
          </Box>
          {choices.map((choice, index) => (
            <Box key={index}>
              <Text color={index === selectedIndex ? 'blue' : 'white'} bold={index === selectedIndex}>
                {index === selectedIndex ? '❯ ' : '  '}
              </Text>
              <Text color={index === selectedIndex ? 'blue' : 'white'}>
                {choice}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate | Enter: select | Esc: cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
