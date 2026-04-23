/**
 * EscapeApp — 全 Escape Sequence 渲染，零 Ink 依赖
 *
 * 架构：
 * - 纯 JS class，生命周期基于 useEffect
 * - stdin/stdout 直接操作，不经过 Ink
 * - 状态订阅通过 useAppStore.getState() 轮询
 */

import React, { useEffect } from 'react';
import { InitPage } from '../ink/pages/init/InitPage.js';
import { useAppStore } from '../ink/store/uiStore.js';
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
  hideCursor,
  showCursor,
} from './core/Terminal.js';
import { ASCII_LOGO } from '../ink/pages/welcome/constants.js';
import { InputController } from './InputController.js';

interface EscapeAppProps {
  initPromise?: Promise<AgentSession>;
}

export function EscapeApp({ initPromise }: EscapeAppProps) {
  const page = useAppStore(s => s.page);
  const setPage = useAppStore.getState().setPage;
  const inputCtrlRef = React.useRef<InputController | null>(null);

  // ── Init → Welcome ──────────────────────────────────────────────────────
  useEffect(() => {
    if (page !== 'init' || !initPromise) return;

    initPromise.then(async () => {
      setPage('welcome');

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
  }, [page]);

  // ── Render on page change ────────────────────────────────────────────────
  useEffect(() => {
    if (page === 'init') return;

    const { rows, cols } = getTerminalSize();

    if (page === 'welcome') {
      renderWelcome(rows, cols);
      // Start input controller for welcome
      inputCtrlRef.current = new InputController({
        rows,
        cols,
        onSubmit: (value: string) => {
          // Transition to chat
          useChatStore.getState().setPendingPrompt(value);
          setPage('chat');
        },
      });
      inputCtrlRef.current.start();
    } else if (page === 'chat') {
      // Stop welcome input controller
      inputCtrlRef.current?.stop();
      inputCtrlRef.current = null;

      renderChat(rows, cols);
    }
  }, [page]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      inputCtrlRef.current?.stop();
      write(showCursor());
      write(exitAlternateScreen());
    };
  }, []);

  if (page === 'init') {
    return <InitPage />;
  }

  return null;
}

// ─── Store helper ─────────────────────────────────────────────────────────────

const useChatStore = {
  getState: () => ({ setPendingPrompt: (v: string) => useAppStore.getState().setPendingPrompt?.(v) }),
};

// ─── Render functions ─────────────────────────────────────────────────────────

function renderWelcome(rows: number, cols: number): void {
  write(enterAlternateScreen());
  write(hideCursor());
  write(clearScreen());

  const logoWidth = ASCII_LOGO[0].length;
  const logoLeft = Math.floor((cols - logoWidth) / 2);
  const logoStart = Math.floor((rows - 7) / 2);

  for (let i = 0; i < ASCII_LOGO.length; i++) {
    write(cursorTo(logoStart + i, logoLeft));
    write(`${T.fg.cyan}${ASCII_LOGO[i]}${T.reset}`);
  }

  const vRow = logoStart + ASCII_LOGO.length + 1;
  write(cursorTo(vRow, Math.floor((cols - 20) / 2)));
  write(`${T.bold}${T.fg.blue}CodeAgent${T.reset} ${T.dim}v0.1.0${T.reset}`);

  write(cursorTo(vRow + 3, Math.floor((cols - 30) / 2)));
  write(`${T.dim}Type a message to start${T.reset}`);

  // Input prompt line
  const inputRow = rows - 4;
  write(cursorTo(inputRow, 1));
  write(cursorTo(inputRow, Math.floor((cols - 40) / 2)));
  write(`${T.fg.cyan} CHAT ${T.reset} `);
  write(`${T.dim}Your message...${T.reset}`);

  write(cursorTo(inputRow, Math.floor((cols - 40) / 2) + 8));

  // Footer
  write(cursorTo(rows, 1));
  write(`${T.dim}Ctrl+C to exit${T.reset}`);
}

function renderChat(rows: number, cols: number): void {
  write(enterAlternateScreen());
  write(hideCursor());
  write(clearScreen());

  // Header
  write(cursorTo(1, 1));
  write(`${T.bold}${T.fg.cyan}CodeAgent${T.reset}  `);
  write(`${T.dim}chat${T.reset}  ${T.dim}0 msgs${T.reset}`);

  write(cursorTo(2, 1));
  write(`${T.dim}${'─'.repeat(cols)}${T.reset}`);

  // Scroll region (rows 3 to rows-6)
  write(cursorTo(3, 1));
  write(`${' '.repeat(cols)}`);

  // Input area
  const inputRow = rows - 4;
  write(cursorTo(inputRow, 1));
  write(`${T.fg.cyan} CHAT ${T.reset} `);

  // Footer
  write(cursorTo(rows, 1));
  write(`${T.dim}Ctrl+C=exit${' '.repeat(Math.max(1, cols - 20))}${process.cwd()}${T.reset}`);

  // Cursor to input
  write(cursorTo(inputRow, 8));
}
