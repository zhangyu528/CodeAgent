import React, { useEffect, useRef } from 'react';
import { Box } from 'ink';
import { InitPage } from './pages/init/InitPage.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAppController } from './AppController.js';
import { EscapeApp } from '../escape/EscapeApp.js';

import type { AgentSession } from '@codeagent/core';

interface AppProps {
  initPromise: Promise<AgentSession>;
}

export function App({ initPromise }: AppProps) {
  const { page, terminalSize } = useAppController({ initPromise });
  const escapeAppRef = useRef<EscapeApp | null>(null);

  // Mount/unmount EscapeApp when page leaves 'init'
  useEffect(() => {
    if (page !== 'init' && !escapeAppRef.current) {
      escapeAppRef.current = new EscapeApp({ initPromise });
      escapeAppRef.current.start();
    }
    return () => {
      if (escapeAppRef.current) {
        escapeAppRef.current.stop();
        escapeAppRef.current = null;
      }
    };
  }, [page, initPromise]);

  if (page === 'init') {
    return (
      <ErrorBoundary>
        <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
          <InitPage />
        </Box>
      </ErrorBoundary>
    );
  }

  // Non-init pages: EscapeApp handles all rendering — return empty Box
  // EscapeApp writes directly to stdout, so Ink just mounts an empty container
  return (
    <ErrorBoundary>
      <Box width={terminalSize.width} height={terminalSize.height} />
    </ErrorBoundary>
  );
}
