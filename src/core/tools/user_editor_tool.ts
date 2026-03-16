import { Tool } from './tool';
import { z } from 'zod';
import { IUIAdapter } from '../interfaces/ui';

export class UserEditorTool implements Tool {
  name = 'user_editor';
  description = 'Open a system editor for long-form input and return the edited text.';
  parameters = z.object({
    message: z.string().describe('Prompt message to show to the user.'),
    initial: z.string().optional().describe('Initial text placed into the editor.'),
  });

  constructor(private ui: IUIAdapter) {}

  async execute(args: { message: string; initial?: string }): Promise<string> {
    const text = await this.ui.openEditor(args.message, args.initial);
    return JSON.stringify({ text });
  }
}
