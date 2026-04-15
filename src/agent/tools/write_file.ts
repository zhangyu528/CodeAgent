import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';
import { emitToolCallStart, emitToolCallEnd, emitToolCallError } from '../trajectory.js';
import { ToolExecutionContext } from './sandbox/context.js';

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

// Module-level context — initialized once per module load (not per call)
let _sandboxCtx: ToolExecutionContext | null = null;

function getSandbox(): ToolExecutionContext {
  if (!_sandboxCtx) {
    _sandboxCtx = new ToolExecutionContext();
  }
  return _sandboxCtx;
}

export const writeFileTool = {
  name: 'write_file',
  label: 'Writing File',
  description: 'Write content to a file. Overwrites if exists.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to write to.'),
    content: z.string().describe('The content to write.'),
  }),
  execute: async (
    toolCallId: string,
    { filePath, content }: { filePath: string; content: string }
  ): Promise<AgentToolResult<any>> => {
    emitToolCallStart('write_file', toolCallId, {
      filePath,
      contentSize: Buffer.byteLength(content, 'utf-8'),
    });
    const startTime = Date.now();

    // Check content size limit
    if (Buffer.byteLength(content, 'utf-8') > MAX_CONTENT_SIZE) {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: `Error: Content too large (>${Math.round(MAX_CONTENT_SIZE / 1024 / 1024)}MB limit)`,
          },
        ],
        details: { filePath, success: false, reason: 'content_too_large' },
      };
      emitToolCallEnd('write_file', toolCallId, { success: false }, Date.now() - startTime);
      return result;
    }

    // Use sandbox context for path validation
    const ctx = getSandbox();
    const resolvedPath = ctx.validatePath(filePath);

    if (!resolvedPath) {
      const result = {
        content: [{ type: 'text' as const, text: `Error: Path outside workspace: ${filePath}` }],
        details: { filePath, success: false, reason: 'path_outside_workspace' },
      };
      emitToolCallEnd('write_file', toolCallId, { success: false }, Date.now() - startTime);
      return result;
    }

    try {
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(resolvedPath, content, 'utf-8');
      const result = {
        content: [{ type: 'text' as const, text: `File written successfully: ${resolvedPath}` }],
        details: { filePath: resolvedPath, success: true },
      };
      emitToolCallEnd('write_file', toolCallId, { success: true }, Date.now() - startTime);
      return result;
    } catch (error: any) {
      const result = {
        content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
        details: { filePath, success: false },
      };
      emitToolCallError('write_file', toolCallId, error.message, Date.now() - startTime);
      return result;
    }
  },
};
