/**
 * JSON Mode - Agent event to NDJSON serializer
 * Connects pi-coding-agent session events to the NDJSON emitter
 */

import { emit, setJsonMode } from './emitter.js';
import type { AgentSessionEvent } from '../../../core/index.js';

/**
 * Initialize JSON mode with the agent
 * Sets up event listeners that emit NDJSON lines
 */
export function initJsonMode(): void {
  setJsonMode(true);
}

/**
 * Map agent session events to JSON events and emit them
 */
export function handleAgentEvent(event: AgentSessionEvent): void {
  switch (event.type) {
    case 'message_end': {
      // Assistant message response
      const msg = event.message as any;
      if (msg.role === 'assistant') {
        const content = extractTextContent(msg);
        if (content) {
          emit({
            type: 'response',
            content,
            model: msg.model || 'codeagent',
          });
        }
      }
      break;
    }

    case 'message_update': {
      // Streaming text delta
      const msgEvent = event.assistantMessageEvent as any;
      if (msgEvent?.type === 'text_delta' && msgEvent.delta) {
        emit({
          type: 'response',
          content: msgEvent.delta,
          model: (event.message as any)?.model || 'codeagent',
        });
      }
      break;
    }

    case 'agent_end':
    case 'auto_compaction_end':
    case 'auto_retry_end':
      // Session ended - no special output needed
      break;
  }
}

/**
 * Extract text content from an assistant message
 */
function extractTextContent(message: { content?: Array<{ type: string; text?: string }> }): string {
  if (!message.content) return '';
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    }
  }
  return parts.join('');
}
