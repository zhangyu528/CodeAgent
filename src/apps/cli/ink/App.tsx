import React from 'react';
import { Box } from 'ink';
import { WelcomePage, ChatPage } from './pages/index.js';
import { InitPage } from './pages/init/InitPage.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAppController } from './AppController.js';
import { EscapeApp } from '../escape/index.js';

import type { AgentSession } from '@codeagent/core';

// Escape chat mode: enabled via CODEAGENT_ESCAPE_CHAT=1
const USE_ESCAPE_CHAT = process.env.CODEAGENT_ESCAPE_CHAT === '1';

interface AppProps {
  initPromise: Promise<AgentSession>;
}

export function App({ initPromise }: AppProps) {
  const { page, terminalSize } = useAppController({ initPromise });

  // Use EscapeApp for chat/welcome pages (full Escape Sequence rendering)
  if (USE_ESCAPE_CHAT && page !== 'init') {
    return (
      <ErrorBoundary>
        <EscapeApp initPromise={initPromise} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
        {page === 'init' && <InitPage />}
        {page === 'welcome' && <WelcomePage />}
        {page === 'chat' && <ChatPage />}
        <ModalContainer />
      </Box>
    </ErrorBoundary>
  );
}
