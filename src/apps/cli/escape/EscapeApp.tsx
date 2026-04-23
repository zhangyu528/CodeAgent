/**
 * EscapeApp — 全 Escape Sequence 渲染的 App
 *
 * 替代 src/apps/cli/ink/App.tsx
 *
 * 页面路由：
 *   init    → InitPage (Ink，暂时保留)
 *   welcome → WelcomePlaceholder
 *   chat    → EscapeChatPage
 *
 * 状态层完全复用：
 * - Zustand stores
 * - useAgentEvents hook
 */

import React, { useEffect, useState } from 'react';
import { Box } from 'ink';
import { ErrorBoundary } from '../ink/components/ErrorBoundary.js';
import { InitPage } from '../ink/pages/init/InitPage.js';
import { EscapeChatPage } from './pages/EscapeChatPage.js';
import { useAppStore } from '../ink/store/uiStore.js';
import { useKeyboardShortcuts } from '../ink/useKeyboardShortcuts.js';
import { checkApiKeyConfigured, getModels, ensureProvidersLoaded } from '@codeagent/core';
import type { AgentSession } from '@codeagent/core';
import {
  T,
  write,
  clearScreen,
  cursorTo,
  getTerminalSize,
  enterAlternateScreen,
  exitAlternateScreen,
} from './core/Terminal.js';
import { computeLayout } from './core/Layout.js';

interface EscapeAppProps {
  initPromise?: Promise<AgentSession>;
}

export function EscapeApp({ initPromise }: EscapeAppProps) {
  const { page, setPage } = useAppStore();
  const [terminalSize, setTerminalSize] = useState({
    width: getTerminalSize().cols,
    height: getTerminalSize().rows,
  });

  useKeyboardShortcuts();

  // Init → Welcome
  useEffect(() => {
    if (page !== 'init' || !initPromise) return;

    initPromise.then(async () => {
      setPage('welcome');

      // Auto-detect first configured provider + model
      const providers = await ensureProvidersLoaded();
      for (const provider of providers) {
        if (checkApiKeyConfigured(provider)) {
          const models = getModels(provider);
          if (models && models.length > 0) {
            useAppStore.getState().setCurrentModel(models[0].id);
            break;
          }
        }
      }
    });
  }, [page, initPromise, setPage]);

  // Terminal resize
  useEffect(() => {
    const handleResize = () => {
      const { rows, cols } = getTerminalSize();
      setTerminalSize({ width: cols, height: rows });
    };
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // Cleanup alternate screen on unmount
  useEffect(() => {
    return () => {
      write(exitAlternateScreen());
    };
  }, []);

  if (page === 'init') {
    return (
      <ErrorBoundary>
        <InitPage />
      </ErrorBoundary>
    );
  }

  // welcome / chat — 全走 escape sequence
  return (
    <ErrorBoundary>
      <Box flexDirection="column" width={terminalSize.width} height={terminalSize.height}>
        {page === 'welcome' && <WelcomePlaceholder />}
        {page === 'chat' && <EscapeChatPage />}
      </Box>
    </ErrorBoundary>
  );
}

function WelcomePlaceholder(): null {
  useEffect(() => {
    write(enterAlternateScreen());
    write(clearScreen());
    write(`${cursorTo(1, 1)}${T.sgrBold()}${T.fg.blue}CodeAgent${T.sgrReset()} — Welcome`);
    write(cursorTo(getTerminalSize().rows - 1, 1));
    return () => {
      write(exitAlternateScreen());
    };
  }, []);
  return null;
}
