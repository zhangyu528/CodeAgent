/**
 * useAgentEvents - Agent 事件订阅
 * 使用 messageStore 共享消息状态
 */
import { useEffect, useRef, useCallback } from 'react';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { useMessageStore } from '../store/messageStore.js';
import { ChatMessage } from '../pages/types.js';

export interface UseAgentEventsOptions {
  isRawModeSupported: boolean;
  onRawModeChange: (mode: boolean) => void;
  onAgentStart?: () => void;
  onAgentEnd?: () => void;
  onTurnSettled?: (status: 'completed' | 'error') => void;
  onError?: (message: string) => void;
}

export function useAgentEvents(agent: Agent, options: UseAgentEventsOptions) {
  const { isRawModeSupported, onRawModeChange, onAgentStart, onAgentEnd, onTurnSettled, onError } = options;

  const lastTurnStatusRef = useRef<'active' | 'completed' | 'error'>('completed');

  const addMessage = useMessageStore(state => state.addMessage);
  const updateLastMessage = useMessageStore(state => state.updateLastMessage);
  const clearMessages = useMessageStore(state => state.clearMessages);
  const setThinking = useMessageStore(state => state.setThinking);
  const setUsage = useMessageStore(state => state.setUsage);

  const appendTextDelta = useCallback((delta: string) => {
    useMessageStore.getState().updateLastMessage(msg => {
      if (!msg) return msg;
      const blockIndex = msg.blocks.findIndex(block => block.kind === 'text');
      if (blockIndex >= 0) {
        const nextBlocks = [...msg.blocks];
        const textBlock = nextBlocks[blockIndex] as { kind: 'text'; text: string };
        nextBlocks[blockIndex] = { kind: 'text', text: textBlock.text + delta };
        return { ...msg, status: 'streaming', blocks: nextBlocks };
      }
      return { ...msg, status: 'streaming', blocks: [...msg.blocks, { kind: 'text', text: delta }] };
    });
  }, []);

  const appendThinkingDelta = useCallback((delta: string) => {
    useMessageStore.getState().updateLastMessage(msg => {
      if (!msg) return msg;
      const blockIndex = msg.blocks.findIndex(block => block.kind === 'thinking');
      if (blockIndex >= 0) {
        const nextBlocks = [...msg.blocks];
        const thinkingBlock = nextBlocks[blockIndex] as { kind: 'thinking'; text: string };
        nextBlocks[blockIndex] = { kind: 'thinking', text: thinkingBlock.text + delta, collapsed: true };
        return { ...msg, status: 'streaming', blocks: nextBlocks };
      }
      return { ...msg, status: 'streaming', blocks: [{ kind: 'thinking', text: delta, collapsed: true }, ...msg.blocks] };
    });
  }, []);

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
    const { agentMessagesToChatMessages } = require('../utils/messageAdapters.js');
    useMessageStore.getState().setMessages(agentMessagesToChatMessages(agent.state.messages as any[]));
  }, [agent]);

  // Agent event subscription
  useEffect(() => {
    const unsubscribe = agent.subscribe((event: AgentEvent) => {
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
      }
    });

    return () => unsubscribe();
  }, [
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
  ]);

  // Return store state and actions
  const messages = useMessageStore(state => state.messages);
  const thinking = useMessageStore(state => state.thinking);
  const usage = useMessageStore(state => state.usage);

  return {
    // State (from store)
    messages,
    thinking,
    usage,
    // Mutations
    addMessage,
    updateLastMessage,
    clearMessages,
    hydrateFromAgentState,
    appendUserMessage,
    appendErrorMessage,
    // Refs
    lastTurnStatusRef,
  };
}
