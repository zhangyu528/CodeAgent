/**
 * EscapeApp — 全 Escape Sequence 渲染，纯函数，不依赖 Ink 渲染
 *
 * React 只用于：
 * - useEffect 生命周期（mount/unount/dependency changes）
 * - store 订阅（通过 useAppStore.getState()）
 *
 * 不渲染任何 Ink 组件，process.stdout 完全由 escape sequences 控制。
 */

import React, { useEffect } from 'react';
import { ErrorBoundary } from '../ink/components/ErrorBoundary.js';
import { InitPage } from '../ink/pages/init/InitPage.js';
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
import { ASCII_LOGO } from '../ink/pages/welcome/constants.js';
import { computeLayout } from './core/Layout.js';

interface EscapeAppProps {
  initPromise?: Promise<AgentSession>;
}

// EscapeApp 本身不是一个 React 组件——它只是一个启动器
// 返回 null，因为所有 UI 都通过 escape sequence 直接写入 stdout
export function EscapeApp({ initPromise }: EscapeAppProps) {
  const page = useAppStore(s => s.page);

  useKeyboardShortcuts();

  // ── Init → Welcome ──────────────────────────────────────────────────────
  useEffect(() => {
    if (page !== 'init' || !initPromise) return;

    initPromise.then(async () => {
      useAppStore.getState().setPage('welcome');

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

  // ── Render based on page ────────────────────────────────────────────────
  useEffect(() => {
    if (page === 'init') return;

    const { rows, cols } = getTerminalSize();

    if (page === 'welcome') {
      renderWelcome(rows, cols);
    } else if (page === 'chat') {
      renderChat(rows, cols);
    }
  }, [page]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
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

  // All non-init pages: render nothing via React, all output via escape sequences
  return null;
}

// ─── Welcome ────────────────────────────────────────────────────────────────

function renderWelcome(rows: number, cols: number): void {
  write(enterAlternateScreen());
  write(clearScreen());

  // Logo 居中
  const logoWidth = ASCII_LOGO[0].length;
  const logoLeft = Math.floor((cols - logoWidth) / 2);
  const logoStart = Math.floor((rows - 7) / 2);

  for (let i = 0; i < ASCII_LOGO.length; i++) {
    write(cursorTo(logoStart + i, logoLeft));
    write(`${T.fg.cyan}${ASCII_LOGO[i]}${T.reset}`);
  }

  // Version
  const vRow = logoStart + ASCII_LOGO.length + 1;
  write(cursorTo(vRow, Math.floor((cols - 20) / 2)));
  write(`${T.bold}${T.fg.blue}CodeAgent${T.reset} ${T.dim}v0.1.0${T.reset}`);

  // 首次使用提示
  write(cursorTo(vRow + 3, Math.floor((cols - 30) / 2)));
  write(`${T.dim}Type a message to start${T.reset}`);

  // 输入行
  const inputRow = rows - 4;
  write(cursorTo(inputRow, 1));
  write(cursorTo(inputRow, Math.floor((cols - 40) / 2)));
  write(`${T.fg.cyan} CHAT ${T.reset} `);
  write(`${T.dim}Your message...${T.reset}`);
  write(cursorTo(inputRow, Math.floor((cols - 40) / 2) + 8));

  write(cursorTo(rows, 1));
  write(`${T.dim}Ctrl+C to exit${T.reset}`);
}

// ─── Chat ──────────────────────────────────────────────────────────────────

function renderChat(rows: number, cols: number): void {
  write(enterAlternateScreen());
  write(clearScreen());

  const scrollTop = 3;
  const scrollBottom = rows - 6;

  // Header
  write(cursorTo(1, 1));
  write(`${T.bold}${T.fg.cyan}CodeAgent${T.reset}  `);
  write(`${T.dim}chat${T.reset}  ${T.dim}0 msgs${T.reset}`);

  write(cursorTo(2, 1));
  write(`${T.dim}${'─'.repeat(cols)}${T.reset}`);

  // Scroll region
  write(cursorTo(scrollTop, 1));
  write(`${T.dim}${' '.repeat(cols)}${T.reset}`);

  // Input area
  const inputRow = rows - 4;
  write(cursorTo(inputRow, 1));
  write(cursorTo(inputRow, 1));
  write(`${T.fg.cyan} CHAT ${T.reset} `);

  // Footer
  write(cursorTo(rows, 1));
  write(`${T.dim}Ctrl+C=exit${' '.repeat(Math.max(1, cols - 20))}${process.cwd()}${T.reset}`);

  // Cursor to input
  write(cursorTo(inputRow, 8));
}
