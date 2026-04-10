import React, { useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { MessageList } from '../../components/chat/MessageList.js';
import { useChatStore } from '../../store/index.js';
import { useAgentEvents } from '../../hooks/useAgentEvents.js';
import { useAgent } from '../../context/index.js';

export function ChatPage() {
  const agent = useAgent();
  const messages = useChatStore(state => state.messages);
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = React.useState(stdout.rows || 24);

  React.useEffect(() => {
    const onResize = () => setTerminalRows(stdout.rows);
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const {
    hydrateFromAgentState,
    appendUserMessage,
  } = useAgentEvents(agent, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onTurnSettled: (status) => {
      useChatStore.getState().persistCurrentSession(status, agent.state.messages);
    },
  });

  // Handle pending prompt from WelcomePage - runs once when component mounts
  useEffect(() => {
    // Get pending prompt from WelcomePage
    const pending = useChatStore.getState().getAndClearPendingPrompt();

    if (!pending) {
      // No pending prompt - hydrate from agent state if available
      hydrateFromAgentState();
      return;
    }

    // Has pending prompt - create session, add user message, and send to agent
    useChatStore.getState().ensureSessionForPrompt(pending);
    appendUserMessage(pending);
    void agent.prompt(pending);
  }, []); // Run only once on mount

  const currentSession = useChatStore(state => state.currentSession);
  const headerRows = currentSession ? 2 : 0;
  // Account for header, input (approx 7 rows + 2 margin), and debug panel hint (1 row)
  const availableRows = Math.max(1, terminalRows - headerRows - 9);
  const viewportHeight = availableRows;

  return (
    <Box flexDirection="column" paddingX={2} flexGrow={1} height="100%">
      <Box flexShrink={0}>
        <ChatHeader session={currentSession} />
      </Box>
      <Box height={availableRows} flexShrink={0} overflow="hidden">
        <MessageList
          messages={messages}
          scrollEnabled={true}
          availableRows={viewportHeight}
        />
      </Box>
      <Box flexShrink={0}>
        <Input />
      </Box>
    </Box>
  );
}
