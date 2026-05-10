/**
 * EscapeChatPage — 聊天页面
 */

import React, { useEffect, useRef } from 'react';
import { Box } from 'ink';
import {
  cursorTo,
  write,
  getTerminalSize,
  setScrollRegion,
  T,
} from '../core/Terminal.js';
import { computeLayout } from '../core/Layout.js';
import { useChatStore } from '../../ink/store/index.js';
import { useAppStore } from '../../ink/store/uiStore.js';
import { useAgentEvents } from '../../ink/hooks/useAgentEvents.js';
import { getAgentSession } from '@codeagent/backend';

export function EscapeChatPage() {
  const { rows, cols } = getTerminalSize();
  const layout = computeLayout(rows, cols);
  const renderedRef = useRef(false);

  const page = useAppStore(s => s.page);
  const pendingPrompt = useChatStore(s => s.pendingPrompt);
  const getAndClearPendingPrompt = useChatStore(s => s.getAndClearPendingPrompt);
  const ensureSessionForPrompt = useChatStore(s => s.ensureSessionForPrompt);
  const persistCurrentSession = useChatStore(s => s.persistCurrentSession);
  const addMessage = useChatStore(s => s.addMessage);
  const currentSession = useChatStore(s => s.currentSession);

  const session = getAgentSession();
  const agent = session?.agent;

  useAgentEvents(session, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onAgentEnd: () => { persistCurrentSession('completed'); },
    onTurnSettled: () => {},
    onError: error => { console.error('[EscapeChatPage]', error); },
  });

  // Process pending prompt
  const processedRef = useRef(false);
  useEffect(() => {
    if (page !== 'chat') return;
    if (processedRef.current) return;
    processedRef.current = true;

    const pending = pendingPrompt;
    if (!pending) return;

    ensureSessionForPrompt(pending);
    addMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      title: 'You',
      createdAt: Date.now(),
      status: 'completed',
      blocks: [{ kind: 'text', text: pending }],
    });
    getAndClearPendingPrompt();
    if (agent) void agent.prompt(pending);
  }, [page]);

  // Render UI once
  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;

    const { rows: r, cols: c } = getTerminalSize();

    // Header row 1
    write(cursorTo(1, 1));
    write(`${T.bold}${T.fg.cyan}${currentSession?.title || 'CodeAgent'}${T.reset}  `);
    write(`${T.dim}${currentSession?.status || ''}  ${currentSession?.messageCount || 0} msgs${T.reset}`);

    // Header row 2: separator
    write(cursorTo(2, 1));
    write(`${T.dim}${'─'.repeat(c)}${T.reset}`);

    // Scroll region
    const scrollTop = 3;
    const scrollBottom = r - 6;
    write(setScrollRegion(scrollTop, scrollBottom));

    // Clear scroll region
    for (let row = scrollTop; row <= scrollBottom; row++) {
      write(cursorTo(row, 1));
      write(`${' '.repeat(c)}`);
    }

    // Input area
    const inputRow = r - 4;
    write(cursorTo(inputRow, 1));
    write(`${T.fg.cyan} CHAT ${T.reset} `);

    // Footer
    write(cursorTo(r, 1));
    write(`${T.dim}Ctrl+C=exit${' '.repeat(Math.max(1, c - 20))}${process.cwd()}${T.reset}`);

    // Cursor to input
    write(cursorTo(inputRow, 8));
  }, []);

  if (page !== 'chat') return null;

  return (
    <Box flexDirection="column">
      <Box />
    </Box>
  );
}
