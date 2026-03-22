import React from 'react';
import { Box, Text } from 'ink';
import { InputBarProps, InputAreaProps } from './types.js';
import { SlashPalette, HistoryPicker } from './palettes.js';
import { PromptBox, SelectList, SelectManyList } from './prompts.js';

export function InputBar(props: InputBarProps) {
  const hasValue = props.value.length > 0;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="cyan" bold>❯ </Text>
        <Text bold={hasValue}>{props.value}</Text>
      </Box>
    </Box>
  );
}

export function InputArea(props: InputAreaProps) {
  const isWelcome = props.page === 'welcome';
  const hasValue = props.value.length > 0;
  
  const showPopups = props.slashVisible || props.historyVisible;
  const borderColor = props.isDimmed ? "gray" : (hasValue ? "cyan" : "gray");

  const renderPopups = () => (
    <>
      <SlashPalette 
        visible={props.slashVisible} 
        items={props.slashItems} 
        selectedIndex={props.slashSelected} 
        query={props.value}
      />
      <HistoryPicker 
        visible={props.historyVisible} 
        items={props.historyItems} 
        selectedIndex={props.historySelected} 
      />
    </>
  );

  const separator = <Box height={0} />;

  return (
    <Box flexDirection="column" width="100%" borderStyle="round" borderColor={borderColor}>
      {/* Chat mode: popups above InputBar */}
      {!isWelcome && showPopups && (
        <>
          {renderPopups()}
          {separator}
        </>
      )}

      <InputBar value={props.value} page={props.page} />
      <Box paddingX={1} marginBottom={showPopups ? 0 : 0}>
        <Text dimColor italic>
          {isWelcome 
            ? 'Enter to start new session • /models to pick • /history to pick • /help for commands' 
            : 'Type message to chat • /new for welcome • /clear to reset'}
        </Text>
      </Box>

      {/* Welcome mode: popups below InputBar */}
      {isWelcome && showPopups && (
        <>
          {separator}
          <Box flexDirection="column" width="100%">
            {renderPopups()}
          </Box>
        </>
      )}
    </Box>
  );
}
