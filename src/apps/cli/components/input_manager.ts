import blessed from 'blessed';
import { AgentController } from '../../../core/controller/agent_controller';
import { LLMEngine } from '../../../core/llm/engine';
import { SlashCommandDef, dispatchSlash, parseSlash, getBestMatch } from './slash_commands';
import { SlashCommandPopup } from './slash_popup';
import { TelemetryMonitor } from '../../../utils/logger';
import { IUIAdapter } from '../../../core/interfaces/ui';
import chalk = require('chalk');

function getCliVersion(): string {
  try {
    const pkg = require('../../../package.json') as { version?: string };
    const v = String(pkg?.version || '').trim();
    return v || 'dev';
  } catch {
    return 'dev';
  }
}

class BlessedUIAdapter implements IUIAdapter {
  constructor(private inputManager: InputManager) {}

  onThink(_text: string): void {
    this.inputManager.appendOutput(chalk.dim('Thinking...'));
  }

  onStream(token: string): void {
    this.inputManager.appendOutputToScreen(token);
  }

  onToolStart(name: string, _input: any): void {
    this.inputManager.appendOutput(chalk.yellow(`Running: ${name}`));
  }

  onToolEnd(_name: string, _output: any): void {}

  onStatusUpdate(_status: any): void {}

  print(message: string): void {
    this.inputManager.appendOutput(message);
  }

  error(message: string): void {
    this.inputManager.appendOutput(chalk.red(message));
  }

  info(message: string): void {
    this.inputManager.appendOutput(chalk.cyan(message));
  }

  async ask(question: string): Promise<string> {
    return this.inputManager.promptInput(question);
  }

  async confirm(message: string): Promise<boolean> {
    return this.inputManager.promptConfirm(message);
  }

  async selectOne(message: string, choices: string[], opts?: { default?: string }): Promise<string> {
    return this.inputManager.promptSelect(message, choices, opts?.default);
  }

  async selectMany(message: string, choices: string[], opts?: { defaults?: string[] }): Promise<string[]> {
    return this.inputManager.promptSelectMany(message, choices, opts?.defaults);
  }

  async openEditor(message: string, initial?: string): Promise<string> {
    return this.inputManager.promptEditor(message, initial);
  }

  async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export interface InputManagerOptions {
  provider?: string;
  providers?: string[];
  onExit?: () => void;
  controller?: AgentController;
  engine?: LLMEngine;
  commands?: SlashCommandDef[];
  telemetry?: TelemetryMonitor;
  ui?: IUIAdapter;
}

const ASCII_LOGO = [
  '  ___            _        _                    _  ',
  ' / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ',
  "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
  ' \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|',
  '                           |___/                  ',
];

export class InputManager {
  private screen: ReturnType<typeof blessed.screen>;
  private logoBox: ReturnType<typeof blessed.box>;
  private outputBox: ReturnType<typeof blessed.box>;
  private inputLine: ReturnType<typeof blessed.box>;
  private inputContainer: ReturnType<typeof blessed.box>;
  private inputText: ReturnType<typeof blessed.textbox>;
  private metaLine: ReturnType<typeof blessed.box>;
  private divider: ReturnType<typeof blessed.line>;
  private popup: SlashCommandPopup;
  private opts: InputManagerOptions;
  private processing = false;
  private currentAbort: AbortController | null = null;
  private isWelcomeMode = true;
  private blessedAdapter: IUIAdapter;
  private interactivePromptActive = false;
  private selectModalActive = false;
  private selectModalCleanup: (() => void) | undefined;

  private currentProvider = 'unknown';
  private currentModel = 'unknown';

  constructor(opts: InputManagerOptions) {
    this.opts = opts;
    this.blessedAdapter = new BlessedUIAdapter(this);

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'CodeAgent CLI',
      terminal: 'xterm-256color',
      fullUnicode: true,
      dockBorders: true,
    });

    this.logoBox = blessed.box({
      content: this.buildLogoContent(),
      tags: true,
      align: 'center',
      style: { fg: 'white', bg: 'black' },
    });

    this.divider = blessed.line({
      orientation: 'horizontal',
      style: { fg: 'gray', bg: 'black' },
    });

    this.outputBox = blessed.box({
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: { fg: 'white', bg: 'black' },
    });

