import { Tool } from './tool';
import { z } from 'zod';
import * as os from 'os';

export class SystemInfoTool implements Tool {
  name = 'get_system_info';
  description = 'Get information about the current operating system and working directory. Use this to determine appropriate shell commands (e.g., Windows vs Linux).';
  parameters = z.object({});

  async execute(): Promise<string> {
    try {
      const info = {
        platform: os.platform(), // 'win32', 'linux', 'darwin', etc.
        release: os.release(),
        arch: os.arch(),
        cwd: process.cwd(),
        shell: process.env.SHELL || (os.platform() === 'win32' ? 'PowerShell/cmd' : 'unknown')
      };

      return JSON.stringify(info, null, 2);
    } catch (error: any) {
      return `Error getting system info: ${error.message}`;
    }
  }
}
