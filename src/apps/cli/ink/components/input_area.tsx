import React from 'react';
import { Box, Text } from 'ink';
import { InputBarProps, InputAreaProps } from './types.js';
import { InputBar } from './input_bar.js';
import { SlashPalette } from './slash_palette.js';
import { HistoryPicker } from './history_picker.js';

function shortenPath(fullPath: string): string {
  try {
    const parts = fullPath.split(/[\\\/]/).filter(Boolean);
    if (parts.length <= 2) return fullPath;
    return `.../${parts.slice(-2).join('/')}`;
  } catch (e) {
    return fullPath;
  }
}

export function InputArea(props: InputAreaProps) {
  const isWelcome = props.page === 'welcome';
  const hasValue = props.value.length > 0;
  
  const showPopups = props.slashVisible || props.historyVisible;
  const borderColor = props.isDimmed ? "gray" : (hasValue ? "cyan" : "gray");

  const renderPopups = () => (
    <>{props.slashVisible && props.slashItems.length > 0 && (
      <SlashPalette 
        visible={props.slashVisible} 
        items={props.slashItems} 
        selectedIndex={props.slashSelected} 
        query={props.value}
      />
    )}{props.historyVisible && (
      <HistoryPicker 
        visible={props.historyVisible} 
        items={props.historyItems} 
        selectedIndex={props.historySelected} 
      />
    )}</>
  );

  return (
    <Box flexDirection="column" width="100%" borderStyle="round" borderColor={borderColor} paddingY={1}>
      {/* Chat mode: popups above InputBar */}
      {!isWelcome && showPopups && !props.isDimmed && (
        <>{renderPopups()}<Box height={1} /></>
      )}

      {!props.isDimmed ? (
        <><InputBar value={props.value} page={props.page} placeholder={isWelcome ? "Ask anything to start..." : "Type your message..."} /><Box height={1} /><Box paddingX={1} marginBottom={showPopups ? 0 : 0}><Text><Text color="gray">Model: </Text><Text color="blue" bold>{props.modelName}</Text><Text color="gray">   •   </Text><Text color="gray">CWD: </Text><Text color="yellow" dimColor>{shortenPath(props.cwd)}</Text></Text></Box></>
      ) : (
        <Box paddingX={1} paddingY={1} justifyContent="center">
          <Text dimColor italic>正在处理请求...</Text>
        </Box>
      )}

      {/* Welcome mode: popups below InputBar */}
      {isWelcome && showPopups && !props.isDimmed && (
        <><Box height={1} /><Box flexDirection="column" width="100%">{renderPopups()}</Box></>
      )}
    </Box>
  );
}
