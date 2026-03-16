import chalk from 'chalk';
import { confirm, search, select, input, checkbox, editor } from '@inquirer/prompts';
import { IUIAdapter } from '../../core/interfaces/ui';

export class TTY_UIAdapter implements IUIAdapter {
  constructor(private opts?: { 
    suspendInput?: <T>(fn: () => Promise<T>) => Promise<T>,
    onStatus?: (status: any) => void 
  }) {}

  private async withSuspendedInput<T>(fn: () => Promise<T>): Promise<T> {
    if (this.opts?.suspendInput) {
      return this.opts.suspendInput(fn);
    }
    return fn();
  }

  // --- IUIAdapter Implementation ---

  onThink(text: string): void {
    if (this.opts?.onStatus) {
      this.opts.onStatus({ type: 'think', text });
    }
  }

  onStream(token: string): void {
    process.stdout.write(token);
  }

  onToolStart(name: string, input: any): void {
    if (this.opts?.onStatus) {
      this.opts.onStatus({ type: 'tool_start', name, input });
    }
  }

  onToolEnd(name: string, output: any): void {
    if (this.opts?.onStatus) {
      this.opts.onStatus({ type: 'tool_end', name, output });
    }
  }

  onStatusUpdate(status: any): void {
    if (this.opts?.onStatus) {
      this.opts.onStatus(status);
    }
  }

  print(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(chalk.red(message));
  }

  info(message: string): void {
    console.log(chalk.cyan(message));
  }

  async ask(question: string): Promise<string> {
    return this.withSuspendedInput(async () => {
      return input({ message: question });
    });
  }

  async confirm(message: string): Promise<boolean> {
    return this.withSuspendedInput(async () => {
      return confirm({ message });
    });
  }

  async selectOne(message: string, choices: string[], opts?: { default?: string | undefined }): Promise<string> {
    const enableSearch = choices.length > 12;

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

  async selectMany(message: string, choices: string[], opts?: { defaults?: string[] | undefined }): Promise<string[]> {
    return this.withSuspendedInput(async () => {
        return checkbox({
            message,
            choices: choices.map(c => ({ 
                name: c, 
                value: c, 
                checked: !!opts?.defaults?.includes(c) 
            })),
        });
    });
  }

  async openEditor(message: string, initial?: string | undefined): Promise<string> {
    return this.withSuspendedInput(async () => {
        return editor({
            message,
            default: initial || '',
        });
    });
  }

  async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
    return this.withSuspendedInput(fn);
  }
}
