import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Workspace root - cached at module load time to avoid repeated process.env lookups
// Can be overridden via CODEAGENT_WORKSPACE_ROOT before the module is first imported
const WORKSPACE_ROOT = process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();

export const readFileTool = {
  name: 'read_file',
  label: 'Reading File',
  description: 'Read the contents of a file. Maximum file size is 5MB.',
  parameters: z.object({
    filePath: z.string().describe('The path to the file to read.'),
  }),
  execute: async (toolCallId: string, { filePath }: { filePath: string }): Promise<AgentToolResult<any>> => {
    const workspaceRoot = WORKSPACE_ROOT;
    // Expand ~ to home directory (Node.js path.resolve doesn't do this automatically)
    let resolvedPath = path.resolve(filePath);
    if (filePath.startsWith('~') || resolvedPath.includes('/~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
      const expandedPath = filePath.replace(/^~/, homeDir);
      resolvedPath = path.resolve(expandedPath);
    }

    const normalizedWorkspace = path.resolve(workspaceRoot) + path.sep;

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
