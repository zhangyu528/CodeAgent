import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ReplaceContentTool implements Tool {
  name = 'replace_content';
  description = 'Replace a specific block of text in a file with new content. This is more efficient than writing the entire file.';
  parameters = z.object({
    filePath: z.string().describe('The path to the file to modify (relative to project root).'),
    targetContent: z.string().describe('The exact string to be replaced. Must match exactly including whitespace.'),
    replacementContent: z.string().describe('The new content to replace the target string.'),
  });

  async execute(args: { filePath: string; targetContent: string; replacementContent: string }): Promise<string> {
    try {
      const resolvedPath = path.resolve(process.cwd(), args.filePath);
      
      // Basic workspace check
      if (!resolvedPath.startsWith(process.cwd())) {
        return `Error: Access denied. Path is outside of workspace: ${args.filePath}`;
      }

      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      if (!content.includes(args.targetContent)) {
        return `Error: targetContent not found in file: ${args.filePath}. Please ensure the string matches exactly.`;
      }

      // Check for multiple occurrences (optional safety)
      const occurrences = content.split(args.targetContent).length - 1;
      if (occurrences > 1) {
        return `Error: targetContent appears ${occurrences} times in file. Please provide a more unique string to replace.`;
      }

      const newContent = content.replace(args.targetContent, args.replacementContent);
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      return `Successfully replaced content in file: ${args.filePath}`;
    } catch (error: any) {
      return `Error replacing content: ${error.message}`;
    }
  }
}
