/**
 * EscapeChatPage - Hybrid: Ink components for Header/Input, escape sequences for scroll.
 *
 * Layout (Ink Box):
 *   <Box flexDirection="column" flexGrow={1}>
 *     <ChatHeader />                    ← Ink Box (fixed)
 *     <EscapeMessageList />            ← Ink Box wrapping DECSTBM scroll region
 *     <Input />                        ← Ink Box with TextInput (fixed)
 *   </Box>
 *
 * The EscapeMessageList component:
 * - Uses Ink Box as outer container (so Ink tree is balanced)
 * - Inside the Box, it manages a DECSTBM scroll region for messages
 * - Does NOT use alternate screen - messages live in terminal scrollback
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

// ANSI escape sequences
const ansi = {
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  cursorForward: (n = 1) => `${CSI}${n}C`,
  cursorBack: (n = 1) => `${CSI}${n}D`,
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  clearLineToEnd: () => `${CSI}0K`,
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (n = 1) => `${CSI}${n}S`,
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,
  // Scroll to bottom of scroll region (DECSTBM bound scrolling)
  scrollToBottom: () => `${CSI}${1};${1}H`, // Move to scroll region top, scroll region auto-scrolls
};

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function roleColor(role: string): string {
  switch (role) {
    case 'user': return c.cyan;
    case 'assistant': return c.blue;
    case 'error': return c.red;
    default: return c.yellow;
  }
}

interface Layout {
  rows: number;
  cols: number;
  scrollTop: number;
  scrollBottom: number;
}

function roleLabel(role: string): string {
  switch (role) {
    case 'user': return 'You';
    case 'assistant': return 'Assistant';
    case 'error': return 'Error';
    default: return role;
  }
}

function formatMessage(msg: ChatMessage, maxWidth: number): string[] {
  const lines: string[] = [];
  const color = roleColor(msg.role);
  const border = `${c.dim}│${c.reset}`;
  const label = roleLabel(msg.role);

  // Role label with border
  lines.push(`${border} ${color}${c.bold}${label}${c.reset}`);

  // Blocks
  for (const block of msg.blocks) {
    let text = block.text;

    // Handle collapsed blocks
    if (block.kind === 'thinking' || block.kind === 'reasoning' || block.kind === 'toolSummary') {
      const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
      if (collapsed) {
        text = `▸ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]`;
      } else {
        text = `▾ [${block.kind === 'toolSummary' ? 'Tools' : block.kind.charAt(0).toUpperCase() + block.kind.slice(1)}]\n${text}`;
      }
    }

    // Wrap long lines
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
// EscapeMessageList - Ink Box wrapping DECSTBM scroll region
// ─────────────────────────────────────────────────────────────────────────────

interface EscapeMessageListProps {
  messages: ChatMessage[];
}

function EscapeMessageList({ messages }: EscapeMessageListProps) {
  const { stdout } = useStdout();
  const layoutRef = useRef<Layout | null>(null);
  const containerRef = useRef<HTMLBoxElement>(null);
  const prevRowCountRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  // Calculate scroll region position based on Ink rendering
  // We query the stdout.rows after Ink renders to find our position
  const updateLayout = useCallback(() => {
    const rows = stdout.rows || 24;
    const cols = stdout.columns || 80;
    // We don't know exact Ink layout, so we use the whole terminal
    // and manage scrolling within that area
    // Leave 1 row at bottom as margin for Ink's cursor
    layoutRef.current = {
      rows,
      cols,
      scrollTop: 1,
      scrollBottom: rows - 1,
    };
  }, [stdout.rows, stdout.columns]);

  // Render all messages into scroll region
  const renderMessages = useCallback(() => {
    if (!layoutRef.current) return;

    const layout = layoutRef.current;
    const maxWidth = layout.cols - 2;

    // Save cursor
    process.stdout.write(ansi.saveCursor());

    // Clear scroll region
    process.stdout.write(ansi.setScrollRegion(layout.scrollTop, layout.scrollBottom));
    for (let r = layout.scrollTop; r <= layout.scrollBottom; r++) {
      process.stdout.write(ansi.cursorTo(r, 1));
      process.stdout.write(ansi.clearLine());
    }

    // Render all messages
    for (const msg of messages) {
      const lines = formatMessage(msg, maxWidth);
      for (const line of lines) {
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        process.stdout.write(ansi.scrollUp(1));
        process.stdout.write(ansi.cursorTo(layout.scrollBottom, 1));
        process.stdout.write(ansi.clearLine());
        process.stdout.write(line);
      }
    }

    // Restore cursor
    process.stdout.write(ansi.restoreCursor());
  }, [messages]);

  // Initialize and handle resize
  useEffect(() => {
    updateLayout();

    const handleResize = () => {
      updateLayout();
      renderMessages();
    };
    process.stdout.on('resize', handleResize);

    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, [updateLayout, renderMessages]);

  // Re-render on messages change
  useEffect(() => {
    if (!isInitializedRef.current) {
      // First render - give Ink time to settle, then render
      isInitializedRef.current = true;
      return;
    }
    renderMessages();
  }, [messages, renderMessages]);

  // Return an empty Ink Box - all rendering done via escape sequences
  // The Box still participates in Ink layout but renders nothing itself
  return (
    <Box
      ref={containerRef as any}
      flexGrow={1}
      flexShrink={1}
    >
      {/* Invisible - all content rendered via escape sequences */}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EscapeChatPage - Main page component
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

  // Handle pending prompt from WelcomePage
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

  // Don't render EscapeMessageList in welcome state - use standard layout
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

  const headerRows = 2; // ChatHeader takes ~2 rows
  const inputRows = 9; // Input component height
  const availableRows = Math.max(1, terminalRows - headerRows - inputRows);

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
