import { Tool } from './tool';
import { z } from 'zod';
import { UIAdapter } from '../cli/ui_adapter';

export class UserSelectTool implements Tool {
  name = 'user_select';
  description = 'Ask the user to select one option interactively.';
  parameters = z.object({
    message: z.string().describe('Prompt message to show to the user.'),
    choices: z.array(z.string()).describe('List of selectable choices.'),
    default: z.string().optional().describe('Default selected value.'),
    enableSearch: z.boolean().optional().default(false).describe('Enable search/filter UI.'),
  });

  constructor(private ui: UIAdapter) {}

  async execute(args: { message: string; choices: string[]; default?: string; enableSearch?: boolean }): Promise<string> {
    const opts: any = {};
    if (args.enableSearch !== undefined) opts.enableSearch = args.enableSearch;
    if (args.default !== undefined) opts.default = args.default;

    const selected = await this.ui.selectOne(args.message, args.choices, opts);
    return JSON.stringify({ selected });
  }
}
