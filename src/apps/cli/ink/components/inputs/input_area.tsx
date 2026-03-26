import React from 'react';
import { Box, Text } from 'ink';
import { InputAreaProps } from './types.js';
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
  const borderColor = props.exitPromptVisible ? "red" : (props.isDimmed ? "gray" : (hasValue ? "cyan" : "gray"));

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

      <Box flexDirection="column" borderDimColor={props.isDimmed}>
        <Box justifyContent="space-between">
            <InputBar 
                value={props.value} 
                page={props.page} 
                placeholder={isWelcome ? "Ask anything to start..." : "Type your message..."} 
            />
            {props.exitPromptVisible && (
                <Box paddingRight={2}>
                    <Text color="red" bold inverse> Press again to Exit </Text>
                </Box>
            )}
        </Box>
        <Box height={1} />
        <Box paddingX={1} marginBottom={showPopups ? 0 : 0}>
            <Text>
                <Text color="gray">Model: </Text>
                {props.modelName ? (
                    <Text color={props.isDimmed ? "gray" : "blue"} bold={!props.isDimmed}>{props.modelName}</Text>
                ) : (
                    <Text color="red" italic>not configured</Text>
                )}
                {props.thinking && (
                    <>
                        <Text color="gray">   •   </Text>
                        <Text color="magenta">thinking...</Text>
                    </>
                )}
                {props.usage && !props.thinking && (
                    <>
                        <Text color="gray">   •   </Text>
                        <Text color="gray">In: </Text>
                        <Text color="green">{props.usage.input}</Text>
                        <Text color="gray"> Out: </Text>
                        <Text color="cyan">{props.usage.output}</Text>
                        {props.usage.cost > 0 && (
                            <>
                                <Text color="gray"> Cost: </Text>
                                <Text color="yellow">${props.usage.cost.toFixed(4)}</Text>
                            </>
                        )}
                    </>
                )}
                <Text color="gray">   •   </Text>
                <Text color="gray">CWD: </Text>
                <Text color="yellow" dimColor>{shortenPath(props.cwd)}</Text>
            </Text>
        </Box>
      </Box>

      {/* Welcome mode: popups below InputBar */}
      {isWelcome && showPopups && !props.isDimmed && (
        <><Box height={1} /><Box flexDirection="column" width="100%">{renderPopups()}</Box></>
      )}
    </Box>
  );
}

