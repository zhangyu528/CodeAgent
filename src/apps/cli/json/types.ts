/**
 * JSON Event Types for NDJSON output mode
 */

/**
 * All possible JSON event types emitted during JSON mode execution
 */
export type JsonEvent = ResponseEvent | ToolCallEvent | ToolResultEvent | ErrorEvent;

export interface ResponseEvent {
  type: 'response';
  content: string;
  model: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: string;
  success: boolean;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}
