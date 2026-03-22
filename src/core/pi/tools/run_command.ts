import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const execAsync = promisify(exec);

export const runCommandTool = {
  name: 'run_command',
  label: 'Running Command',
  description: 'Run a shell command.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute.'),
  }),
  execute: async (toolCallId: string, { command }: { command: string }): Promise<AgentToolResult<any>> => {
    try {
      const { stdout, stderr } = await execAsync(command);
      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      return { content: [{ type: 'text', text: output }], details: { command, success: true } };
    } catch (error: any) {
      const output = `Command failed: ${error.message}${error.stderr ? `\nStderr:\n${error.stderr}` : ''}`;
      return { content: [{ type: 'text', text: output }], details: { command, success: false } };
    }
  },
};
