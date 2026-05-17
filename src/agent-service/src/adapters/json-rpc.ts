/**
 * JSON-RPC Server Adapter
 *
 * Provides JSON-RPC over STDIO for WinUI clients.
 */

import type { AgentService } from '../services/types.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any[];
  id: number | string | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: { code: number; message: string; data?: any };
  id: number | string | null;
}

export function createJsonRpcServer(service: AgentService) {
  function sendResponse(response: JsonRpcResponse) {
    console.log(JSON.stringify(response));
  }

  function sendEvent(event: string, data: any) {
    console.log(JSON.stringify({ jsonrpc: '2.0', method: 'event', params: { event, data } }));
  }

  async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params = [], id } = request;

    if (!method) {
      return { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id };
    }

    try {
      const serviceMethod = (service as any)[method];
      if (typeof serviceMethod !== 'function') {
        return { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id };
      }

      const result = await serviceMethod(...params);
      return { jsonrpc: '2.0', result, id };
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message || 'Internal error',
          data: error.stack,
        },
        id,
      };
    }
  }

  async function processLine(line: string) {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const response = await handleRequest(request);
      sendResponse(response);
    } catch (error) {
      sendResponse({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      });
    }
  }

  return {
    start() {
      // Subscribe to service events and forward as notifications
      service.onEvent((event) => {
        sendEvent('agent:event', event);
      });

      // Read from stdin
      const stdin = process.stdin;
      stdin.setEncoding('utf8');

      let buffer = '';
      stdin.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line);
        }
      });

      stdin.on('end', () => {
        if (buffer.trim()) {
          processLine(buffer);
        }
      });
    },

    sendEvent,
  };
}