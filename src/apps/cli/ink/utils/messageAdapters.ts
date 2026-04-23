import type { ChatMessage, ChatMessageRole } from '../pages/types.js';

function normalizeRole(role: string | undefined): ChatMessageRole {
  if (role === 'user' || role === 'assistant' || role === 'system' || role === 'error') {
    return role;
  }
  return 'system';
}

function extractBlocks(
  content: unknown
): Array<
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string; collapsed?: boolean }
  | { kind: 'reasoning'; text: string; collapsed?: boolean }
> {
  if (typeof content === 'string') {
    return [{ kind: 'text', text: content }];
  }

  if (Array.isArray(content)) {
    const blocks: Array<
      | { kind: 'text'; text: string }
      | { kind: 'thinking'; text: string; collapsed?: boolean }
      | { kind: 'reasoning'; text: string; collapsed?: boolean }
    > = [];
    for (const item of content) {
      if (typeof item === 'string') {
        blocks.push({ kind: 'text', text: item });
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (obj.kind === 'thinking') {
          blocks.push({ kind: 'thinking', text: String(obj.text ?? ''), collapsed: true });
        } else if (obj.kind === 'reasoning') {
          blocks.push({ kind: 'reasoning', text: String(obj.text ?? ''), collapsed: true });
        } else if (obj.kind === 'toolSummary') {
          // toolSummary 降级为 text block
          blocks.push({ kind: 'text', text: String(obj.text ?? '') });
        } else {
          // 其他 object，统一提取 text
          const text =
            (obj.text as string) ?? (obj.content as string) ?? (obj.input_text as string) ?? '';
          if (text) blocks.push({ kind: 'text', text });
        }
      }
    }
    return blocks.length > 0 ? blocks : [{ kind: 'text', text: '' }];
  }

  if (content && typeof content === 'object') {
    const value = content as Record<string, unknown>;
    if (value.kind === 'thinking') {
      return [{ kind: 'thinking', text: String(value.text ?? ''), collapsed: true }];
    }
    if (value.kind === 'reasoning') {
      return [{ kind: 'reasoning', text: String(value.text ?? ''), collapsed: true }];
    }
    const text =
      (value.text as string) ?? (value.content as string) ?? (value.input_text as string) ?? '';
    return [{ kind: 'text', text }];
  }

  return [{ kind: 'text', text: '' }];
}

/**
 * Convert agent messages (from pi-coding-agent session.messages) to ChatMessage format.
 * The input is typed as any[] since pi-coding-agent doesn't export AgentMessage type.
 */
export function agentMessagesToChatMessages(messages: any[]): ChatMessage[] {
  return messages.map((message: any, index: number) => {
    const role = normalizeRole(message.role);
    const blocks = extractBlocks(message.content);
    console.error(
      '[adapter] msg id=',
      message.id,
      'role=',
      role,
      'blocks=',
      JSON.stringify(blocks)
    );
    const createdAt =
      typeof message.createdAt === 'number' ? message.createdAt : Date.now() + index;

    return {
      id: message.id || `${role}-${createdAt}-${index}`,
      role,
      title:
        role === 'user'
          ? 'You'
          : role === 'assistant'
            ? 'Assistant'
            : role === 'error'
              ? 'Error'
              : 'System',
      createdAt,
      status: role === 'error' ? 'error' : 'completed',
      blocks,
    };
  });
}
