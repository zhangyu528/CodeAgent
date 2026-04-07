import React, { useEffect, useRef } from 'react';
import { Box } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { MessageList } from '../../components/chat/MessageList.js';
import { useAppSession } from '../../hooks/useAppSession.js';
import { useAgentEvents } from '../../hooks/useAgentEvents.js';
import { useModalStore } from '../../components/modals/modalStore.js';
import { getAgent } from '../../../../../agent/index.js';

export function ChatPage() {
  const agent = getAgent();
  const session = useAppSession();
  const modalStore = useModalStore();
  const {
    messages,
    hydrateFromAgentState,
    appendUserMessage,
  } = useAgentEvents(agent, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onTurnSettled: (status) => {
      session.persistCurrentSession(status, agent.state.messages);
    },
  });

  const hasHandledPendingRef = useRef(false);

  useEffect(() => {
    // Handle pending prompt from WelcomePage submission
    const pending = session.getAndClearPendingPrompt();
    if (pending) {
      // Add user message to UI
      appendUserMessage(pending);
      // Send to agent (adds to agent.state.messages and starts streaming)
      void agent.prompt(pending);
    }
    // Hydrate existing messages from agent state
    hydrateFromAgentState();
    hasHandledPendingRef.current = false;
  }, [session.currentSession?.id]);

  const currentSession = session.currentSession;
  const headerRows = currentSession ? 2 : 0;
  const availableRows = 24;
  const viewportHeight = Math.max(1, availableRows - headerRows);
  const isModalOpen = modalStore.modal.kind !== 'none';

  return (
    <Box flexDirection="column" paddingX={2} height={availableRows} flexShrink={1}>
      <ChatHeader session={currentSession} />
      <Box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        height={viewportHeight}
        overflow="hidden"
      >
        <MessageList
          messages={messages}
          scrollEnabled={true}
          availableRows={viewportHeight}
          isModalOpen={isModalOpen}
        />
      </Box>
      <Box flexShrink={0} minHeight={8}>
        <Input />
      </Box>
    </Box>
  );
}
