import { useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from 'ink';
import { SLASH_COMMANDS, executeSlash, HELP_MESSAGE } from './useSlashCommands.js';
import { useAppStore } from '../../store/uiStore.js';
import { useSessionStore } from '../../store/sessionStore.js';
import { useMessageStore } from '../../store/messageStore.js';
import { getAgent } from '../../../../../agent/index.js';
import type { UseModelConfigResult } from '../../hooks/useModelConfig.js';
import { showNotice, showSelectOne } from '../modals/index.js';
import { padToWidth } from '../modals/textLayout.js';

export function useSlashHandlers(modelConfig: UseModelConfigResult) {
  const { exit } = useApp();
  const setPage = useAppStore(state => state.setPage);

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
    onResume: () => {
      void (async () => {
        const session = useSessionStore.getState();
        try {
          const history = await session.refreshHistory(1);
          if (history.length > 0) {
            const restored = await session.restoreSessionById(history[0]!.id);
            if (restored) {
              setPage('chat');
              return;
            }
          }
          showNotice({ title: 'Resume Session', message: 'No recent session found to resume.' });
        } catch (error) {
          showNotice({ title: 'Resume Session', message: 'Failed to resume session.' });
        }
      })();
    },
    onQuit: () => exit(),
  }), [modelConfig, exit, openHistoryModal, setPage]);

  return handlers;
}

export function useSlashList(inputValue: string, modelConfig: UseModelConfigResult, setInputValue: (value: string | ((prev: string) => string)) => void) {
  const handlers = useSlashHandlers(modelConfig);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const hasSlash = inputValue.startsWith('/') && !inputValue.includes(' ');
  const search = hasSlash ? inputValue.slice(1).toLowerCase() : '';

  const commands = useMemo(() => {
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

  // Execute slash command
  const confirmSlash = useCallback((cmd: string) => {
    executeSlash(cmd, handlers);
    setInputValue('');
  }, [handlers, setInputValue]);

  const maxVisible = 6;
  const listHeight = hasSlash 
    ? 1 /* header */ + Math.max(1, Math.min(maxVisible, commands.length)) /* items */ + (commands.length > maxVisible ? 1 : 0) /* footer */ + 2 /* borders */
    : 0;

  return {
    hasSlash,
    commands,
    selectedIndex,
    setSelectedIndex,
    confirmSlash,
    listHeight,
  };
}
