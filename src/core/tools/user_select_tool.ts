import { Tool } from './tool';
import { z } from 'zod';
import { IUIAdapter } from '../interfaces/ui';

export class UserSelectTool implements Tool {
  name = 'user_select';
  description = 'Ask the user to select one option interactively.';
  parameters = z.object({
    message: z.string().describe('Prompt message to show to the user.'),
    choices: z.array(z.string()).describe('List of selectable choices.'),
    default: z.string().optional().describe('Default selected value.'),
    enableSearch: z.boolean().optional().default(false).describe('Enable search/filter UI.'),
  });

  constructor(private ui: IUIAdapter) {}

  async execute(args: { message: string; choices: string[]; default?: string; enableSearch?: boolean }): Promise<string> {
    const selected = await this.ui.selectOne(args.message, args.choices, { default: args.default });
    return JSON.stringify({ selected });
  }
}