    this.inputContainer = blessed.box({
      height: 5,
      style: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'gray' },
      },
    });

    const prompt = blessed.box({
      top: 0,
      left: 0,
      width: 2,
      content: '{cyan-fg}❯{/}',
      tags: true,
      style: { fg: 'white', bg: 'black' },
    });

    this.inputText = blessed.textbox({
      top: 0,
      left: 2,
      width: '100%-2',
      height: 1,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: { fg: 'cyan', bg: 'black' },
      },
      inputOnFocus: true,
    });

    this.inputLine = blessed.box({ top: 0, left: 0, width: '100%', height: 3 });
    this.inputLine.append(prompt);
    this.inputLine.append(this.inputText);

    this.metaLine = blessed.box({
      top: 3,
      left: 1,
      width: '100%-2',
      height: 1,
      tags: true,
      content: '',
      style: { fg: 'gray', bg: 'black' },
    });

    this.inputContainer.append(this.inputLine);
    this.inputContainer.append(this.metaLine);

    this.screen.append(this.logoBox);
    this.screen.append(this.divider);
    this.screen.append(this.outputBox);
    this.screen.append(this.inputContainer);

    this.popup = new SlashCommandPopup(this.screen, this.opts.commands || [], this.inputContainer);

    this.updateLayout();
    this.renderInputMeta();
    this.setupKeyEvents();
  }

  private updateLayout() {
    if (this.isWelcomeMode) {
      this.logoBox.top = '15%';
      this.logoBox.left = 'center';
      this.logoBox.width = '100%';
      this.logoBox.height = 14;
      this.logoBox.align = 'center';

      this.inputContainer.top = '55%';
      this.inputContainer.left = 'center';
      this.inputContainer.width = '80%';
      this.inputContainer.height = 5;

      this.outputBox.hidden = true;
      this.divider.hidden = true;
    } else {
      this.logoBox.top = 0;
      this.logoBox.left = 'center';
      this.logoBox.width = '100%';
      this.logoBox.height = '25%';

      this.divider.top = '25%';
      this.divider.left = 'center';
      this.divider.width = '80%';
      this.divider.hidden = false;

      this.outputBox.top = '27%';
      this.outputBox.left = 'center';
      this.outputBox.width = '90%';
      this.outputBox.height = '46%';
      this.outputBox.hidden = false;

      this.inputContainer.top = '74%';
      this.inputContainer.left = 'center';
      this.inputContainer.width = '90%';
      this.inputContainer.height = 5;
    }
    this.screen.render();
  }

  getBlessedUIAdapter(): IUIAdapter {
    return this.blessedAdapter;
  }

  setProviderInfo(provider: string, providers: string[]): void {
    this.opts.provider = provider;
    this.opts.providers = providers;
    this.logoBox.setContent(this.buildLogoContent());
    this.currentProvider = provider || 'unknown';
    this.renderInputMeta();
    this.screen.render();
  }

  attachRuntime(runtime: {
    controller: AgentController;
    engine: LLMEngine;
    commands: SlashCommandDef[];
    telemetry: TelemetryMonitor;
  }): void {
    this.opts.controller = runtime.controller;
    this.opts.engine = runtime.engine;
    this.opts.commands = runtime.commands;
    this.opts.telemetry = runtime.telemetry;
    this.opts.ui = this.blessedAdapter;
    this.popup.setCommands(this.opts.commands);
    this.syncIdentityFromController();
  }

  private syncIdentityFromController(): void {
    if (!this.opts.controller) return;
    const provider = this.opts.controller.getProviderName() || 'unknown';
    const model = this.opts.controller.getModelName() || 'unknown';
    this.currentProvider = provider;
    this.currentModel = model;
    this.renderInputMeta();
  }

  private renderInputMeta(): void {
    const raw = `Model: ${this.currentProvider || 'unknown'}/${this.currentModel || 'unknown'}`;
    const maxWidth = Math.max(16, Number((this.inputContainer as any).width) - 6 || 60);
    const text = raw.length > maxWidth ? raw.slice(0, Math.max(1, maxWidth - 3)) + '...' : raw;
    this.metaLine.setContent(`{gray-fg}${text}{/}`);
  }

  private buildLogoContent(): string {
    const version = getCliVersion();
    const provider = this.opts.provider || 'unknown';
    const isBuiltIn = provider.includes('内置免费');
    const providerColor = isBuiltIn ? 'green' : 'cyan';
    const providersText = this.opts.providers && this.opts.providers.length > 0 ? this.opts.providers.join(', ') : 'N/A';

    return [
      '',
      ASCII_LOGO.join('\n'),
      '',
      `{bold}v${version}{/bold}`,
      '',
      `{${providerColor}-fg}Provider:{/} ${provider} (可用: ${providersText})`,
      '',
      '{gray-fg}Shortcuts: Ctrl+C interrupt/exit, Ctrl+L clear, q exit{/}',
    ].join('\n');
  }

  private setupKeyEvents(): void {
    this.inputText.on('keypress', () => {
      setImmediate(() => {
        if (this.interactivePromptActive || this.selectModalActive) return;
        this.popup.update(this.inputText.getValue());
      });
    });

    this.inputText.on('change', (value: string) => {
      if (this.interactivePromptActive || this.selectModalActive) return;
      this.popup.update(value);
    });

    this.inputText.on('submit', async (value: string) => {
      if (this.interactivePromptActive || this.selectModalActive) return;

      const cmd = value.trim().replace(/^\/\/+/, '/');
      if (cmd) {
        await this.handleCommand(cmd);
      }
      this.inputText.setValue('');
      this.popup.hide();
    });

    this.inputText.key('tab', () => {
      if (this.selectModalActive || this.interactivePromptActive) return false;

      if (this.popup.isVisible()) {
        const selection = this.popup.getCurrentSelection();
        if (selection) {
          this.inputText.setValue(selection + ' ');
          this.popup.hide();
          this.screen.render();
        }
      } else {
        this.popup.showAll();
      }
      return false;
    });

    this.inputText.key(['up', 'down'], (_ch: any, key: any) => {
      if (this.selectModalActive || this.interactivePromptActive) return false;
      if (!this.popup.isVisible()) return;
      if (key.name === 'up') this.popup.selectPrev();
      if (key.name === 'down') this.popup.selectNext();
      return false;
    });

    this.inputText.key('escape', () => {
      if (this.selectModalActive) return false;
      if (this.popup.isVisible()) {
        this.popup.hide();
        return false;
      }
    });

    this.inputText.key('enter', () => {
      if (this.selectModalActive || this.interactivePromptActive) return false;
      if (this.popup.isVisible()) {
        const selection = this.popup.getCurrentSelection();
        if (selection) {
          this.inputText.setValue(selection + ' ');
          this.popup.hide();
          this.screen.render();
          return false;
        }
      }
    });

    this.inputText.key(['C-c'], () => {
      if (this.selectModalActive && this.selectModalCleanup) {
        this.selectModalCleanup();
        return false;
      }

      if (this.currentAbort) {
        this.currentAbort.abort();
        this.currentAbort = null;
      } else if (this.processing) {
        this.appendOutput('{yellow-fg}[Interrupted]{/}');
        this.processing = false;
        this.inputText.focus();
      } else {
        this.opts.onExit?.();
        process.exit(0);
      }
      return false;
    });

    const exitHandler = () => {
      if (this.selectModalActive && this.selectModalCleanup) {
        this.selectModalCleanup();
        return;
      }
      this.opts.onExit?.();
      process.exit(0);
    };

    this.inputText.key(['C-d'], exitHandler);
    this.screen.key(['C-d'], exitHandler);

    this.inputText.key('q', () => {
      if (this.selectModalActive && this.selectModalCleanup) {
        this.selectModalCleanup();
        return false;
      }
      this.opts.onExit?.();
      process.exit(0);
      return false;
    });

    this.inputText.key(['C-l'], () => {
      if (this.selectModalActive || this.interactivePromptActive) return false;
      this.outputBox.setContent('');
      this.screen.render();
      return false;
    });

    this.screen.on('resize', () => {
      this.renderInputMeta();
      this.screen.render();
    });
  }

  private async handleCommand(cmd: string) {
    if (this.processing) return;
    if (!this.opts.controller || !this.opts.engine || !this.opts.commands || !this.opts.telemetry || !this.opts.ui) {
      this.appendOutput(chalk.red('CLI runtime is not ready.'));
      return;
    }

    this.processing = true;
    this.inputText.clearValue();
    this.appendOutput(`{cyan-fg}❯{/} ${cmd}`);
    this.screen.render();

    try {
      if (!cmd.startsWith('/') && this.isWelcomeMode) {
        this.isWelcomeMode = false;
        this.updateLayout();
      }

      if (cmd.startsWith('/')) {
        await this.handleSlashCommand(cmd);
      } else {
        await this.handleUserPrompt(cmd);
      }
    } catch (err: any) {
      this.appendOutput(chalk.red(`Error: ${err.message}`));
    } finally {
      this.processing = false;
      this.inputText.focus();
      this.screen.render();
    }
  }

  private async handleSlashCommand(line: string) {
    const selectedHint = this.popup.getCurrentSelection();
    const bestName = getBestMatch(line, this.opts.commands!, selectedHint);
    const parsed = parseSlash(line);
    const argsStr = parsed?.args.length ? ' ' + parsed.args.join(' ') : '';
    const expandedLine = bestName + argsStr;

    if (expandedLine !== line) {
      this.appendOutput(chalk.dim(`-> ${expandedLine}`));
    }

    await dispatchSlash(
      {
        controller: this.opts.controller!,
        engine: this.opts.engine!,
        ui: this.opts.ui!,
        bubbles: { reset: () => {} },
        hud: {
          render: () => {},
          setProvider: (_p: string) => {},
        },
        onCommandHints: (hints: { name: string; description: string }[]) => {
          if (!this.selectModalActive && !this.interactivePromptActive) {
            this.popup.setHints(hints);
          }
        },
        onMoveSelection: (delta: number) => {
          if (!this.selectModalActive && !this.interactivePromptActive) {
            this.popup.moveSelection(delta);
          }
        },
        hasHints: () => this.popup.isVisible(),
        commands: this.opts.commands!,
        telemetry: this.opts.telemetry!,
        print: (m: string) => this.appendOutput(m),
        clearScreen: (showWelcome?: boolean) => {
          this.outputBox.setContent('');
          if (showWelcome) {
            this.isWelcomeMode = true;
          }
          this.syncIdentityFromController();
          this.updateLayout();
        },
        info: (m: string) => this.appendOutput(chalk.blue(m)),
        error: (m: string) => this.appendOutput(chalk.red(m)),
        handleUserPrompt: (p: string) => this.handleUserPrompt(p),
      },
      expandedLine,
      this.opts.commands!,
      selectedHint
    );

    this.syncIdentityFromController();
    this.inputText.setValue('');
    this.screen.render();
  }

  private async handleUserPrompt(prompt: string) {
    if (!this.opts.controller) return;
    this.currentAbort = new AbortController();
    this.appendOutput(chalk.dim('Thinking...'));
    this.outputBox.setScrollPerc(100);
    this.screen.render();

    try {
      await this.opts.controller.askStream(prompt, { signal: this.currentAbort.signal });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.appendOutput(chalk.yellow('[Interrupted]'));
      } else {
        this.appendOutput(chalk.red(`Error: ${err.message}`));
      }
    } finally {
      this.currentAbort = null;
      this.appendOutput('');
    }
  }

  appendOutput(text: string) {
    const currentContent = this.outputBox.content || '';
    this.outputBox.setContent(currentContent + '\n' + text);
    this.outputBox.setScrollPerc(100);
    this.screen.render();
  }

  appendOutputToScreen(text: string) {
    const currentContent = this.outputBox.content || '';
    this.outputBox.setContent(currentContent + text);
    this.outputBox.setScrollPerc(100);
    this.screen.render();
  }

  private async withExclusiveInput<T>(
    question: string,
    collector: (value: string, resolve: (v: T) => void, cleanup: () => void) => void
  ): Promise<T> {
    return new Promise((resolve) => {
      const originalPrompt = this.inputText.getValue();
      this.interactivePromptActive = true;
      this.popup.hide();
      this.appendOutput(chalk.cyan(question));
      this.inputText.setValue('');
      this.inputText.focus();

      const cleanup = () => {
        this.inputText.off('submit', handler);
        this.inputText.setValue(originalPrompt);
        this.interactivePromptActive = false;
        this.inputText.focus();
      };

      const handler = (value: string) => collector(value, resolve, cleanup);
      this.inputText.on('submit', handler);
    });
  }

  async promptInput(question: string): Promise<string> {
    return this.withExclusiveInput<string>(question, (value, resolve, cleanup) => {
      cleanup();
      resolve(value);
    });
  }

  async promptConfirm(message: string): Promise<boolean> {
    const answer = await this.promptInput(`${message} (y/n): `);
    return answer.toLowerCase() === 'y';
  }

  private async showSelectModal(opts: {
    title: string;
    choices: string[];
    defaultValue?: string;
    maxHeight?: number;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      const maxHeight = opts.maxHeight || 10;
      const defaultIndex = Math.max(0, opts.defaultValue ? opts.choices.indexOf(opts.defaultValue) : 0);
      const listHeight = Math.min(Math.max(opts.choices.length + 2, 4), maxHeight);

      this.selectModalActive = true;
      this.popup.hide();

      const box = blessed.box({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: '70%',
        height: listHeight + 3,
        border: 'line',
        tags: true,
        label: ` ${opts.title} `,
        style: {
          fg: 'white',
          bg: 'black',
          border: { fg: 'gray' },
        },
      });

      const list = blessed.list({
        parent: box,
        top: 1,
        left: 1,
        width: '100%-2',
        height: '100%-2',
        items: opts.choices,
        keys: false,
        mouse: true,
        style: {
          fg: 'white',
          bg: 'black',
          selected: {
            fg: 'black',
            bg: 'cyan',
            bold: true,
          },
        },
      });

      if (defaultIndex >= 0) {
        list.select(defaultIndex);
      }

      const cleanup = (result: string | null) => {
        for (const k of ['up', 'down', 'enter', 'escape', 'q', 'C-c']) {
          this.screen.unkey(k, keyHandler);
        }
        box.destroy();
        this.selectModalActive = false;
        this.selectModalCleanup = undefined;
        this.screen.render();
        resolve(result);
      };

      const keyHandler = (_ch: any, key: any) => {
        if (!this.selectModalActive) return;

        if (key.name === 'up') {
          list.up(1);
          this.screen.render();
          return;
        }
        if (key.name === 'down') {
          list.down(1);
          this.screen.render();
          return;
        }
        if (key.name === 'enter') {
          const i = (list as any).selected ?? 0;
          const picked = opts.choices[i] ?? null;
          cleanup(picked);
          return;
        }
        if (key.name === 'escape' || key.name === 'q' || (key.ctrl && key.name === 'c')) {
          cleanup(null);
        }
      };

      this.selectModalCleanup = () => cleanup(null);
      this.screen.key(['up', 'down', 'enter', 'escape', 'q', 'C-c'], keyHandler);
      this.screen.render();
    });
  }

  async promptSelect(message: string, choices: string[], defaultValue?: string): Promise<string> {
    if (choices.length === 0) return defaultValue || '';
    const modalOpts: { title: string; choices: string[]; defaultValue?: string; maxHeight?: number } = {
      title: message,
      choices,
      maxHeight: 12,
    };
    if (defaultValue !== undefined) modalOpts.defaultValue = defaultValue;
    const picked = await this.showSelectModal(modalOpts);

    if (picked) return picked;
    if (defaultValue && choices.includes(defaultValue)) return defaultValue;
    return choices[0]!;
  }

  async promptSelectMany(message: string, choices: string[], defaults?: string[]): Promise<string[]> {
    this.appendOutput(message);
    this.appendOutput(choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n'));
    const answer = await this.promptInput('Enter choice numbers (comma-separated): ');
    const picked = answer
      .split(',')
      .map(s => parseInt(s.trim(), 10) - 1)
      .filter(i => !Number.isNaN(i) && i >= 0 && i < choices.length)
      .map(i => choices[i]!);
    if (picked.length > 0) return picked;
    return defaults || [];
  }

  async promptEditor(message: string, initial?: string): Promise<string> {
    this.appendOutput(message);
    this.appendOutput('(Enter EOF on its own line to finish)');
    const lines: string[] = initial ? [initial] : [];

    return this.withExclusiveInput<string>('editor>', (value, resolve, cleanup) => {
      if (value === 'EOF') {
        cleanup();
        resolve(lines.join('\n'));
        return;
      }
      lines.push(value);
      this.inputText.setValue('');
      this.inputText.focus();
    });
  }

  start(): void {
    try {
      this.inputText.focus();
      this.screen.render();
    } catch (err: any) {
      console.error('InputManager start error:', err);
    }
  }

  destroy(): void {
    this.screen.destroy();
  }
}

