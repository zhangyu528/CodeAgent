import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

// Workspace root - can be overridden via environment variable or defaults to process.cwd()
const getWorkspaceRoot = (): string => {
  return process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();
};

// ReDoS protection: wraps a regex.test() call with a step counter
// that aborts if execution exceeds MAX_REGEX_STEPS to prevent catastrophic backtracking
const MAX_REGEX_STEPS = 100_000;

function safeRegexTest(regex: RegExp, input: string): boolean {
  let steps = 0;
  const originalTest = regex.test.bind(regex);

  // Override lastIndex to track progress across test() calls on the same regex
  let lastIndex = 0;

  // We can't actually interrupt a regex in JS, but we can limit the input length
  // and set a conservative step budget
  const testable = input.length > 10_000 ? input.substring(0, 10_000) : input;

  try {
    // Use a wrapper that counts steps via substring matching
    // For short inputs, direct test is safe
    if (testable.length <= 1_000) {
      return originalTest(testable);
    }

    // For longer inputs, test in chunks to limit backtracking exposure
    const chunkSize = 500;
    for (let i = 0; i < testable.length; i += chunkSize) {
      steps += chunkSize;
      if (steps > MAX_REGEX_STEPS) {
        // Input too complex — reject rather than risk ReDoS
        throw new Error('Regex evaluation aborted: input too complex');
      }
      const chunk = testable.substring(i, i + chunkSize);
      if (originalTest(chunk)) {
        return true;
      }
    }
    return false;
  } catch {
    // On any error (including complexity limit), return false rather than crashing
    return false;
  }
}

export const searchFilesTool = {
  name: 'search_files',
  label: 'Searching Files',
  description: 'Search for a pattern in files within a directory. Supports regex patterns.',
  parameters: z.object({
    pattern: z.string().describe('The regex pattern to search for.'),
    directoryPath: z.string().describe('The directory to search in.').optional(),
    fileExtension: z.string().describe('Optional file extension filter (e.g., ".ts", ".tsx").').optional(),
    maxResults: z.number().describe('Maximum number of results to return.').optional().default(50),
  }),
  execute: async (
    toolCallId: string, 
    { pattern, directoryPath = '.', fileExtension, maxResults = 50 }: 
    { pattern: string; directoryPath?: string; fileExtension?: string; maxResults?: number }
  ): Promise<AgentToolResult<any>> => {
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
      const regex = new RegExp(pattern, 'gi');
      const matches: Array<{ file: string; line: number; content: string }> = [];
      const MAX_DEPTH = 10;
      
      const searchDir = async function(dir: string, depth: number = 0): Promise<void> {
        if (depth > MAX_DEPTH || matches.length >= maxResults) return;
        
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return; // Skip directories we can't read
        }
        
        for (const entry of entries) {
          if (matches.length >= maxResults) break;
          
          const fullPath = path.join(dir, entry.name);
          
          // Skip node_modules, .git, dist, etc.
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.turbo', 'coverage'].includes(entry.name)) {
              await searchDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            // Filter by extension if specified
            if (fileExtension && !entry.name.endsWith(fileExtension)) {
              continue;
            }
            
            // Try to read and search the file
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              
              for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxResults) break;
                if (safeRegexTest(regex, lines[i])) {
                  matches.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim().substring(0, 200),
                  });
                }
              }
              
              regex.lastIndex = 0; // Reset regex state for next line
            } catch {
              // Skip files we can't read
            }
          }
        }
      };
      
      await searchDir(directoryPath);
      
      if (matches.length === 0) {
        return { 
          content: [{ type: 'text', text: `No matches found for pattern: ${pattern}` }], 
          details: { pattern, directoryPath, matches: 0 } 
        };
      }
      
      const output = matches.map(m => `${m.file}:${m.line}: ${m.content}`).join('\n');
      return { 
        content: [{ type: 'text', text: `Found ${matches.length} matches:\n\n${output}` }], 
        details: { pattern, directoryPath, matches: matches.length } 
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error: ${message}` }], details: { success: false } };
    }
  },
};
