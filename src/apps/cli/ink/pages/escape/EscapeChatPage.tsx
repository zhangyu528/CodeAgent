/**
 * EscapeChatPage - Hybrid: Ink components for Header/Input, escape sequences for scroll.
 *
 * Layout:
 *   <Box flexDirection="column" flexGrow={1}>
 *     <ChatHeader />        ← Ink Box (fixed)
 *     <EscapeMessageList /> ← Escape sequence rendering in commit phase
 *     <Input />            ← Ink Box with TextInput (fixed)
 *   </Box>
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
};

const cc = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
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
// EscapeMessageList - renders messages via escape sequences after Ink commit
// ─────────────────────────────────────────────────────────────────────────────

interface EscapeMessageListProps {
  messages: ChatMessage[];
}

function EscapeMessageList({ messages }: EscapeMessageListProps) {
  const { stdout } = useStdout();
  const renderedRef = useRef<Set<string>>(new Set());
  const lastCountRef = useRef(0);
  const pendingRenderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLBoxElement>(null);

  // Get the position of this component in the terminal
  // We use a spacer Box to occupy space, then render escape sequences after commit
  const [spacerHeight, setSpacerHeight] = useState(10);

  // Calculate how many rows we have available
  useEffect(() => {
    const rows = stdout.rows || 24;
    // Header ~2 rows, Input ~9 rows, leaving the rest for messages
    const available = Math.max(5, rows - 2 - 9);
    setSpacerHeight(available);
  }, [stdout.rows]);

  // Render messages to the scroll region
  // This runs AFTER Ink's commit phase, so it's safe to write to stdout
  const renderMessages = useCallback(() => {
    const rows = stdout.rows || 24;
    const cols = stdout.columns || 80;
    const maxWidth = cols - 2;

    // Scroll region: rows 3 to (rows - 10), leaving room for header/input
    const scrollTop = 3;
    const scrollBottom = rows - 10;

    // Save cursor and scroll region
    process.stdout.write(ansi.saveCursor());
    process.stdout.write(ansi.setScrollRegion(scrollTop, scrollBottom));

    // Clear scroll region
    for (let r = scrollTop; r <= scrollBottom; r++) {
      process.stdout.write(ansi.cursorTo(r, 1));
      process.stdout.write(ansi.clearLine());
    }

    // Render all messages (newest at bottom)
    const visibleMessages = messages.slice(-20); // Last 20 messages
    for (const msg of visibleMessages) {
      const lines = formatMessageANSI(msg, maxWidth);
      for (const line of lines) {
        process.stdout.write(ansi.cursorTo(scrollBottom, 1));
        process.stdout.write(ansi.scrollUp(1));
        process.stdout.write(ansi.cursorTo(scrollBottom, 1));
        process.stdout.write(ansi.clearLine());
        process.stdout.write(line);
      }
    }

    // Restore
    process.stdout.write(ansi.setScrollRegion(1, rows));
    process.stdout.write(ansi.restoreCursor());
  }, [messages, stdout.rows, stdout.columns]);

  // Render after commit (using setTimeout 0)
  useEffect(() => {
    // Skip if no messages yet
    if (messages.length === 0) return;

    // Clear any pending render
    if (pendingRenderRef.current) {
      clearTimeout(pendingRenderRef.current);
    }

    // Render in next tick, after Ink commit
    pendingRenderRef.current = setTimeout(() => {
      pendingRenderRef.current = null;
      renderMessages();
    }, 0);

    return () => {
      if (pendingRenderRef.current) {
        clearTimeout(pendingRenderRef.current);
      }
    };
  }, [messages, renderMessages]);

  // Initial render when component mounts
  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(renderMessages, 50);
      return () => clearTimeout(t);
    }
  }, []);

  // Return a visible spacer box (occupies space in Ink layout)
  // The actual content is rendered via escape sequences
  return (
    <Box
      ref={containerRef as any}
      flexGrow={1}
      flexShrink={1}
      minHeight={spacerHeight}
    >
      <Text dimColor>Loading messages...</Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EscapeChatPage - Main page
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
