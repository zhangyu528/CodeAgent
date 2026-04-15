/**
 * JSON Mode - Agent event to NDJSON serializer
 * Connects pi-agent-core events to the NDJSON emitter
 */

import { emit, setJsonMode } from './emitter.js';
import type { AgentEvent } from '@mariozechner/pi-agent-core';

/**
 * Initialize JSON mode with the agent
 * Sets up event listeners that emit NDJSON lines
 */
export function initJsonMode(): void {
  setJsonMode(true);
}

/**
 * Map agent events to JSON events and emit them
 */
export function handleAgentEvent(event: AgentEvent): void {
  switch (event.type) {
    case 'message_end': {
      // Assistant message response
      if (event.message.role === 'assistant') {
        const content = extractTextContent(event.message as any);
        if (content) {
          emit({
            type: 'response',
            content,
            model: (event.message as any).model || 'codeagent',
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
          model: (event.message as any).model || 'codeagent',
        });
      }
      break;
    }

    case 'tool_execution_start': {
      emit({
        type: 'tool_call',
        tool: event.toolName,
        args: event.args || {},
      });
      break;
    }

    case 'tool_execution_end': {
      // Extract result text from the tool execution result
      const resultText = extractResultText(event.result);
      emit({
        type: 'tool_result',
        tool: event.toolName,
        result: resultText,
        success: !event.isError,
      });
      break;
    }

    case 'agent_end': {
      // Session ended - no special output needed
      break;
    }
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

/**
 * Extract readable text from tool result
 */
function extractResultText(result: unknown): string {
  if (!result) return '';

  // Handle ToolResultMessage-like structure
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;

    // Check for content array
    if (Array.isArray(r.content)) {
      return r.content
        .map((item: { type?: string; text?: string }) => {
          if (item.type === 'text' && item.text) return item.text;
          return String(item);
        })
        .join('');
    }

    // Fallback: stringify the result
    return JSON.stringify(r);
  }

  return String(result);
}
