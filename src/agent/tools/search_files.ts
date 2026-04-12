import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentToolResult } from '@mariozechner/pi-agent-core';

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
                if (regex.test(lines[i])) {
                  matches.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim().substring(0, 200),
                  });
                }
              }
              
              regex.lastIndex = 0; // Reset regex state
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
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], details: { success: false } };
    }
  },
};
