/**
 * ChatOverlay.tsx — React overlay for active chat elements
 *
 * In the hybrid streaming architecture, this component renders ONLY:
 *   - ChatHeader (1 row)
 *   - Current streaming message (variable height)
 *   - Input area (~7 rows)
 *
 * All completed messages are handled by the terminal escape-sequence renderer
 * (chatHistoryRenderer), so no ScrollableMessageList is needed here.
 *
 * Layout (bottom of terminal, fixed):
 *   [Input — always visible, ~7 rows]
 *   [Current streaming message — if agent is active]
 *   [ChatHeader — 1 row]
 *   ─── above this line = terminal history, native scroll ───
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Input } from '../../components/inputs/index.js';
import { ChatHeader } from '../../components/chat/ChatHeader.js';
import { MessageItem } from '../../components/chat/MessageItem.js';
import { useChatStore } from '../../store/index.js';
import { chatHistoryRenderer } from '../../utils/chatHistoryRenderer.js';

// Estimated row heights of each section
const HEADER_ROWS = 1;
const INPUT_ROWS = 8; // slash list + input field + indicators

interface ChatOverlayProps {
  /** Called with the total overlay height (in rows) whenever it changes */
  onOverlayResize?: (rows: number) => void;
}

export function ChatOverlay({ onOverlayResize }: ChatOverlayProps) {
  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState(stdout.rows || 24);

  // Listen for terminal resize
  useEffect(() => {
    const handleResize = () => {
      const rows = stdout.rows || 24;
      setTerminalRows(rows);
    };
    stdout.on('resize', handleResize);
    return () => stdout.off('resize', handleResize);
  }, [stdout]);

  // Get messages from store
  const messages = useChatStore(state => state.messages);

  // The current streaming message (last message with status 'streaming')
  const streamingMessage =
    messages.length > 0 && messages[messages.length - 1].status === 'streaming'
      ? messages[messages.length - 1]
      : null;

  // The completed messages (all except the current streaming one)
  const completedMessages = streamingMessage ? messages.slice(0, -1) : messages;

  // Calculate overlay height based on streaming message content
  const streamingRows = streamingMessage ? estimateMessageRows(streamingMessage.blocks) : 0;

  const totalOverlayRows = HEADER_ROWS + streamingRows + INPUT_ROWS;

  // Notify parent of overlay size changes
  useEffect(() => {
    onOverlayResize?.(totalOverlayRows);
  }, [totalOverlayRows, onOverlayResize]);

  return (
    <Box flexDirection="column" flexGrow={0} flexShrink={0}>
      {/* ChatHeader */}
      <Box flexShrink={0}>
        <ChatHeader session={useChatStore.getState().currentSession} />
      </Box>

      {/* Streaming message area */}
      {streamingMessage && (
        <Box flexDirection="column" flexGrow={0} flexShrink={0}>
          <MessageItem message={streamingMessage} />
        </Box>
      )}

      {/* Input area — always at the bottom */}
      <Box flexShrink={0}>
        <Input />
      </Box>
    </Box>
  );
}

/**
 * Rough estimate of how many rows a message takes.
 * Used to calculate the overlay height.
 */
function estimateMessageRows(
  blocks: { kind: string; text?: string; collapsed?: boolean }[]
): number {
  let rows = 0;
  const cols = process.stdout.columns || 80;
  for (const block of blocks) {
    if (block.kind === 'text') {
      rows += Math.max(1, Math.ceil((block.text?.length || 0) / (cols - 4)));
    } else {
      // thinking/reasoning/toolSummary: header line + content if not collapsed
      rows += 1;
      if (!block.collapsed && block.text) {
        rows += Math.max(1, Math.ceil(block.text.length / (cols - 6)));
      }
    }
  }
  return Math.max(rows, 3); // minimum height
}
