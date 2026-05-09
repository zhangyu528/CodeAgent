/**
 * useAgentEvents - Agent 事件订阅
 * 使用 useChatStore 共享消息状态
 *
 * Streaming architecture (hybrid):
 * - Streaming deltas → store (React overlay) + chatHistoryRenderer (terminal)
 * - Completed messages → store (React overlay) + written to terminal history
 *
 * Performance: Streaming delta updates are throttled using a 50ms buffer
 * to reduce React re-renders from high-frequency token updates.
 */
import { useEffect, useRef, useCallback } from 'react';
import { AgentSession, AgentSessionEvent } from '@codeagent/core';
import { useChatStore } from '../store/index.js';
import { ChatMessage } from '../pages/types.js';
import { agentMessagesToChatMessages } from '../utils/messageAdapters.js';
import { chatHistoryRenderer } from '../utils/chatHistoryRenderer.js';

// Throttle configuration
const THROTTLE_INTERVAL_MS = 50;

interface DeltaBuffer {
  textDeltas: string[];
  thinkingDeltas: string[];
}

export interface UseAgentEventsOptions {
  isRawModeSupported: boolean;
  onRawModeChange: (mode: boolean) => void;
  onAgentStart?: () => void;
  onAgentEnd?: () => void;
  onTurnSettled?: (status: 'completed' | 'error') => void;
  onError?: (message: string) => void;
}

