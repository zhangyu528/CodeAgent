import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Get the workspace root for path validation.
 * Supports CODEAGENT_WORKSPACE_ROOT env var, falls back to process.cwd().
 */
function getWorkspaceRoot(): string {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
}

/**
 * Validate that the resolved file path is within the workspace root.
 * Prevents path traversal attacks and arbitrary file writes.
 */
function validatePath(filePath: string): { valid: boolean; resolvedPath?: string; reason?: string } {
  // Expand ~ to home directory (Node.js path.resolve doesn't do this)
  let expandedPath = filePath;
  if (filePath.startsWith('~/') || filePath === '~') {
    expandedPath = path.join(process.env.HOME || process.env.USERPROFILE || '/', filePath.slice(1));
  }

  const resolvedPath = path.resolve(expandedPath);
  const workspaceRoot = path.resolve(getWorkspaceRoot());

  // Check if path tries to escape workspace (e.g., /a/../b/../c)
  if (!resolvedPath.startsWith(workspaceRoot + path.sep) && resolvedPath !== workspaceRoot) {
    return {
      valid: false,
      resolvedPath,
      reason: `Path outside workspace: ${filePath} resolves to ${resolvedPath}, workspace is ${workspaceRoot}`
    };
  }

  return { valid: true, resolvedPath };
}

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

    // Validate path is within workspace
    const pathValidation = validatePath(filePath);
    if (!pathValidation.valid) {
      return {
        content: [{ type: 'text', text: `Error: ${pathValidation.reason}` }],
        details: { filePath, success: false, reason: 'path_outside_workspace' }
      };
    }

    try {
      const dir = path.dirname(pathValidation.resolvedPath!);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(pathValidation.resolvedPath!, content, 'utf-8');
      return { content: [{ type: 'text', text: `File written successfully: ${pathValidation.resolvedPath}` }], details: { filePath: pathValidation.resolvedPath, success: true } };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { filePath, success: false } };
    }
  },
};
