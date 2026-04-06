import { z } from 'zod';
import * as fs from 'fs/promises';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

export const listDirectoryTool = {
  name: 'list_directory',
  label: 'Listing Directory',
  description: 'List the contents of a directory.',
  parameters: z.object({
    directoryPath: z.string().describe('The path to the directory to list.'),
  }),
  execute: async (toolCallId: string, { directoryPath }: { directoryPath: string }): Promise<AgentToolResult<any>> => {
    try {
      const files = await fs.readdir(directoryPath, { withFileTypes: true });
      const lines = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`);
      const output = lines.length > 0 ? lines.join('\n') : '(empty)';
      return { content: [{ type: 'text', text: output }], details: { directoryPath, success: true } };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { directoryPath, success: false } };
    }
  },
};