export function useAgentEvents(session: AgentSession, options: UseAgentEventsOptions) {
  const { isRawModeSupported, onRawModeChange, onAgentStart, onAgentEnd, onTurnSettled, onError } = options;
  const agent = session.agent;

  const lastTurnStatusRef = useRef<'active' | 'completed' | 'error'>('completed');

  // Throttle buffer for streaming deltas
  const deltaBufferRef = useRef<DeltaBuffer>({ textDeltas: [], thinkingDeltas: [] });
  const throttleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addMessage = useChatStore(state => state.addMessage);
  const updateLastMessage = useChatStore(state => state.updateLastMessage);
  const setThinking = (thinking: boolean) => useChatStore.setState({ thinking });
  const setUsage = (usage: { input: number; output: number; cost: number }) => useChatStore.setState({ usage });

  // Flush accumulated deltas to store AND terminal
  const flushDeltas = useCallback(() => {
    const { textDeltas, thinkingDeltas } = deltaBufferRef.current;

    // Skip if nothing to flush
    if (textDeltas.length === 0 && thinkingDeltas.length === 0) {
      return;
    }

    const textDelta = textDeltas.join('');
    const thinkingDelta = thinkingDeltas.join('');

    useChatStore.getState().updateLastMessage(msg => {
      if (!msg) return msg;

      let nextBlocks = [...msg.blocks] as ChatMessage['blocks'];

      // Text delta
      if (textDelta) {
        const blockIndex = nextBlocks.findIndex(b => b.kind === 'text');
        if (blockIndex >= 0) {
          nextBlocks = [...nextBlocks];
          nextBlocks[blockIndex] = { kind: 'text', text: (nextBlocks[blockIndex] as { kind: 'text'; text: string }).text + textDelta };
        } else {
          nextBlocks = [...nextBlocks, { kind: 'text', text: textDelta }];
        }
      }

      // Thinking delta
      if (thinkingDelta) {
        const blockIndex = nextBlocks.findIndex(b => b.kind === 'thinking');
        if (blockIndex >= 0) {
          nextBlocks = [...nextBlocks];
          nextBlocks[blockIndex] = {
            kind: 'thinking',
            text: (nextBlocks[blockIndex] as { kind: 'thinking'; text: string }).text + thinkingDelta,
            collapsed: true,
          };
        } else {
          nextBlocks = [{ kind: 'thinking', text: thinkingDelta, collapsed: true }, ...nextBlocks];
        }
      }

      // Update terminal
      if (textDelta) chatHistoryRenderer.updatePending(textDelta, false);
      if (thinkingDelta) chatHistoryRenderer.updatePending(thinkingDelta, true);

      return { ...msg, status: 'streaming', blocks: nextBlocks };
    });

    deltaBufferRef.current = { textDeltas: [], thinkingDeltas: [] };
  }, []);

  // Start throttle interval
  const startThrottleInterval = useCallback(() => {
    if (throttleIntervalRef.current === null) {
      throttleIntervalRef.current = setInterval(flushDeltas, THROTTLE_INTERVAL_MS);
    }
  }, [flushDeltas]);

  // Stop throttle interval
  const stopThrottleInterval = useCallback(() => {
    if (throttleIntervalRef.current !== null) {
      clearInterval(throttleIntervalRef.current);
      throttleIntervalRef.current = null;
    }
  }, []);

  // Append text delta to buffer (throttled)
  const appendTextDelta = useCallback((delta: string) => {
    deltaBufferRef.current.textDeltas.push(delta);
    startThrottleInterval();
  }, [startThrottleInterval]);

  // Append thinking delta to buffer (throttled)
  const appendThinkingDelta = useCallback((delta: string) => {
    deltaBufferRef.current.thinkingDeltas.push(delta);
    startThrottleInterval();
  }, [startThrottleInterval]);

  const appendUserMessage = useCallback((text: string) => {
    addMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      title: 'You',
      createdAt: Date.now(),
      status: 'completed',
      blocks: [{ kind: 'text', text }],
    });
  }, [addMessage]);

  const appendErrorMessage = useCallback((text: string) => {
    addMessage({
      id: `error-${Date.now()}`,
      role: 'error',
      title: 'Error',
      createdAt: Date.now(),
      status: 'error',
      blocks: [{ kind: 'text', text }],
    });
  }, [addMessage]);

  const hydrateFromAgentState = useCallback(() => {
    useChatStore.getState().setMessages(agentMessagesToChatMessages(agent.state.messages as any[]));
  }, [agent]);

  // Agent event subscription
  useEffect(() => {
    const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      switch (event.type) {
        case 'agent_start':
          lastTurnStatusRef.current = 'active';
          setThinking(true);
          onAgentStart?.();
          addMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            title: 'Assistant',
            createdAt: Date.now(),
            status: 'streaming',
            blocks: [],
          });
          break;

        case 'agent_end': {
          // Flush any remaining deltas before finishing
          flushDeltas();
          stopThrottleInterval();
          if (isRawModeSupported) onRawModeChange(true);
          const finalStatus = lastTurnStatusRef.current === 'error' ? 'error' : 'completed';
          setThinking(false);
          onAgentEnd?.();
          onTurnSettled?.(finalStatus);
          updateLastMessage(msg => ({ ...msg, status: finalStatus }));
          break;
        }

        case 'message_update': {
          const assistantEvent = event.assistantMessageEvent;
          if (assistantEvent.type === 'text_delta') {
            appendTextDelta(assistantEvent.delta);
          } else if (assistantEvent.type === 'thinking_delta') {
            appendThinkingDelta(assistantEvent.delta);
          }
          break;
        }

        case 'message_end': {
          if (isRawModeSupported) onRawModeChange(true);
          const msg = event.message as any;
          if (msg.stopReason === 'error' && msg.errorMessage) {
            lastTurnStatusRef.current = 'error';
            onError?.(msg.errorMessage);
            // Add error message to the list
            addMessage({
              id: `error-${Date.now()}`,
              role: 'error',
              title: 'Error',
              createdAt: Date.now(),
              status: 'error',
              blocks: [{ kind: 'text', text: msg.errorMessage }],
            });
          } else {
            lastTurnStatusRef.current = 'completed';
          }
          if (msg.usage) {
            setUsage({
              input: msg.usage.inputTokens || msg.usage.input || 0,
              output: msg.usage.outputTokens || msg.usage.output || 0,
              cost: msg.usage.cost?.total || 0,
            });
          }
          break;
        }

        case 'auto_compaction_end':
          // Refresh messages after compaction
          hydrateFromAgentState();
          break;
      }
    });

    return () => {
      unsubscribe();
      // Cleanup throttle interval and flush remaining deltas on unmount
      stopThrottleInterval();
      flushDeltas();
    };
  }, [
    session,
    agent,
    isRawModeSupported,
    onRawModeChange,
    onAgentStart,
    onAgentEnd,
    onTurnSettled,
    onError,
    addMessage,
    updateLastMessage,
    setThinking,
    setUsage,
    appendTextDelta,
    appendThinkingDelta,
    flushDeltas,
    stopThrottleInterval,
    hydrateFromAgentState,
  ]);

  // Return store state and actions
  const messages = useChatStore(state => state.messages);
  const thinking = useChatStore(state => state.thinking);
  const usage = useChatStore(state => state.usage);

  return {
    // State (from store)
    messages,
    thinking,
    usage,
    // Mutations
    addMessage,
    updateLastMessage,
    hydrateFromAgentState,
    appendUserMessage,
    appendErrorMessage,
    // Refs
    lastTurnStatusRef,
  };
}
