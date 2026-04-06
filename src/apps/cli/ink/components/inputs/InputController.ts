/**
 * InputController - manages input state and actions
 */
import { useState } from 'react';
import { useAppStore } from '../../store/uiStore.js';
import { shortenPath } from '../../utils.js';
import { useAppSession } from '../../hooks/useAppSession.js';
import { useModelConfig } from '../../hooks/useModelConfig.js';
import { useInput as useKeyboardInput } from 'ink';
import { getAgent } from '../../../../../agent/index.js';
import { useDebugStore } from '../debug/debugStore.js';

export interface InputControllerResult {
  value: string;
  setValue: (value: string | ((prev: string) => string)) => void;
  isExitHint: boolean;
  isWelcome: boolean;
  modelLabel: string | null;
  cwdLabel: string;
}

export function useInput(): InputControllerResult {
  const agent = getAgent();
  const modelConfig = useModelConfig(agent);
  const session = useAppSession();
  const [value, setValue] = useState('');
  const isExitHint = useAppStore(state => state.isFirstPress);
  const page = useAppStore(state => state.page);
  const setPage = useAppStore(state => state.setPage);
  const currentModel = useAppStore(state => state.currentModel);

  const submitPrompt = (currentValue: string) => {
    const trimmed = currentValue.trim();
    if (!trimmed) return;

    // Check if model is configured
    if (!currentModel) {
      modelConfig.startConfig();
      return;
    }

    if (page === 'welcome') {
      // Store prompt as pending, will be processed after ChatPage mounts
      session.ensureSessionForPrompt(trimmed);
      session.setPendingPrompt(trimmed);
      setPage('chat');
    } else {
      // Already on chat page, send directly
      session.ensureSessionForPrompt(trimmed);
      void agent.prompt(trimmed);
    }
    setValue('');
  };

  useKeyboardInput((input, key) => {
    // Return - submit or execute slash command
    // Also handle \r (carriage return) which Windows Terminal sends
    if (key.return || input === '\r') {
      const hasSlash = value.startsWith('/') && !value.includes(' ');
      useDebugStore.getState().addMessage(`[Input] Return pressed, hasSlash: ${hasSlash}, value: ${value}`);
      if (hasSlash) {
        useDebugStore.getState().addMessage('[Input] Slash command, delegating to SlashListController');
        return;
      } else {
        useDebugStore.getState().addMessage('[Input] Calling submitPrompt');
        submitPrompt(value);
      }
      return;
    }

    // Character input
    if (input) {
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
  });

  return {
    value,
    setValue,
    isExitHint,
    isWelcome: page === 'welcome',
    modelLabel: currentModel,
    cwdLabel: shortenPath(process.cwd()),
  };
}
