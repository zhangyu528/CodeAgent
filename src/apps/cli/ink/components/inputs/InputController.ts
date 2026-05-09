/**
 * InputController - manages input state and actions
 */
import { useState, useCallback } from 'react';
import { useAppStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/index.js';
import { shortenPath } from '../../utils.js';
import { useModelConfig } from '../../hooks/useModelConfig.js';
import { useInput as useKeyboardInput } from 'ink';
import { getAgentSession } from '@codeagent/core';
import { useModalOpenState } from '../modals/index.js';

export interface InputControllerResult {
  value: string;
  setValue: (value: string | ((prev: string) => string)) => void;
  isExitHint: boolean;
  isWelcome: boolean;
  modelLabel: string | null;
  cwdLabel: string;
}

export function useInput(): InputControllerResult {
  const session = getAgentSession();
  const modelConfig = useModelConfig(session);
  const [value, setValue] = useState('');

  // Subscribe to state
  const isExitHint = useAppStore(state => state.isFirstPress);
  const page = useAppStore(state => state.page);
  const currentModel = useAppStore(state => state.currentModel);

  // Get actions from unified chat store
  const setPage = useAppStore(state => state.setPage);
  const ensureSessionForPrompt = useChatStore(state => state.ensureSessionForPrompt);
  const setPendingPrompt = useChatStore(state => state.setPendingPrompt);
  const addMessage = useChatStore(state => state.addMessage);
  const thinking = useChatStore(state => state.thinking);

  const hasModal = useModalOpenState();

  const submitPrompt = useCallback((currentValue: string,来源:string='unknown') => {
    const trimmed = currentValue.trim();
    if (!trimmed) return;

    // Check if model is configured
    if (!currentModel) {
      modelConfig.startConfig();
      return;
    }

    if (page === 'welcome') {
      // Store prompt as pending, will be processed after ChatPage mounts
      ensureSessionForPrompt(trimmed);
      setPendingPrompt(trimmed);
      setPage('chat');
    } else {
      // Already on chat page, send directly
      ensureSessionForPrompt(trimmed);
      addMessage({
        id: `u-${Date.now()}`,
        role: 'user',
        title: 'You',
        createdAt: Date.now(),
        status: 'completed',
        blocks: [{ kind: 'text', text: trimmed }],
      });
      void session.prompt(trimmed);
    }
    setValue('');
  }, [currentModel, page, modelConfig, setPage, ensureSessionForPrompt, setPendingPrompt, session, addMessage]);

  useKeyboardInput((input, key) => {
    // Ignore all input while agent is thinking
    if (thinking) return;

    // Return - submit or execute slash command
    // Also handle \r (carriage return) which Windows Terminal sends
    if (key.return || input === '\r') {
      const hasSlash = value.startsWith('/') && !value.includes(' ');
      if (hasSlash) {
        return;
      } else {
        submitPrompt(value);
      }
      return;
    }

    // Character input
    if (input) {
      if (key.ctrl || key.meta) {
        return;
      }
      
      // Trigger command palette on '/' at start
      // (Hijack removed, treated as normal character now)
      setValue(prev => prev + input);
      return;
    }
    // Backspace
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      return;
    }
    // Escape - clear input
    if (key.escape) {
      setValue('');
      return;
    }
  }, { isActive: !hasModal });

  return {
    value,
    setValue,
    isExitHint,
    isWelcome: page === 'welcome',
    modelLabel: currentModel,
    cwdLabel: shortenPath(process.cwd()),
  };
}
