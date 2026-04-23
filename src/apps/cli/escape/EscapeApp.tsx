/**
 * EscapeApp — 全 Escape Sequence 渲染的 App
 *
 * 替代 src/apps/cli/ink/App.tsx
 *
 * 架构：
 * - EscapeApp 自身不渲染任何 Ink 元素
 * - 统一管理 alternate screen 进入/退出
 * - 每个页面组件只需在 useEffect 里调用 renderXxx() 即可
 */

import React, { useEffect } from 'react';
import { Box } from 'ink';
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
import type { Layout } from './core/Layout.js';

interface EscapeAppProps {
  initPromise?: Promise<AgentSession>;
}

export function EscapeApp({ initPromise }: EscapeAppProps) {
  const { page, setPage } = useAppStore();

  useKeyboardShortcuts();

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
  }, [page, initPromise, setPage]);

  // ── Cleanup alternate screen on unmount ────────────────────────────────
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

  return (
    <ErrorBoundary>
      <Box flexDirection="column" width={getTerminalSize().cols} height={getTerminalSize().rows}>
        {page === 'welcome' && <WelcomePage />}
        {page === 'chat' && <ChatPage />}
      </Box>
    </ErrorBoundary>
  );
}

// ─── Welcome Page ──────────────────────────────────────────────────────────────

function WelcomePage() {
  useEffect(() => {
    const { rows, cols } = getTerminalSize();
    const layout = computeLayout(rows, cols);

    write(enterAlternateScreen());
    write(clearScreen());

    // Logo 居中 (5 行 logo + 1 行版本)
    const logoStart = Math.floor((rows - 6) / 2);
    const logoWidth = ASCII_LOGO[0].length;
    const logoLeft = Math.floor((cols - logoWidth) / 2);

    for (let i = 0; i < ASCII_LOGO.length; i++) {
      write(cursorTo(logoStart + i, logoLeft));
      write(`${T.fg.cyan}${ASCII_LOGO[i]}${T.reset}`);
    }

    // Version
    const versionRow = logoStart + ASCII_LOGO.length + 1;
    write(cursorTo(versionRow, 1));
    write(cursorTo(versionRow, Math.floor((cols - 20) / 2)));
    write(`${T.bold}${T.fg.blue}CodeAgent${T.reset} ${T.dim}v0.1.0${T.reset}`);

    // 提示：输入消息开始
    const promptRow = versionRow + 3;
    write(cursorTo(promptRow, 1));
    write(cursorTo(promptRow, Math.floor((cols - 30) / 2)));
    write(`${T.dim}Type a message to start...${T.reset}`);

    // 输入框提示
    const inputRow = rows - 3;
    write(cursorTo(inputRow, 1));
    write(cursorTo(inputRow, 1));
    write(`${T.fg.cyan} CHAT ${T.reset} `);
    write(`${T.dim}Type a message...${T.reset}`);
    write(cursorTo(inputRow, logoLeft + 8));

    return () => {
      write(exitAlternateScreen());
    };
  }, []);

  return null;
}

// ─── Chat Page ───────────────────────────────────────────────────────────────

function ChatPage() {
  useEffect(() => {
    const { rows, cols } = getTerminalSize();
    const layout = computeLayout(rows, cols);

    write(enterAlternateScreen());
    write(clearScreen());

    // 渲染 header
    renderChatHeader(layout, null);

    // 渲染输入区
    renderInput(layout, false);

    // 光标移到输入行
    const inputRow = layout.inputTop + 1;
    write(cursorTo(inputRow, 8));

    return () => {
      write(exitAlternateScreen());
    };
  }, []);

  return null;
}

// ─── 渲染函数 ───────────────────────────────────────────────────────────────

function renderChatHeader(layout: Layout, session: { title?: string; status?: string } | null): void {
  const { cols, headerTop, headerBottom } = layout;

  // Row 1: 标题
  write(cursorTo(headerTop, 1));
  write(`${T.bold}${T.fg.cyan}${session?.title || 'CodeAgent'}${T.reset}  `);
  write(`${T.dim}${session?.status || ''}${T.reset}`);

  // Row 2: 分隔线
  write(cursorTo(headerBottom, 1));
  write(`${T.dim}${'─'.repeat(cols)}${T.reset}`);
}

function renderInput(layout: Layout, isWelcome: boolean): void {
  const { rows, cols, inputTop } = layout;
  const line = inputTop + 1;

  write(cursorTo(line, 1));
  write(`${T.fg.cyan} CHAT ${T.reset} `);
  write(`${T.dim}${isWelcome ? 'Type a message...' : 'Message the assistant...'}${T.reset}`);

  // 底部信息行
  write(cursorTo(rows, 1));
  write(`${T.dim}Ctrl+C=exit${T.reset}${' '.repeat(Math.max(1, cols - 20))}${T.dim}${process.cwd()}${T.reset}`);
  write(cursorTo(line, 8));
}
