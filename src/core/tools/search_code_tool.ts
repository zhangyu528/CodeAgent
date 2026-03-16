import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SearchCodeTool implements Tool {
  name = 'search_code';
  description = 'Search for a text pattern or regex in all files within the workspace (Grep-like). Returns matching lines with line numbers.';
  parameters = z.object({
    query: z.string().describe('The search pattern or keyword.'),
    includeFiles: z.string().optional().describe('Optional glob pattern or file extension to include (e.g., "*.ts").'),
    excludeFiles: z.string().optional().describe('Optional patterns to exclude (e.g., "node_modules,dist").'),
  });

  private maxMatches = 20;

  async execute(args: { query: string; includeFiles?: string; excludeFiles?: string }): Promise<string> {
    try {
      const root = process.cwd();
      const results: string[] = [];
      let matchCount = 0;

      const ignoreDirs = ['node_modules', '.git', 'dist', 'bin', 'obj', 'temp'];
      const excludeList = args.excludeFiles ? args.excludeFiles.split(',').map(s => s.trim()) : [];

      const regex = new RegExp(args.query, 'i');

      const walk = async (dir: string) => {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          const relativePath = path.relative(root, fullPath);

          if (file.isDirectory()) {
            if (ignoreDirs.includes(file.name) || excludeList.includes(file.name)) continue;
            await walk(fullPath);
          } else {
            // Extension filtering
            if (args.includeFiles && !this.matchGlob(file.name, args.includeFiles)) continue;
            
            // Skip binary-ish or huge files if needed? (Simple text check for now)
            if (file.name.match(/\.(png|jpg|exe|dll|zip|lock|bin)$/i)) continue;

            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i] || '')) {
                matchCount++;
                if (matchCount > this.maxMatches) {
                  return results.join('\n') + `\n\n[Warning] Too many matches. Found more than ${this.maxMatches}. Please refine your query.`;
                }
                results.push(`${relativePath}:${i + 1}: ${lines[i]?.trim()}`);
              }
            }
          }
        }
      };

      await walk(root);

      if (results.length === 0) {
        return `No matches found for "${args.query}"`;
      }

      return `Found ${matchCount} matches:\n\n` + results.join('\n');
    } catch (error: any) {
      return `Error during search: ${error.message}`;
    }
  }

  private matchGlob(filename: string, pattern: string): boolean {
    // Simple extension/glob check
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(2);
      return filename.endsWith(ext);
    }
    return filename.includes(pattern);
  }
}
