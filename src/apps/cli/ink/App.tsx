import React from 'react';
import { Box } from 'ink';
import { WelcomePage, ChatPage } from './pages/index.js';
import { InitPage } from './pages/init/InitPage.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAppController } from './AppController.js';
import { EscapeApp } from '../escape/index.js';

import type { AgentSession } from '@codeagent/core';

interface AppProps {
  initPromise: Promise<AgentSession>;
}

export function App({ initPromise }: AppProps) {
  const { page, terminalSize } = useAppController({ initPromise });

  // Full Escape Sequence rendering for all non-init pages
  if (page !== 'init') {
    return (
      <ErrorBoundary>
        <EscapeApp initPromise={initPromise} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
        <InitPage />
      </Box>
    </ErrorBoundary>
  );
}
