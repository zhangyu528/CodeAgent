import React from 'react';
import { Box, Text } from 'ink';
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
  const { hasSlash, commands, selectedIndex } = useSlashList(inputValue, modelConfig, setInputValue);

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
    <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <Text dimColor>────── Slash Commands ──────</Text>
      {commands.length > 0 ? (
        <>
          {windowItems.map((item, idx) => {
            const globalIndex = windowStart + idx;
            const isSelected = globalIndex === selectedIndex;
            
            const indicator = isSelected ? '› ' : '  ';
            const nameStr = padToWidth(item.name, 12);
            const descStr = padToWidth(truncateToWidth(item.description, 35), 35);
            const catStr = `[${item.category}]`;
            
            const lineStr = `${indicator}${nameStr}  ${descStr}  ${catStr}`;

            return (
              <Box key={item.name}>
                {isSelected ? (
                  <Text color="black" backgroundColor="cyan" bold>{lineStr}</Text>
                ) : (
                  <Text>
                    <Text>{indicator}</Text>
                    <Text color="white">{nameStr}</Text>
                    <Text color="gray">  {descStr}  </Text>
                    <Text color="blue" dimColor>{catStr}</Text>
                  </Text>
                )}
              </Box>
            );
          })}
          {total > maxVisible && (
            <Box marginTop={1}>
              <Text dimColor italic>{`[${selectedIndex + 1}/${total}] use ↑/↓ to navigate`}</Text>
            </Box>
          )}
        </>
      ) : (
        <Box>
          <Text dimColor italic>No commands found</Text>
        </Box>
      )}
    </Box>
  );
}

