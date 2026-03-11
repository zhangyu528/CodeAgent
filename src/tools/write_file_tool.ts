import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Write or overwrite a file with the provided content. It will create parent directories if they do not exist.';
  parameters = z.object({
    filePath: z.string().describe('The path to the file to write (relative to project root).'),
    content: z.string().describe('The full content to write to the file.'),
  });

  async execute(args: { filePath: string; content: string }): Promise<string> {
    try {
      const resolvedPath = path.resolve(process.cwd(), args.filePath);
      const parentDir = path.dirname(resolvedPath);

      // Ensure parent directory exists (recursive)
      await fs.mkdir(parentDir, { recursive: true });

      // Write the file (UTF-8)
      await fs.writeFile(resolvedPath, args.content, 'utf-8');

      return `Successfully wrote to file: ${args.filePath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }
}
