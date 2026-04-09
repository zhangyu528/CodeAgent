import { useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from 'ink';
import { SLASH_COMMANDS, type SlashListViewItem, executeSlash, HELP_MESSAGE } from './useSlashCommands.js';
import { useInput } from 'ink';
import { useAppStore } from '../../store/uiStore.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { useMessageStore } from '../../store/messageStore.js';
import { getAgent } from '../../../../../agent/index.js';
import type { UseModelConfigResult } from '../../hooks/useModelConfig.js';
import { showNotice, showSelectOne } from '../modals/index.js';

export type { SlashListViewItem };

export function useSlashList(inputValue: string, modelConfig: UseModelConfigResult, setInputValue: (value: string | ((prev: string) => string)) => void) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();
  const setPage = useAppStore(state => state.setPage);

  const hasSlash = inputValue.startsWith('/') && !inputValue.includes(' ');
  const search = hasSlash ? inputValue.slice(1).toLowerCase() : '';

  const commands = useMemo((): SlashListViewItem[] => {
    if (!hasSlash) return [];
    if (search === '') return [...SLASH_COMMANDS];
    return SLASH_COMMANDS.filter(cmd =>
      cmd.name.toLowerCase().slice(1).startsWith(search),
    );
  }, [hasSlash, search]);

  // Reset selection when list changes
  useEffect(() => {
    setSelectedIndex(prev => {
      if (!hasSlash || commands.length === 0) return 0;
      return Math.min(prev, commands.length - 1);
    });
  }, [hasSlash, commands]);

  // Open history modal
  const openHistoryModal = useCallback(async (limit?: number) => {
    const session = useSessionStore.getState();
    try {
      const history = await session.refreshHistory(limit);
      if (history.length === 0) {
        showNotice({ title: 'Session History', message: 'No saved sessions found yet.' });
        return;
      }
      showSelectOne({
        title: limit ? 'Resume Recent Session' : 'Session History',
        message: limit ? 'Choose a recent session to resume.' : 'Browse and restore a saved session.',
        choices: history.map(item => ({
          value: item.id,
          label: `${item.title} · ${new Date(item.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${item.messageCount} msgs`,
        })),
        footer: '↑/↓ Navigate • Enter Resume • Esc Cancel',
        emptyLabel: 'No saved sessions found',
        onSubmit: async (choice) => {
          const restored = await session.restoreSessionById(choice.value);
          if (!restored) {
            showNotice({ title: 'Session History', message: 'Failed to restore the selected session.' });
            return;
          }
          setPage('chat');
        },
      });
    } catch (error) {
      showNotice({ title: 'Session History', message: 'Failed to load session history.' });
    }
  }, [setPage]);

  // Build command handlers
  const handlers = useMemo(() => ({
    onHelp: () => showNotice({ title: 'Help', message: HELP_MESSAGE }),
    onNew: () => {
      useSessionStore.getState().clearSession();
      useMessageStore.getState().clearMessages();
      getAgent().replaceMessages([]);
      setPage('welcome');
    },
    onModel: () => modelConfig.startConfig(),
    onHistory: () => { void openHistoryModal(); },
    onResume: () => { void openHistoryModal(10); },
    onQuit: () => exit(),
  }), [modelConfig, exit, openHistoryModal, setPage]);

  // Execute slash command directly from this handler
  const confirmSlash = useCallback((cmd: string) => {
    executeSlash(cmd, handlers);
    setInputValue('');
  }, [handlers, setInputValue]);

  // Keyboard navigation (only when slash list is visible)
  useInput((_, key) => {
    if (!hasSlash) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(Math.max(0, commands.length - 1), prev + 1));
      return;
    }
    // Enter - execute selected command
    if (key.return && commands.length > 0) {
      const selectedCmd = commands[selectedIndex];
      if (selectedCmd) {
        confirmSlash(selectedCmd.name);
      }
    }
  }, { isActive: hasSlash });

  return {
    hasSlash,
    commands,
    selectedIndex,
  };
}
