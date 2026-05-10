/**
 * ChatPage.tsx — Back to pure Ink scrolling with overflowToBackbuffer.
 *
 * Layout:
 *   [Header — fixed]
 *   [ScrollableMessageList — flexGrow=1, overflowY="scroll" overflowToBackbuffer]
 *   [Input — fixed at bottom]
 *
 * overflowToBackbuffer={true} pushes completed messages into terminal scrollback.
 * stableScrollback={true} keeps scrollback stable when content shrinks.
 * Mouse wheel: handled by overflowToBackbuffer mechanism (terminal native scroll).
 */
import React, { useEffect, useState } from 'react';
import { Box, useStdout } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { ScrollableMessageList } from '../../components/chat/ScrollableMessageList.js';
import { useChatStore } from '../../store/index.js';
import { useAgentEvents } from '../../hooks/useAgentEvents.js';
import { getAgentSession } from '@codeagent/backend';

export function ChatPage() {
  const session = getAgentSession();
  const agent = session.agent;
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows || 24);

  useEffect(() => {
    const handleResize = () => setTerminalRows(stdout.rows);
    stdout.on('resize', handleResize);
    return () => stdout.off('resize', handleResize);
  }, [stdout]);

  const { hydrateFromAgentState, appendUserMessage } = useAgentEvents(session, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onTurnSettled: status => {
      useChatStore.getState().persistCurrentSession(status, agent.state.messages as any);
    },
  });

  // Handle pending prompt from WelcomePage
  useEffect(() => {
    const pending = useChatStore.getState().getAndClearPendingPrompt();
    if (!pending) {
      hydrateFromAgentState();
      return;
    }
    useChatStore.getState().ensureSessionForPrompt(pending);
    appendUserMessage(pending);
    void agent.prompt(pending);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSession = useChatStore(state => state.currentSession);
  const headerRows = currentSession ? 2 : 1;
  const inputRows = 8;
  const availableRows = Math.max(1, terminalRows - headerRows - inputRows);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexShrink={0}>
        <ChatHeader session={currentSession} />
      </Box>
      <ScrollableMessageList messages={useChatStore(state => state.messages)} availableRows={availableRows} />
      <Box flexShrink={0}>
        <Input />
      </Box>
    </Box>
  );
}
