import { IUIAdapter } from '../../../core/interfaces/ui';

type InkUIBindings = {
  appendLine: (text: string) => void;
  appendStream: (token: string) => void;
  requestAsk: (message: string, initial?: string) => Promise<string>;
  requestConfirm: (message: string) => Promise<boolean>;
  requestSelectOne: (message: string, choices: string[], defaultValue?: string) => Promise<string>;
  requestSelectMany: (message: string, choices: string[], defaults?: string[]) => Promise<string[]>;
};

export class InkUIAdapter implements IUIAdapter {
  private bindings: InkUIBindings | null = null;

  bind(bindings: InkUIBindings): void {
    this.bindings = bindings;
  }

  onThink(_text: string): void {
    this.bindings?.appendLine('Thinking...');
  }

  onStream(token: string): void {
    this.bindings?.appendStream(token);
  }

  onToolStart(name: string, _input: any): void {
    this.bindings?.appendLine(`Running: ${name}`);
  }

  onToolEnd(_name: string, _output: any): void {}
  onStatusUpdate(_status: any): void {}

  print(message: string): void {
    this.bindings?.appendLine(message);
  }

  error(message: string): void {
    this.bindings?.appendLine(`Error: ${message}`);
  }

  info(message: string): void {
    this.bindings?.appendLine(message);
  }

  async ask(question: string): Promise<string> {
    if (!this.bindings) return '';
    return this.bindings.requestAsk(question);
  }

  async confirm(message: string): Promise<boolean> {
    if (!this.bindings) return false;
    return this.bindings.requestConfirm(message);
  }

  async selectOne(message: string, choices: string[], opts?: { default?: string }): Promise<string> {
    if (!this.bindings) return choices[0] || '';
    return this.bindings.requestSelectOne(message, choices, opts?.default);
  }

  async selectMany(message: string, choices: string[], opts?: { defaults?: string[] }): Promise<string[]> {
    if (!this.bindings) return [];
    return this.bindings.requestSelectMany(message, choices, opts?.defaults);
  }

  async openEditor(message: string, initial?: string): Promise<string> {
    if (!this.bindings) return initial || '';
    return this.bindings.requestAsk(`${message} (single line)`, initial);
  }

  async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}