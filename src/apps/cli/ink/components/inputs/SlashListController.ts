import { useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from 'ink';
import { SLASH_COMMANDS, type SlashListViewItem, executeSlash } from './useSlashCommands.js';
import { useInput } from 'ink';
import { useModalStore } from '../modals/index.js';
import { useAppStore } from '../../store/uiStore.js';
import { useAppSession } from '../../hooks/useAppSession.js';
import { getAgent } from '../../../../../agent/index.js';
import type { UseModelConfigResult } from '../../hooks/useModelConfig.js';
import { useDebugStore } from '../debug/debugStore.js';

export type { SlashListViewItem };

export function useSlashList(inputValue: string, modelConfig: UseModelConfigResult, setInputValue: (value: string | ((prev: string) => string)) => void) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();
  const session = useAppSession();
  const setPage = useAppStore(state => state.setPage);
  const openNotice = useModalStore(state => state.openNotice);
  const openSelectOne = useModalStore(state => state.openSelectOne);

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
    try {
      const history = await session.refreshHistory(limit);
      if (history.length === 0) {
        openNotice('Session History', 'No saved sessions found yet.');
        return;
      }
      openSelectOne({
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
            openNotice('Session History', 'Failed to restore the selected session.');
            return;
          }
          setPage('chat');
        },
      });
    } catch (error) {
      openNotice('Session History', 'Failed to load session history.');
    }
  }, [openNotice, openSelectOne, session, setPage]);

  // Build command handlers
  const handlers = useMemo(() => ({
    onHelp: () => openNotice('Help', `Available Commands:\n/new - Start a new session\n/model - Configure LLM model\n/history - Browse session history\n/resume - Resume last session\n/help - Show this message\n/quit - Exit application`),
    onNew: () => {
      session.clearSession();
      getAgent().replaceMessages([]);
      setPage('chat');
    },
    onModel: () => modelConfig.startConfig(),
    onHistory: () => { void openHistoryModal(); },
    onResume: () => { void openHistoryModal(10); },
    onQuit: () => exit(),
  }), [modelConfig, exit, openHistoryModal, openNotice, session, setPage]);

  // Execute slash command directly from this handler
  const confirmSlash = useCallback((cmd: string) => {
    useDebugStore.getState().addMessage(`[SlashList] confirmSlash called with: ${cmd}`);
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
