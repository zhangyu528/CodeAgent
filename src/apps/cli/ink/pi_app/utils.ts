import { randomUUID } from 'crypto';
import { ChatMessage, ChatSessionInfo, ChatMessageBlock } from '../components/pages/types.js';
import { SessionRecord } from '../../../../core/pi/sessions.js';

export type FocusOwner = 'exitConfirm' | 'modelConfig' | 'modal' | 'slash' | 'mainInput';

export const SLASH_COMMANDS = [
  { name: '/help', description: 'Show available commands', category: 'System', usage: '/help' },
  { name: '/new', description: 'Create and switch to new session', category: 'Session', usage: '/new' },
  { name: '/model', description: 'Select LLM provider and model', category: 'Config', usage: '/model' },
  { name: '/history', description: 'View session history', category: 'Session', usage: '/history' },
  { name: '/resume', description: 'Continue last session', category: 'Session', usage: '/resume' },
  { name: '/quit', description: 'Exit the application', category: 'System', usage: '/quit' },
];

export function createSessionId(): string {
  try {
    return randomUUID();
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function extractSessionTitle(text: string): string {
  const normalized = (text || '').trim();
  if (!normalized) return 'New Session';
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

export function extractSessionTitleFromMessages(messages: any[]): string {
  const firstUser = messages.find((m: any) => m.role === 'user' && typeof m.content === 'string');
  return extractSessionTitle(firstUser?.content || '');
}

export function toSessionView(session: SessionRecord): ChatSessionInfo {
  return {
    id: session.meta.id,
    title: session.meta.title,
    status: session.meta.status,
    updatedAt: session.meta.updatedAt,
    messageCount: session.meta.messageCount,
  };
}

function toDisplayText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.content === 'string') return item.content;
        if (item && typeof item.input_text === 'string') return item.input_text;
        if (item && typeof item.thinking === 'string') return item.thinking;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (content && typeof content === 'object') {
    const item = content as any;
    if (typeof item.text === 'string') return item.text;
    if (typeof item.content === 'string') return item.content;
    if (typeof item.input_text === 'string') return item.input_text;
    if (typeof item.thinking === 'string') return item.thinking;
  }
  return '';
}

export function toSessionMessages(messages: any[]): ChatMessage[] {
  return messages.map((m: any, i: number) => {
    const createdAt = Date.now() + i;
    if (m.role === 'user') {
      return {
        id: m.id || `restored-user-${i}`,
        role: 'user' as const,
        title: 'You',
        createdAt,
        status: 'completed' as const,
        blocks: [{ kind: 'text' as const, text: toDisplayText(m.content) }],
      };
    }

    return {
      id: m.id || `restored-assistant-${i}`,
      role: 'assistant' as const,
      title: 'Assistant',
      createdAt,
      status: 'completed' as const,
      blocks: [{ kind: 'text' as const, text: toDisplayText(m.content) }],
    };
  });
}

export function fromChatMessagesToAgentMessages(chatMessages: ChatMessage[]): any[] {
  if (!Array.isArray(chatMessages)) {
    console.error('[PiInkApp] ERROR: chatMessages is not an array');
    return [];
  }
  return chatMessages.map((m) => {
    const blocks = m.blocks || [];
    const content = blocks.map((b) => {
      if (b.kind === 'text') {
        return { type: 'text' as const, text: (b as any).text || '' };
      }
      return b;
    });

    return {
      id: m.id,
      role: m.role,
      content,
    };
  });
}
