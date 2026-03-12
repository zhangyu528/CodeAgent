import { Tool } from './tool';
import { z } from 'zod';
import { UIAdapter } from '../cli/ui_adapter';

export class UserCheckboxTool implements Tool {
  name = 'user_checkbox';
  description = 'Ask the user to select multiple options interactively.';
  parameters = z.object({
    message: z.string().describe('Prompt message to show to the user.'),
    choices: z.array(z.string()).describe('List of selectable choices.'),
    defaults: z.array(z.string()).optional().describe('Default checked values.'),
    enableSearch: z.boolean().optional().default(false).describe('Enable search/filter UI.'),
  });

  constructor(private ui: UIAdapter) {}

  async execute(args: { message: string; choices: string[]; defaults?: string[]; enableSearch?: boolean }): Promise<string> {
    const opts: any = {};
    if (args.enableSearch !== undefined) opts.enableSearch = args.enableSearch;
    if (args.defaults !== undefined) opts.defaults = args.defaults;

    const selected = await this.ui.selectMany(args.message, args.choices, opts);
    return JSON.stringify({ selected });
  }
}
