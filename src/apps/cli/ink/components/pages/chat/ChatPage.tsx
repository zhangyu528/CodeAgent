import React from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, ChatPageProps } from '../types.js';
import { InputArea } from '../../inputs/index.js';
import { ChatHeader } from './ChatHeader.js';
import { MessageList } from './MessageList.js';

interface ChatPagePropsInternal {
  messages: ChatMessage[];
  availableRows: number;
  scrollEnabled?: boolean;
  isDimmed?: boolean;
  session: ChatPageProps['session'];
  inputValue: string;
  slashVisible: boolean;
  slashItems: ChatPageProps['slashItems'];
  slashSelected: number;
  modelName: string;
  cwd: string;
  exitPromptVisible: boolean;
  thinking: ChatPageProps['thinking'];
  usage: ChatPageProps['usage'];
}

export function ChatPage(props: ChatPagePropsInternal) {
  const {
    availableRows,
    isDimmed,
    messages,
    scrollEnabled = true,
    session,
    inputValue,
    slashVisible,
    slashItems,
    slashSelected,
    modelName,
    cwd,
    exitPromptVisible,
    thinking,
    usage,
  } = props;

  const headerRows = session ? 2 : 0;
  const viewportHeight = Math.max(1, availableRows - headerRows);

  return (
    <Box flexDirection="column" paddingX={2} height={availableRows} flexShrink={1}>
      <ChatHeader session={session} />
      <Box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        height={viewportHeight}
        overflow="hidden"
      >
        <MessageList
          messages={messages}
          isDimmed={isDimmed}
          scrollEnabled={scrollEnabled}
          availableRows={viewportHeight}
        />
      </Box>
      <Box flexShrink={0} minHeight={8}>
        <InputArea
          value={inputValue}
          page="chat"
          slashVisible={slashVisible}
          slashItems={slashItems}
          slashSelected={slashSelected}
          modelName={modelName}
          cwd={cwd}
          isDimmed={isDimmed}
          exitPromptVisible={exitPromptVisible}
          thinking={thinking}
          usage={usage}
        />
      </Box>
    </Box>
  );
}

// Re-export types for backwards compatibility
export type { ChatPagePropsInternal };
