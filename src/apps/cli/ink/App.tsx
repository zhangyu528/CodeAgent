import React from 'react';
import { Box } from 'ink';
import { InitPage } from './pages/init/InitPage.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAppController } from './AppController.js';

import type { AgentSession } from '@codeagent/core';

interface AppProps {
  initPromise: Promise<AgentSession>;
}

export function App({ initPromise }: AppProps) {
  const { page, terminalSize } = useAppController({ initPromise });

  if (page === 'init') {
    return (
      <ErrorBoundary>
        <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
          <InitPage />
        </Box>
      </ErrorBoundary>
    );
  }

  // Non-init pages: App renders nothing, EscapeApp takes over in index.tsx
  return (
    <ErrorBoundary>
      <Box width={terminalSize.width} height={terminalSize.height} />
    </ErrorBoundary>
  );
}
