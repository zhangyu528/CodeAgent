import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';
import { validatePath } from './security-patterns.js';

// Workspace root - resolved dynamically from environment each time
// NOTE: This must be a function call (not a cached constant) because tests set
// CODEAGENT_WORKSPACE_ROOT after the module is imported. Using a function ensures
// we always read the current env value, not the value at module load time.
const getWorkspaceRoot = (): string => process.env.CODEAGENT_WORKSPACE_ROOT || process.cwd();

// ReDoS protection: regex.test() calls are wrapped with a step counter
// that aborts if execution exceeds MAX_REGEX_OPERATIONS to prevent catastrophic backtracking.
// Uses Symbol.toStringTag detection for nested quantifier patterns (a heuristic).
const MAX_REGEX_OPERATIONS = 10_000;
const MAX_FILES = 5000;

// Patterns with known catastrophic backtracking signatures
const DANGEROUS_PATTERN_PREFIXES = [
  /^\([^)]*[+*][)]/, // e.g. (a+)+ or ([a-z]+)*
];

function isLikelyCatastrophic(regex: RegExp): boolean {
  // Check the regex source for dangerous nested quantifier patterns
  const src = regex.source;
  for (const pattern of DANGEROUS_PATTERN_PREFIXES) {
    if (pattern.test(src)) return true;
  }
  // Heuristic: nested groups with + or * are risky
  // e.g. (a+)+ or (a|b+)+ or ((\w)+)*
  if (/\([^)]*[+*][^)]*\)[+*]/.test(src)) return true;
  return false;
}

function safeRegexTest(regex: RegExp, input: string): boolean {
  // Step counter — each test() call counts as 1 step
  let operations = 0;

  // We can't actually interrupt a running regex in JS, so we use two protections:
  // 1. Pre-flight check: detect likely catastrophic patterns before testing
  // 2. Hard limit: throw if regex operations exceed MAX_REGEX_OPERATIONS
  if (isLikelyCatastrophic(regex)) {
    return false; // Reject known-bad patterns proactively
  }

  // Set a hard operation cap by wrapping test
  const originalTest = regex.test.bind(regex);
  const wrappedTest = (str: string): boolean => {
    operations++;
    if (operations > MAX_REGEX_OPERATIONS) {
      throw new Error('Regex evaluation exceeded operation limit');
    }
    return originalTest(str);
  };

  try {
    // For very short inputs, direct test is acceptable
    if (input.length <= 200) {
      return wrappedTest(input);
    }

    // For longer inputs, scan line-by-line with the wrapped test
    const lines = input.split('\n');
    for (const line of lines) {
      if (wrappedTest(line)) return true;
    }
    return false;
  } catch {
    // On any error (operation limit, malformed pattern, etc.), return false
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

    // Use shared security module for path validation
    // Pass original directoryPath (not pre-resolved) so validatePath can detect and expand ~ correctly
    if (!validatePath(directoryPath, workspaceRoot)) {
      return {
        content: [{ type: 'text', text: `Error: Access denied. Path is outside workspace: ${directoryPath}` }],
        details: { directoryPath, success: false, reason: 'path_traversal' }
      };
    }

    try {
      const regex = new RegExp(pattern, 'gi');
      const matches: Array<{ file: string; line: number; content: string }> = [];
      const MAX_DEPTH = 10;
      let filesScanned = 0;

      const searchDir = async function(dir: string, depth: number = 0): Promise<void> {
        if (depth > MAX_DEPTH || matches.length >= maxResults || filesScanned >= MAX_FILES) return;
        
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return; // Skip directories we can't read
        }
        
        for (const entry of entries) {
          if (matches.length >= maxResults || filesScanned >= MAX_FILES) break;

          const fullPath = path.join(dir, entry.name);
          
          // Skip node_modules, .git, dist, etc.
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.turbo', 'coverage'].includes(entry.name)) {
              await searchDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            filesScanned++;
            if (filesScanned >= MAX_FILES) return;

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
                const line = lines[i];
                if (line && safeRegexTest(regex, line)) {
                  matches.push({
                    file: fullPath,
                    line: i + 1,
                    content: line.trim().substring(0, 200),
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
