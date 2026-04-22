/**
 * EscapeChatPage
 * 
 * A chat page implementation using escape sequences for streaming output.
 * This is an alternative to the Ink-based MessageList for better performance.
 * 
 * Layout:
 *   Row 0-1: Header (fixed)
 *   Row 2: Separator
 *   Row 3 to (T-5): Messages scroll region (DECSTBM)
 *   Row (T-4): Separator
 *   Row (T-3) to T: Input (fixed)
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EscapeChatRenderer } from '../utils/escapeChatRenderer.js';
import { TerminalScrollRegion } from '../utils/terminalScroll.js';
import { useChatStore } from '../store/index.js';
import { ChatMessage } from './types.js';
import { useAgentEvents } from '../hooks/useAgentEvents.js';
import { getAgentSession } from '@codeagent/core';

// ANSI escape sequences
const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  clearLineToEnd: () => `${CSI}0K`,
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (lines: number = 1) => `${CSI}${lines}S`,
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,
  reset: () => `${ESC}c`,
};

// Colors
const colors = {
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
  bgGray: '\x1b[100m',
};

// ANSI text formatting helpers
const fmt = {
  bold: (s: string) => `${colors.bold}${s}${colors.reset}`,
  dim: (s: string) => `${colors.dim}${s}${colors.reset}`,
  red: (s: string) => `${colors.red}${s}${colors.reset}`,
  green: (s: string) => `${colors.green}${s}${colors.reset}`,
  yellow: (s: string) => `${colors.yellow}${s}${colors.reset}`,
  blue: (s: string) => `${colors.blue}${s}${colors.reset}`,
  cyan: (s: string) => `${colors.cyan}${s}${colors.reset}`,
  gray: (s: string) => `${colors.gray}${s}${colors.reset}`,
};

function roleColor(role: string): string {
  switch (role) {
    case 'user': return colors.cyan;
    case 'assistant': return colors.blue;
    case 'error': return colors.red;
    default: return colors.yellow;
  }
}

export function EscapeChatPage() {
  const rendererRef = useRef<EscapeChatRenderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const session = getAgentSession();
  const agent = session.agent;
  const messages = useChatStore(state => state.messages);
  const currentSession = useChatStore(state => state.currentSession);

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

  // Initialize on mount
  useEffect(() => {
    // Enter alternate screen
    process.stdout.write(ansi.enterAltScreen());
    process.stdout.write(ansi.hideCursor());
    process.stdout.write(ansi.clearScreen());

    // Create renderer
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const headerRows = 2;
    const footerRows = 3;

    rendererRef.current = new EscapeChatRenderer({
      headerRows,
      footerRows,
      totalRows: rows,
      totalCols: cols,
    });

    setIsInitialized(true);

    // Cleanup on unmount
    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
      process.stdout.write(ansi.exitAltScreen());
      process.stdout.write(ansi.showCursor());
      process.stdout.write(ansi.clearScreen());
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (!isInitialized) return;

    const handleResize = () => {
      if (rendererRef.current) {
        rendererRef.current.resize();
      }
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, [isInitialized]);

  // Sync messages to renderer
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;
    rendererRef.current.setMessages(messages);
  }, [messages, isInitialized]);

  // Sync session name
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;
    rendererRef.current.setSession(currentSession?.title);
  }, [currentSession, isInitialized]);

  // Initial render
  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;
    rendererRef.current.render();
  }, [isInitialized]);

  // Render nothing in React - all rendering is done via escape sequences
  return null;
}

export default EscapeChatPage;
