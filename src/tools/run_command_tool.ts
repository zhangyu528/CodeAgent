import { Tool } from './tool';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Maximum characters per output stream before truncation kicks in */
const MAX_OUTPUT_LENGTH = 10000;

/**
 * Smart truncation: keeps the first 40% and last 40% of the text,
 * inserting a marker in the middle so the LLM sees both the beginning
 * context and the most recent (usually most relevant) output.
 */
function truncateOutput(text: string, maxLen: number = MAX_OUTPUT_LENGTH): string {
  if (text.length <= maxLen) return text;

  const headLen = Math.floor(maxLen * 0.4);
  const tailLen = Math.floor(maxLen * 0.4);
  const omitted = text.length - headLen - tailLen;

  return (
    text.slice(0, headLen) +
    `\n\n...[truncated ${omitted} characters]...\n\n` +
    text.slice(text.length - tailLen)
  );
}

/** Basic command blocklist for safety */
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf *',
  'format',
  'mkfs',
  'shutdown',
  'reboot',
  '> /dev/',
  'chmod -R 777 /',
];

export class RunCommandTool implements Tool {
  name = 'run_command';
  description = 'Execute a shell command in the local environment and return the output (stdout and stderr).';
  parameters = z.object({
    command: z.string().describe('The shell command to execute.'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds (default 30s).'),
  });

  async execute(args: { command: string; timeout?: number }): Promise<string> {
    // Basic safety check
    const lowerCmd = args.command.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
      if (lowerCmd.includes(blocked)) {
        return `Error: Command contains blocked pattern: "${blocked}". This operation is restricted for safety.`;
      }
    }

    try {
      const { stdout, stderr } = await execAsync(args.command, {
        timeout: args.timeout,
        cwd: process.cwd(),
      });

      let response = '';
      if (stdout) {
        response += `[Stdout]\n${truncateOutput(stdout)}\n`;
      }
      if (stderr) {
        response += `[Stderr]\n${truncateOutput(stderr)}\n`;
      }

      if (!response) {
        return 'Command executed successfully with no output.';
      }

      return response;
    } catch (error: any) {
      // In case of error (non-zero exit code), we still want to return stdout/stderr if available
      let errorMsg = `Command failed with error: ${error.message}\n`;
      if (error.stdout) errorMsg += `[Stdout]\n${truncateOutput(error.stdout)}\n`;
      if (error.stderr) errorMsg += `[Stderr]\n${truncateOutput(error.stderr)}\n`;
      return errorMsg;
    }
  }
}
