import React, { useEffect } from 'react';
import { Box } from 'ink';
import { InitPage } from './pages/init/InitPage.js';
import { WelcomePage } from './pages/welcome/WelcomePage.js';
import { ChatPage } from './pages/chat/ChatPage.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAppController } from './AppController.js';

export function App({ initPromise }: { initPromise?: Promise<any> }) {
  const { page, terminalSize } = useAppController({ initPromise });

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
