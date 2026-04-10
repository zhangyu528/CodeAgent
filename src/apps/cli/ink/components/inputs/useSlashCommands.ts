import { useCallback } from 'react';
import type { SessionInfo } from '../../../../../agent/index.js';
import { getAgent } from '../../../../../agent/index.js';
import { useAppStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/index.js';
import type { UseModelConfigResult } from '../../hooks/useModelConfig.js';
import { showNotice, showSelectOne } from '../modals/index.js';

export interface SlashListViewItem {
  name: string;
  description: string;
  category: string;
}

const HELP_MESSAGE = `Available Commands:
/new - Start a new session
/model - Configure LLM model
/history - Browse session history
/resume - Resume last session
/help - Show this message
/quit - Exit application`;

export const SLASH_COMMANDS: SlashListViewItem[] = [
  { name: '/help', description: 'Show available commands', category: 'general' },
  { name: '/new', description: 'Create and switch to new session', category: 'session' },
  { name: '/model', description: 'Select LLM provider and model', category: 'config' },
  { name: '/history', description: 'View session history', category: 'session' },
  { name: '/resume', description: 'Continue last session', category: 'session' },
  { name: '/quit', description: 'Exit the application', category: 'general' },
];

export { HELP_MESSAGE };

type CommandHandler = () => void;

interface SlashCommandHandlers {
  onHelp: () => void;
  onNew: () => void;
  onModel: () => void;
  onHistory: () => void;
  onResume: () => void;
  onQuit: () => void;
}

export function executeSlash(cmd: string, handlers: SlashCommandHandlers): boolean {
  const commands: Record<string, CommandHandler> = {
    '/help': handlers.onHelp,
    '/new': handlers.onNew,
    '/model': handlers.onModel,
    '/history': handlers.onHistory,
    '/resume': handlers.onResume,
    '/quit': handlers.onQuit,
  };

  // Exact match first
  if (commands[cmd]) {
    commands[cmd]!();
    return true;
  }

  // Prefix match - use longest match (e.g., /h -> /help, /hi -> /history, /his -> /history)
  const matchedKey = Object.keys(commands).filter(key => key.startsWith(cmd)).sort((a, b) => b.length - a.length)[0];
  if (matchedKey) {
    commands[matchedKey]!();
    return true;
  }

  return false;
}

function formatSessionChoice(item: SessionInfo): { value: string; label: string } {
  const updatedAt = new Date(item.updatedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    value: item.id,
    label: `${item.title} · ${updatedAt} · ${item.messageCount} msgs`,
  };
}

