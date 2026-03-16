import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSearchTool implements Tool {
  name = 'file_search';
  description = 'Search for a text pattern in all files within the workspace. Returns matching files and line numbers.';
  parameters = z.object({
    query: z.string().describe('The text pattern to search for.'),
    includeFiles: z.string().optional().describe('Optional glob pattern or file extension to include (e.g., "*.ts").'),
  });

  async execute(args: { query: string; includeFiles?: string }): Promise<string> {
    try {
      const results: { file: string; line: number; content: string }[] = [];
      const rootDir = process.cwd();

      async function searchDir(currentDir: string) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);

          // Skip node_modules and .git
          if (entry.name === 'node_modules' || entry.name === '.git') continue;

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else if (entry.isFile()) {
            // Basic extension filter if provided
            if (args.includeFiles && !entry.name.endsWith(args.includeFiles.replace('*', ''))) {
              continue;
            }

            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.includes(args.query)) {
                results.push({
                  file: relativePath,
                  line: index + 1,
                  content: line.trim()
                });
              }
            });
          }
        }
      }

      await searchDir(rootDir);

      if (results.length === 0) {
        return `No matches found for query: "${args.query}"`;
      }

      // Limit results to prevent context overflow
      const maxResults = 50;
      const truncatedResults = results.slice(0, maxResults);
      let output = `Found ${results.length} matches (showing first ${truncatedResults.length}):\n\n`;
      
      truncatedResults.forEach(res => {
        output += `[${res.file}:${res.line}] ${res.content}\n`;
      });

      if (results.length > maxResults) {
        output += `\n... (more matches found, total: ${results.length})`;
      }

      return output;
    } catch (error: any) {
      return `Error searching files: ${error.message}`;
    }
  }
}
