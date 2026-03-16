import { Tool } from './tool';
import { z } from 'zod';

export class EchoTool implements Tool {
  name = 'echo';
  description = 'Echoes back the input parameter. Useful for testing if the LLM can call tools correctly.';
  parameters = z.object({
    message: z.string().describe('The message to echo back.'),
  });

  async execute(args: { message: string }): Promise<string> {
    return args.message;
  }
}
