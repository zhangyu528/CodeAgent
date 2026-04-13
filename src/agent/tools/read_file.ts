import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const readFileTool = {
  name: 'read_file',
  label: 'Reading File',
  description: 'Read the contents of a file. Maximum file size is 5MB.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to read.'),
  }),
  execute: async (toolCallId: string, { filePath }: { filePath: string }): Promise<AgentToolResult<any>> => {
    // Block deep path traversal patterns
    const resolvedPath = path.resolve(filePath);
    if (filePath.includes('../../../') || filePath.includes('..\\..\\..\\')) {
      return {
        content: [{ type: 'text', text: `Error: Path traversal detected in: ${filePath}` }],
        details: { filePath, success: false, reason: 'path_traversal' }
      };
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        return { 
          content: [{ type: 'text', text: `Error: File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is 5MB.` }], 
          details: { filePath, success: false, reason: 'file_too_large', size: stats.size } 
        };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return { content: [{ type: 'text', text: content }], details: { filePath, success: true, size: stats.size } };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { filePath, success: false } };
    }
  },
};
