import { z } from 'zod';
import * as fs from 'fs/promises';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

export const readFileTool = {
  name: 'read_file',
  label: 'Reading File',
  description: 'Read the contents of a file.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to read.'),
  }),
  execute: async (toolCallId: string, { filePath }: { filePath: string }): Promise<AgentToolResult<any>> => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content: [{ type: 'text', text: content }], details: { filePath, success: true } };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { filePath, success: false } };
    }
  },
};
