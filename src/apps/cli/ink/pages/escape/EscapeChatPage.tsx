/**
 * EscapeChatPage - Hybrid: Ink for Header/Input, escape sequences for messages via alternate screen.
 *
 * Architecture:
 *   Main screen:     Header (Ink) + Input (Ink)          ← Ink 控制
 *   Alternate screen: Messages (DECSTBM scroll region)   ← Escape sequences, 不被 Ink 影响
 *
 * Layout rows:
 *   Row 1:           ChatHeader (Ink, ~2 rows)
 *   Row 3 to (T-9):   Messages scroll region (alternate screen, DECSTBM)
 *   Row (T-8) to T:  Input (Ink, ~9 rows)
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { useChatStore } from '../../store/index.js';
import { useAgentEvents } from '../../hooks/useAgentEvents.js';
import { getAgentSession } from '@codeagent/core';
import { ChatMessage } from '../types.js';

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,
  clearLine: () => `${CSI}2K`,
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (n = 1) => `${CSI}${n}S`,
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,
};

const cc = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function roleColorANSI(role: string): string {
  switch (role) {
    case 'user': return cc.cyan;
    case 'assistant': return cc.blue;
    case 'error': return '\x1b[31m';
    default: return cc.cyan;
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'user': return 'You';
    case 'assistant': return 'Assistant';
    case 'error': return 'Error';
    default: return role;
  }
}

function formatMessageANSI(msg: ChatMessage, maxWidth: number): string[] {
  const lines: string[] = [];
  const color = roleColorANSI(msg.role);
  const border = `${cc.dim}│${cc.reset}`;
  const label = roleLabel(msg.role);

  lines.push(`${border} ${color}${cc.bold}${label}${cc.reset}`);

  for (const block of msg.blocks) {
    let text = block.text;

    if (block.kind === 'thinking' || block.kind === 'reasoning' || block.kind === 'toolSummary') {
      const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
      if (collapsed) {
        text = `▸ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]`;
      } else {
        text = `▾ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]\n${text}`;
      }
    }

    const textLines = text.split('\n');
    for (const line of textLines) {
      if (line.length > maxWidth - 4) {
        const words = line.split(' ');
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).length > maxWidth - 4) {
            if (currentLine) lines.push(`${border} ${currentLine}`);
            currentLine = word;
          } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
          }
        }
        if (currentLine) lines.push(`${border} ${currentLine}`);
      } else {
        lines.push(`${border} ${line}`);
      }
    }
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// EscapeMessageList - alternate screen with DECSTBM scroll region
// ─────────────────────────────────────────────────────────────────────────────

interface EscapeMessageListProps {
  messages: ChatMessage[];
}

function EscapeMessageList({ messages }: EscapeMessageListProps) {
  const { stdout } = useStdout();
  const isAltScreenRef = useRef(false);
  const pendingRenderRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate layout
  const getLayout = useCallback(() => {
    const rows = stdout.rows || 24;
    const cols = stdout.columns || 80;
    // Message area: rows 3 to (T - 9)
    // Header takes rows 1-2, Input takes last 9 rows
    return {
      rows,
      cols,
      scrollTop: 3,
      scrollBottom: rows - 9,
    };
  }, [stdout.rows, stdout.columns]);

  // Enter alternate screen and set up scroll region
  const enterAltScreen = useCallback(() => {
    if (isAltScreenRef.current) return;
    isAltScreenRef.current = true;

    const layout = getLayout();
    process.stdout.write(ansi.enterAltScreen());
    process.stdout.write(ansi.setScrollRegion(layout.scrollTop, layout.scrollBottom));
  }, [getLayout]);

  // Exit alternate screen
  const exitAltScreen = useCallback(() => {
    if (!isAltScreenRef.current) return;
    isAltScreenRef.current = false;
    process.stdout.write(ansi.setScrollRegion(1, stdout.rows || 24));
    process.stdout.write(ansi.exitAltScreen());
  }, [stdout.rows]);

  // Render messages in alternate screen
  const renderMessages = useCallback(() => {
    if (!isAltScreenRef.current) return;

    const layout = getLayout();
    const maxWidth = layout.cols - 2;

    // Clear scroll region
    for (let r = layout.scrollTop; r <= layout.scrollBottom; r++) {
      process.stdout.write(ansi.cursorTo(r, 1));
      process.stdout.write(ansi.clearLine());
    }

    // Render messages (last 30)
    const visibleMessages = messages.slice(-30);
    for (const msg of visibleMessages) {
      const lines = formatMessageANSI(msg, maxWidth);
      for (const line of lines) {
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        process.stdout.write(ansi.scrollUp(1));
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        process.stdout.write(ansi.clearLine());
        process.stdout.write(line);
      }
    }

    // Move cursor out of scroll region
    process.stdout.write(ansi.cursorTo(layout.scrollBottom + 1, 1));
  }, [messages, getLayout]);

  // Enter alternate screen on mount
  useEffect(() => {
    // Small delay to ensure Ink has rendered the main layout first
    const t = setTimeout(() => {
      enterAltScreen();
      renderMessages();
    }, 50);

    return () => {
      clearTimeout(t);
      exitAltScreen();
    };
  }, []);

  // Re-render messages when they change
  useEffect(() => {
    if (!isAltScreenRef.current) return;

    if (pendingRenderRef.current) clearTimeout(pendingRenderRef.current);
    pendingRenderRef.current = setTimeout(() => {
      pendingRenderRef.current = null;
      renderMessages();
    }, 20);

    return () => {
      if (pendingRenderRef.current) clearTimeout(pendingRenderRef.current);
    };
  }, [messages, renderMessages]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (isAltScreenRef.current) {
        exitAltScreen();
        enterAltScreen();
        renderMessages();
      }
    };
    process.stdout.on('resize', handleResize);
    return () => process.stdout.off('resize', handleResize);
  }, [exitAltScreen, enterAltScreen, renderMessages]);

  // Return empty box - alternate screen handles all rendering
  return <Box flexGrow={1} flexShrink={1} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// EscapeChatPage
// ─────────────────────────────────────────────────────────────────────────────

export function EscapeChatPage() {
  const session = getAgentSession();
  const agent = session.agent;
  const messages = useChatStore(state => state.messages);
  const currentSession = useChatStore(state => state.currentSession);
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows || 24);

  useEffect(() => {
    const onResize = () => setTerminalRows(stdout.rows);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  const {
    hydrateFromAgentState,
    appendUserMessage,
  } = useAgentEvents(session, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onTurnSettled: (status) => {
      useChatStore.getState().persistCurrentSession(status, agent.state.messages as any);
    },
  });

  useEffect(() => {
    const pending = useChatStore.getState().getAndClearPendingPrompt();

    if (!pending) {
      hydrateFromAgentState();
      return;
    }

    useChatStore.getState().ensureSessionForPrompt(pending);
    appendUserMessage(pending);
    void agent.prompt(pending);
  }, []);

  const isWelcome = !currentSession;

  if (isWelcome) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box flexShrink={0}>
          <ChatHeader session={null} />
        </Box>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>No active session</Text>
        </Box>
        <Box flexShrink={0}>
          <Input />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexShrink={0}>
        <ChatHeader session={currentSession} />
      </Box>
      <EscapeMessageList messages={messages} />
      <Box flexShrink={0}>
        <Input />
      </Box>
    </Box>
  );
}

export default EscapeChatPage;
