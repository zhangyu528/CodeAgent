import { Tool } from './tool';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FindDefinitionTool implements Tool {
  name = 'find_definition';
  description = 'Find the definition of a symbol (class, function, variable) using greedy regex matching across the codebase.';
  parameters = z.object({
    name: z.string().describe('The name of the symbol to find (e.g., "AgentController").'),
    languageHint: z.string().optional().describe('Optional language hint (ts, js, py, go) to optimize regex.'),
  });

  async execute(args: { name: string; languageHint?: string }): Promise<string> {
    try {
      const root = process.cwd();
      const symbol = args.name;
      
      // Greedy regex for common definition patterns
      // Matches: export class Name, function Name, const Name =, interface Name, etc.
      const patterns = [
        new RegExp(`(class|interface|type|enum|function|const|let|var)\\s+${symbol}\\b`),
        new RegExp(`export\\s+(class|interface|type|enum|function|const|let|var)\\s+${symbol}\\b`),
        new RegExp(`${symbol}\\s*=\\s*(class|function|\\()`), // Name = class ... or Name = (args) =>
      ];

      const results: string[] = [];
      const ignoreDirs = ['node_modules', '.git', 'dist', 'temp', 'bin'];

      const walk = async (dir: string) => {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          const relativePath = path.relative(root, fullPath);

          if (file.isDirectory()) {
            if (ignoreDirs.includes(file.name)) continue;
            await walk(fullPath);
          } else {
            if (!file.name.match(/\.(ts|js|py|go|java|cpp|c|sh|md)$/i)) continue;

            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i] || '';
              if (patterns.some(p => p.test(line))) {
                results.push(`MATCH [${file.name}]: Line ${i + 1}: ${line.trim()}`);
                // Stop at first match per file for efficiency
                break; 
              }
            }
          }
        }
      };

      await walk(root);

      if (results.length === 0) {
        return `Definition of "${symbol}" not found.`;
      }

      return `Found ${results.length} potential definitions for "${symbol}":\n\n` + results.join('\n');
    } catch (error: any) {
      return `Error searching for definition: ${error.message}`;
    }
  }
}
