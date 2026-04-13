import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

export const writeFileTool = {
  name: 'write_file',
  label: 'Writing File',
  description: 'Write content to a file. Overwrites if exists.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to write to.'),
    content: z.string().describe('The content to write.'),
  }),
  execute: async (toolCallId: string, { filePath, content }: { filePath: string; content: string }): Promise<AgentToolResult<any>> => {
    // Check content size limit
    if (Buffer.byteLength(content, 'utf-8') > MAX_CONTENT_SIZE) {
      return {
        content: [{ type: 'text', text: `Error: Content too large (>${Math.round(MAX_CONTENT_SIZE/1024/1024)}MB limit)` }],
        details: { filePath, success: false, reason: 'content_too_large' }
      };
    }

    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { content: [{ type: 'text', text: `File written successfully: ${filePath}` }], details: { filePath, success: true } };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { filePath, success: false } };
    }
  },
};
