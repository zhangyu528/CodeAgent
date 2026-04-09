import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useSlashList } from './SlashListController.js';
import { useModelConfig } from '../../hooks/useModelConfig.js';
import { getAgent } from '../../../../../agent/index.js';
import { padToWidth, truncateToWidth } from '../modals/textLayout.js';

interface SlashListProps {
  inputValue: string;
  setInputValue: (value: string | ((prev: string) => string)) => void;
}

export function SlashList({ inputValue, setInputValue }: SlashListProps) {
  const agent = getAgent();
  const modelConfig = useModelConfig(agent);
  const { hasSlash, commands, selectedIndex, setSelectedIndex, confirmSlash, listHeight } = useSlashList(inputValue, modelConfig, setInputValue);

  // Keyboard navigation
  useInput((_, key) => {
    if (!hasSlash) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(Math.max(0, commands.length - 1), prev + 1));
      return;
    }
    if (key.return && commands.length > 0) {
      const selectedCmd = commands[selectedIndex];
      if (selectedCmd) {
        confirmSlash(selectedCmd.name);
      }
    }
  }, { isActive: hasSlash });

  if (!hasSlash) return null;

  const maxVisible = 6;
  const total = commands.length;
  let windowStart = 0;
  if (total > maxVisible) {
    if (selectedIndex < 3) {
      windowStart = 0;
    } else if (selectedIndex >= total - 3) {
      windowStart = Math.max(0, total - maxVisible);
    } else {
      windowStart = selectedIndex - 2;
    }
  }
  const windowItems = commands.slice(windowStart, windowStart + maxVisible);

  return (
    <Box 
      position="absolute"
      marginTop={-listHeight}
      flexDirection="column" 
      width="100%" 
      backgroundColor="#161625"
      paddingY={1}
    >
      <Box paddingX={3} paddingY={0}>
        <Text color="#b0b0b0" bold> COMMANDS </Text>
      </Box>
      
      {commands.length > 0 ? (
        <>
          {windowItems.map((item, idx) => {
            const globalIndex = windowStart + idx;
            const isSelected = globalIndex === selectedIndex;
            
            const indicator = isSelected ? '› ' : '  ';
            const nameStr = padToWidth(item.name, 12);
            const descStr = padToWidth(truncateToWidth(item.description, 45), 45);
            
            return (
              <Box key={item.name} paddingX={1}>
                {isSelected ? (
                  <Box backgroundColor="#2a2a3a" width="100%" paddingX={1}>
                    <Text color="white" bold>{`${indicator}${nameStr} ${descStr}`}</Text>
                  </Box>
                ) : (
                  <Box paddingX={1}>
                    <Text>
                      <Text color="#505050" bold>{indicator}</Text>
                      <Text color="#e0e0e0" bold>{nameStr}</Text>
                      <Text color="#808080"> {descStr}</Text>
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}
          {total > maxVisible && (
            <Box paddingX={2} marginTop={0}>
              <Text color="#404040" italic>{`── [${selectedIndex + 1}/${total}] use ↑/↓ to navigate ──`}</Text>
            </Box>
          )}
        </>
      ) : (
        <Box paddingX={1}>
          <Text dimColor italic>No matches found</Text>
        </Box>
      )}
    </Box>
  );
}
