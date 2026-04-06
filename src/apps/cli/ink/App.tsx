import React from 'react';
import { Box } from 'ink';
import { WelcomePage, ChatPage } from './pages/index.js';
import { LoadingPage } from './pages/loading/LoadingPage.js';
import { DebugPanel } from './components/debug/DebugPanel.js';
import { ModalContainer } from './components/modals/ModalContainer.js';
import { useAppController } from './AppController.js';

export function App() {
  const { page, terminalSize } = useAppController();

  return (
    <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
      {page === 'loading' && <LoadingPage />}
      {page === 'welcome' && <WelcomePage />}
      {page === 'chat' && <ChatPage />}
        <DebugPanel />
        <ModalContainer />
    </Box>
  );
}
