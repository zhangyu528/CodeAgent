import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { ChatMessage, ChatMessageRole } from '../pages/types.js';

function normalizeRole(role: string | undefined): ChatMessageRole {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'error') {
    return role;
  }
  return 'system';
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.content === 'string') return item.content;
        if (item && typeof item.input_text === 'string') return item.input_text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  if (content && typeof content === 'object') {
    const value = content as any;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.input_text === 'string') return value.input_text;
  }

  return '';
}

export function agentMessagesToChatMessages(messages: AgentMessage[]): ChatMessage[] {
  return messages.map((message: any, index) => {
    const role = normalizeRole(message.role);
    const text = extractText(message.content);
    const createdAt = typeof message.createdAt === 'number'
      ? message.createdAt
      : Date.now() + index;

    return {
      id: message.id || `${role}-${createdAt}-${index}`,
      role,
      title: role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : role === 'error' ? 'Error' : 'System',
      createdAt,
      status: role === 'error' ? 'error' : 'completed',
      blocks: [{ kind: 'text', text }],
    };
  });
}
