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
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        const obj = item as Record<string, unknown>;
        if (obj && typeof obj.text === 'string') return obj.text;
        if (obj && typeof obj.content === 'string') return obj.content;
        if (obj && typeof obj.input_text === 'string') return obj.input_text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  if (content && typeof content === 'object') {
    const value = content as Record<string, unknown>;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.input_text === 'string') return value.input_text;
  }

  return '';
}

/**
 * Convert agent messages (from pi-coding-agent session.messages) to ChatMessage format.
 * The input is typed as any[] since pi-coding-agent doesn't export AgentMessage type.
 */
export function agentMessagesToChatMessages(messages: any[]): ChatMessage[] {
  return messages.map((message: any, index: number) => {
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
