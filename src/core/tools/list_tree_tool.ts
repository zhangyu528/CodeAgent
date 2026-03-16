import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ListTreeTool implements Tool {
  name = 'list_tree';
  description = 'Display the file structure of the project as a tree. Useful for understanding project layout.';
  parameters = z.object({
    directoryPath: z.string().optional().default('.').describe('The root directory for the tree.'),
    maxDepth: z.number().optional().default(2).describe('Maximum depth to traverse.'),
  });

  async execute(args: { directoryPath: string; maxDepth: number }): Promise<string> {
    try {
      const root = path.resolve(process.cwd(), args.directoryPath);
      const ignoreDirs = ['node_modules', '.git', 'dist', 'bin'];

      const getTree = async (currentDir: string, depth: number, prefix: string = ''): Promise<string> => {
        if (depth > args.maxDepth) return '';

        let result = '';
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        // Sort: directories first
        entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (!entry) continue;

          if (entry.isDirectory() && ignoreDirs.includes(entry.name)) continue;

          const isLast = i === entries.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          
          result += `${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;

          if (entry.isDirectory()) {
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            result += await getTree(path.join(currentDir, entry.name), depth + 1, newPrefix);
          }
        }
        return result;
      };

      const tree = await getTree(root, 1);
      return `Project Tree (${args.directoryPath}):\n.\n` + (tree || '(empty or maximum depth reached)');
    } catch (error: any) {
      return `Error generating tree: ${error.message}`;
    }
  }
}
