import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ListDirectoryTool implements Tool {
  name = 'list_directory';
  description = 'List the contents of a directory. Returns a structured list of files and folders.';
  parameters = z.object({
    directoryPath: z.string().optional().default('.').describe('The path to the directory to list (relative to project root). Use forward slashes (/) for paths even on Windows to avoid escape character issues.'),
  });

  async execute(args: { directoryPath: string }): Promise<string> {
    try {
      const resolvedPath = path.resolve(process.cwd(), args.directoryPath);
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      
      const result = entries.map(entry => {
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file'
        };
      });

      if (result.length === 0) {
        return `Directory is empty: ${args.directoryPath}`;
      }

      return JSON.stringify(result, null, 2);
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  }
}
