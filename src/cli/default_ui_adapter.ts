import chalk from 'chalk';
import { checkbox, confirm, editor, search, select } from '@inquirer/prompts';
import { parseRiskPrompt, RiskPrompt, UIAdapter } from './ui_adapter';

export class DefaultUIAdapter implements UIAdapter {
  constructor(private opts?: { suspendInput?: <T>(fn: () => Promise<T>) => Promise<T> }) {}

  isInteractive(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
  }

  private async withSuspendedInput<T>(fn: () => Promise<T>): Promise<T> {
    if (this.opts?.suspendInput) {
      return this.opts.suspendInput(fn);
    }
    return fn();
  }

  async showDiff(filePath: string, diffText: string): Promise<void> {
    console.log(chalk.dim(`\n--- Diff Preview: ${filePath} ---`));
    console.log(diffText);
    console.log(chalk.dim('--- End Diff ---\n'));
  }

  async confirmDiff(filePath: string, diffText: string, defaultYes: boolean = false): Promise<boolean> {
    if (!this.isInteractive()) {
      return false;
    }

    await this.showDiff(filePath, diffText);

    return this.withSuspendedInput(async () => {
      return confirm({
        message: `Apply these changes to ${filePath}?`,
        default: defaultYes,
      });
    });
  }

  async confirmRisk(prompt: string | RiskPrompt): Promise<boolean> {
    if (!this.isInteractive()) return false;

    const rp = parseRiskPrompt(prompt);
    const title =
      rp.level === 'HIGH' ? chalk.red.bold('[HIGH RISK]') :
      rp.level === 'MEDIUM' ? chalk.yellow.bold('[MEDIUM RISK]') :
      chalk.cyan.bold('[LOW RISK]');

    const detail = rp.detail ? chalk.white(rp.detail) : '';
    const reason = rp.reason ? chalk.dim(`Reason: ${rp.reason}`) : '';

    const msg = [
      `${title} ${rp.title}`,
      detail,
      reason,
    ].filter(Boolean).join('\n');

    return this.withSuspendedInput(async () => {
      return confirm({
        message: msg + '\nAllow?',
        default: false,
      });
    });
  }

  async selectOne(message: string, choices: string[], opts?: { default?: string; enableSearch?: boolean }): Promise<string> {
    const enableSearch = Boolean(opts?.enableSearch) || choices.length > 12;

    return this.withSuspendedInput(async () => {
      if (enableSearch) {
        return search({
          message,
          source: async (input) => {
            const q = String(input || '').toLowerCase();
            return choices
              .filter(c => c.toLowerCase().includes(q))
              .map(c => ({ name: c, value: c }));
          },
        });
      }

      return select({
        message,
        choices: choices.map(c => ({ name: c, value: c })),
        default: opts?.default,
      });
    });
  }

  async selectMany(message: string, choices: string[], opts?: { defaults?: string[]; enableSearch?: boolean }): Promise<string[]> {
    const enableSearch = Boolean(opts?.enableSearch) || choices.length > 12;

    return this.withSuspendedInput(async () => {
      if (enableSearch) {
        // For checkbox + search, we use checkbox and let the user scroll; inquirer doesn't support filter+checkbox directly.
        return checkbox({
          message,
          choices: choices.map(c => ({ name: c, value: c, checked: (opts?.defaults || []).includes(c) })),
        });
      }

      return checkbox({
        message,
        choices: choices.map(c => ({ name: c, value: c, checked: (opts?.defaults || []).includes(c) })),
      });
    });
  }

  async openEditor(message: string, initial?: string): Promise<string> {
    return this.withSuspendedInput(async () => {
      return editor({
        message,
        default: initial || '',
      });
    });
  }
}

