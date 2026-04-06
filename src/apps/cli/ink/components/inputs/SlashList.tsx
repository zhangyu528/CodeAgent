import React from 'react';
import { Box, Text } from 'ink';
import { useSlashList } from './SlashListController.js';
import { useModelConfig } from '../../hooks/useModelConfig.js';
import { getAgent } from '../../../../../agent/index.js';

interface SlashListProps {
  inputValue: string;
  setInputValue: (value: string | ((prev: string) => string)) => void;
}

export function SlashList({ inputValue, setInputValue }: SlashListProps) {
  const agent = getAgent();
  const modelConfig = useModelConfig(agent);
  const { hasSlash, commands, selectedIndex } = useSlashList(inputValue, modelConfig, setInputValue);

  if (!hasSlash) return null;

  return (
    <Box flexDirection="column" width="100%">
      {commands.length > 0 ? (
        commands.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={item.name}>
              <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
                {isSelected ? '┃ ' : '  '}
              </Text>
              <Text dimColor={!isSelected} bold={isSelected}>{item.name}</Text>
              <Text color="gray" dimColor={!isSelected}>  {item.description}</Text>
              <Text color="blue" dimColor={!isSelected}> [{item.category}]</Text>
            </Box>
          );
        })
      ) : (
        <Box>
          <Text color="gray">No commands found</Text>
        </Box>
      )}
    </Box>
  );
}


