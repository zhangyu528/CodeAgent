import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Workspace root - can be overridden via environment variable or defaults to process.cwd()
const getWorkspaceRoot = (): string => {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
};

export const readFileTool = {
  name: 'read_file',
  label: 'Reading File',
  description: 'Read the contents of a file. Maximum file size is 5MB.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to read.'),
  }),
  execute: async (toolCallId: string, { filePath }: { filePath: string }): Promise<AgentToolResult<any>> => {
    const workspaceRoot = getWorkspaceRoot();
    const resolvedPath = path.resolve(filePath);
    const normalizedWorkspace = path.resolve(workspaceRoot) + path.sep;

    // Reject home directory paths (~ expansion is NOT done by Node.js path.resolve)
    if (filePath.startsWith('~') || resolvedPath.includes('/~')) {
      return {
        content: [{ type: 'text', text: `Error: Access denied. Home directory paths are not allowed: ${filePath}` }],
        details: { filePath, success: false, reason: 'path_traversal' }
      };
    }

    // Check if resolved path is within workspace root
    if (!resolvedPath.startsWith(normalizedWorkspace)) {
      return {
        content: [{ type: 'text', text: `Error: Access denied. Path is outside workspace: ${filePath}` }],
        details: { filePath, success: false, reason: 'path_traversal' }
      };
    }

    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.size > MAX_FILE_SIZE) {
        return { 
          content: [{ type: 'text', text: `Error: File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is 5MB.` }], 
          details: { filePath, success: false, reason: 'file_too_large', size: stats.size } 
        };
      }
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return { content: [{ type: 'text', text: content }], details: { filePath, success: true, size: stats.size } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error: ${message}` }], details: { filePath, success: false } };
    }
  },
};
