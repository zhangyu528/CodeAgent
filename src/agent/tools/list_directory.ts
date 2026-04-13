import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

// Workspace root - can be overridden via environment variable or defaults to process.cwd()
const getWorkspaceRoot = (): string => {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
};

export const listDirectoryTool = {
  name: 'list_directory',
  label: 'Listing Directory',
  description: 'List the contents of a directory.',
  parameters: z.object({
    directoryPath: z.string().describe('The path to the directory to list.'),
  }),
  execute: async (toolCallId: string, { directoryPath }: { directoryPath: string }): Promise<AgentToolResult<any>> => {
    const workspaceRoot = getWorkspaceRoot();
    const resolvedPath = path.resolve(directoryPath);
    const normalizedWorkspace = path.resolve(workspaceRoot) + path.sep;

    // Reject home directory paths (~ expansion is NOT done by Node.js path.resolve)
    if (directoryPath.startsWith('~') || resolvedPath.includes('/~')) {
      return {
        content: [{ type: 'text', text: `Error: Access denied. Home directory paths are not allowed: ${directoryPath}` }],
        details: { directoryPath, success: false, reason: 'path_traversal' }
      };
    }

    // Check if resolved path is within workspace root
    if (!resolvedPath.startsWith(normalizedWorkspace)) {
      return {
        content: [{ type: 'text', text: `Error: Access denied. Path is outside workspace: ${directoryPath}` }],
        details: { directoryPath, success: false, reason: 'path_traversal' }
      };
    }

    try {
      const files = await fs.readdir(resolvedPath, { withFileTypes: true });
      const lines = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`);
      const output = lines.length > 0 ? lines.join('\n') : '(empty)';
      return { content: [{ type: 'text', text: output }], details: { directoryPath, success: true } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error: ${message}` }], details: { directoryPath, success: false } };
    }
  },
};
