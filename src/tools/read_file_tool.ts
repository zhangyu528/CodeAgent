import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Read the contents of a local file. Provide the file path.';
  parameters = z.object({
    filePath: z.string().describe('The absolute or relative path to the file to read.'),
  });

  async execute(args: { filePath: string }): Promise<string> {
    try {
      // Security Layer placeholder: Resolve to absolute, check workspace
      const resolvedPath = path.resolve(process.cwd(), args.filePath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return content;
    } catch (error: any) {
      // Return error message to LLM instead of crashing
      return `Error reading file: ${error.message}`;
    }
  }
}
