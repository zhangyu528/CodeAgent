import React, { useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { MessageList } from '../../components/chat/MessageList.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { useMessageStore } from '../../store/messageStore.js';
import { useAgentEvents } from '../../hooks/useAgentEvents.js';
import { getAgent } from '../../../../../agent/index.js';
import { hasAnyModalOpen } from '../../components/modals/index.js';

export function ChatPage() {
  const agent = getAgent();
  const messages = useMessageStore(state => state.messages);
  const isModalOpen = hasAnyModalOpen();
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
      useSessionStore.getState().persistCurrentSession(status, agent.state.messages);
    },
  });

  // Handle pending prompt from WelcomePage - runs once when component mounts
  useEffect(() => {
    // Get pending prompt from WelcomePage
    const pending = useSessionStore.getState().getAndClearPendingPrompt();

    if (!pending) {
      // No pending prompt - hydrate from agent state if available
      hydrateFromAgentState();
      return;
    }

    // Has pending prompt - create session, add user message, and send to agent
    useSessionStore.getState().ensureSessionForPrompt(pending);
    appendUserMessage(pending);
    void agent.prompt(pending);
  }, []); // Run only once on mount

  const currentSession = useSessionStore(state => state.currentSession);
  const headerRows = currentSession ? 2 : 0;
  // Account for header, input (approx 8 rows), and debug panel hint (1 row)
  const availableRows = Math.max(1, terminalRows - headerRows - 9);
  const viewportHeight = availableRows;

  return (
    <Box flexDirection="column" paddingX={2} flexGrow={1}>
      <Box flexShrink={0}>
        <ChatHeader session={currentSession} />
      </Box>
      <Box height={availableRows} flexShrink={0} overflow="hidden">
        <MessageList
          messages={messages}
          scrollEnabled={true}
          availableRows={viewportHeight}
          isModalOpen={isModalOpen}
        />
      </Box>
      <Box flexShrink={0}>
        <Input />
      </Box>
    </Box>
  );
}
