import blessed from 'blessed';
import { AgentController } from '../../../core/controller/agent_controller';
import { LLMEngine } from '../../../core/llm/engine';
import { SlashCommandDef, dispatchSlash, parseSlash, getBestMatch } from './slash_commands';
import { TelemetryMonitor } from '../../../utils/logger';
import { IUIAdapter } from '../../../core/interfaces/ui';
import { TerminalManager } from './terminal_manager';
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
  constructor(
    private inputManager: InputManager
  ) {}

  onThink(text: string): void {
    this.inputManager.appendOutput(chalk.dim('Thinking...'));
  }

  onStream(token: string): void {
    this.inputManager.appendOutputToScreen(token);
  }

  onToolStart(name: string, input: any): void {
    this.inputManager.appendOutput(chalk.yellow(`Running: ${name}`));
  }

  onToolEnd(name: string, output: any): void {
    // Tool end - already handled by onStream
  }

  onStatusUpdate(status: any): void {
    // Status updates
  }

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
    const answer = await this.inputManager.promptInput(question);
    return answer;
  }

  async confirm(message: string): Promise<boolean> {
    const answer = await this.inputManager.promptConfirm(message);
    return answer;
  }

  async selectOne(message: string, choices: string[], opts?: { default?: string }): Promise<string> {
    const answer = await this.inputManager.promptSelect(message, choices, opts?.default);
    return answer;
  }

  async selectMany(message: string, choices: string[], opts?: { defaults?: string[] }): Promise<string[]> {
    const answer = await this.inputManager.promptSelectMany(message, choices, opts?.defaults);
    return answer;
  }

  async openEditor(message: string, initial?: string): Promise<string> {
    const answer = await this.inputManager.promptEditor(message, initial);
    return answer;
  }

  async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export interface InputManagerOptions {
  provider: string;
  providers: string[];
  onExit?: () => void;
  controller: AgentController;
  engine: LLMEngine;
  commands: SlashCommandDef[];
  telemetry: TelemetryMonitor;
  ui: IUIAdapter;
  terminal: TerminalManager;
}

const ASCII_LOGO = [
  "  ___            _        _                    _  ",
  " / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ",
  "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
  " \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|",
  "                           |___/                  ",
];

export class InputManager {
  private screen: ReturnType<typeof blessed.screen>;
  private logoBox: ReturnType<typeof blessed.box>;
  private outputBox: ReturnType<typeof blessed.box>;
  private inputLine: ReturnType<typeof blessed.box>;
  private inputContainer: ReturnType<typeof blessed.box>;
  private inputText: ReturnType<typeof blessed.textbox>;
  private divider: ReturnType<typeof blessed.line>;
  private opts: InputManagerOptions;
  private currentInput = '';
  private processing = false;
  private currentAbort: AbortController | null = null;
  private isWelcomeMode = true;

  constructor(opts: InputManagerOptions) {
    this.opts = opts;
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'CodeAgent CLI',
      terminal: 'xterm-256color',
      fullUnicode: true,
      dockBorders: true,
    });

    // Logo区域
    this.logoBox = blessed.box({
      content: this.buildLogoContent(),
      tags: true,
      align: 'center',
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // 分隔线
    this.divider = blessed.line({
      orientation: 'horizontal',
      style: {
        fg: 'gray',
        bg: 'black',
      },
    });

    // 输出区域
    this.outputBox = blessed.box({
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // 输入区域容器
    this.inputContainer = blessed.box({
      height: 5,
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan',
        },
      },
    });

    // 输入提示符
    const prompt = blessed.box({
      top: 0,
      left: 0,
      width: 2,
      content: '{cyan-fg}❯{/}',
      tags: true,
      style: {
        fg: 'cyan',
        bg: 'black',
      },
    });

    // 输入框
    this.inputText = blessed.textbox({
      top: 0,
      left: 2,
      width: '100%-2',
      height: 1,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          fg: 'cyan',
          bg: 'black',
        },
      },
      inputOnFocus: true,
    });

    // 组合输入行
    this.inputLine = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
    });

    this.inputLine.append(prompt);
    this.inputLine.append(this.inputText);
    this.inputContainer.append(this.inputLine);

    this.screen.append(this.logoBox);
    this.screen.append(this.divider);
    this.screen.append(this.outputBox);
    this.screen.append(this.inputContainer);

    this.updateLayout();
    this.setupKeyEvents();
  }

  private updateLayout() {
    if (this.isWelcomeMode) {
      // Welcome Mode: Centered Layout
      this.logoBox.top = '15%';
      this.logoBox.left = 'center';
      this.logoBox.width = '100%';
      this.logoBox.height = 14; 
      this.logoBox.align = 'center';

      this.inputContainer.top = '55%'; 
      this.inputContainer.left = 'center';
      this.inputContainer.width = '80%';
      this.inputContainer.height = 3; // Reduced to 3 to be more compact

      this.outputBox.hidden = true;
      this.divider.hidden = true;
    } else {
      // Standard Mode: Full Screen Layout
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
      this.outputBox.height = '48%';
      this.outputBox.hidden = false;

      this.inputContainer.top = '78%';
      this.inputContainer.left = 'center';
      this.inputContainer.width = '90%';
      this.inputContainer.height = 5;
    }
    this.screen.render();
  }

  getBlessedUIAdapter(): IUIAdapter {
    return new BlessedUIAdapter(this);
  }

  private buildLogoContent(): string {
    const version = getCliVersion();
    const isBuiltIn = this.opts.provider.includes('内置免费');
    const providerColor = isBuiltIn ? 'green' : 'cyan';
    const providersText = this.opts.providers.length > 0 ? this.opts.providers.join(', ') : '无';
    
    const lines = [
      '',
      ASCII_LOGO.join('\n'),
      '',
      `{bold}v${version}{/bold}`,
      '',
      `{${providerColor}-fg}Provider:{/} ${this.opts.provider} (可用: ${providersText})`,
      '',
      `{gray-fg}快捷键: Ctrl+C=中断/退出, Ctrl+L=清屏, q=退出{/}`,
    ];
    return lines.join('\n');
  }

  private setupKeyEvents(): void {
    this.inputText.on('change', (value: string) => {
      this.currentInput = value;
    });

    this.inputText.on('submit', async (value: string) => {
      const cmd = value.trim();
      if (cmd) {
        if (this.isWelcomeMode) {
          this.isWelcomeMode = false;
          this.updateLayout();
        }
        await this.handleCommand(cmd);
      }
      this.inputText.setValue('');
      this.currentInput = '';
    });

    this.inputText.key('tab', () => {
      // TODO: 显示可用命令列表
    });

    // 使用 inputText 的 key 方法，因为它有焦点
    this.inputText.key(['C-c'], (ch: any, key: any) => {
      console.log('Ctrl+C captured', key);
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
      return false; // 阻止默认行为
    });

    // Ctrl+D - 退出
    const exitHandler = () => {
      this.opts.onExit?.();
      process.exit(0);
    };

    this.inputText.key(['C-d'], exitHandler);
    this.screen.key(['C-d'], exitHandler); // Global handler

    // q - 退出
    this.inputText.key('q', (ch: any, key: any) => {
      console.log('q captured', key);
      this.opts.onExit?.();
      process.exit(0);
      return false;
    });

    // Ctrl+L - 清空输出区域
    this.inputText.key(['C-l'], (ch: any, key: any) => {
      console.log('Ctrl+L captured', key);
      this.outputBox.setContent('');
      this.screen.render();
      return false;
    });

    this.screen.on('resize', () => {
      this.screen.render();
    });
  }

  private async handleCommand(cmd: string) {
    if (this.processing) return;

    this.processing = true;
    this.inputText.clearValue();
    this.appendOutput(`{cyan-fg}❯{/} ${cmd}`);
    this.screen.render();

    try {
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
    const selectedHint: any = null;
    const bestName = getBestMatch(line, this.opts.commands, selectedHint);
    const parsed = parseSlash(line);
    const argsStr = parsed?.args.length ? ' ' + parsed.args.join(' ') : '';
    const expandedLine = bestName + argsStr;

    if (expandedLine !== line) {
      this.appendOutput(chalk.dim(`→ ${expandedLine}`));
    }

    const handled = await dispatchSlash(
      {
        controller: this.opts.controller,
        engine: this.opts.engine,
        ui: this.opts.ui,
        bubbles: this.opts.terminal.getBubbles(),
        hud: this.opts.terminal.getHUD(),
        onCommandHints: (hints: { name: string; description: string }[]) => {
          // TODO: 显示命令提示
        },
        onMoveSelection: (delta: number) => {
          // TODO: 移动选择
        },
        hasHints: () => false,
        commands: this.opts.commands,
        terminal: this.opts.terminal,
        telemetry: this.opts.telemetry,
        print: (m: string) => console.log(m),
        clearScreen: (showWelcome?: boolean) => {
          this.outputBox.setContent('');
          this.screen.render();
        },
        info: (m: string) => this.appendOutput(chalk.blue(m)),
        error: (m: string) => this.appendOutput(chalk.red(m)),
        handleUserPrompt: (p: string) => this.handleUserPrompt(p),
      },
      expandedLine,
      selectedHint
    );

    if (!handled) {
      this.appendOutput(chalk.red(`Unknown command: ${line}`));
    }
  }

  private async handleUserPrompt(prompt: string) {
    this.currentAbort = new AbortController();
    this.appendOutput(chalk.dim('Thinking...'));
    this.outputBox.setScrollPerc(100);
    this.screen.render();

    const originalUI = this.opts.ui;
    const blessedAdapter = new BlessedUIAdapter(this);
    this.opts.controller.setUIAdapter(blessedAdapter);

    try {
      await this.opts.controller.askStream(
        prompt,
        { signal: this.currentAbort.signal },
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.appendOutput(chalk.yellow('[Interrupted]'));
      } else {
        this.appendOutput(chalk.red(`Error: ${err.message}`));
      }
    } finally {
      this.opts.controller.setUIAdapter(originalUI);
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

  async promptInput(question: string): Promise<string> {
    return new Promise((resolve) => {
      const originalPrompt = this.inputText.getValue();
      this.inputText.setValue('');
      this.inputText.focus();
      
      const handler = (value: string) => {
        this.inputText.off('submit', handler);
        this.inputText.setValue(originalPrompt);
        this.inputText.focus();
        resolve(value);
      };
      
      this.inputText.on('submit', handler);
    });
  }

  async promptConfirm(message: string): Promise<boolean> {
    const answer = await this.promptInput(`${message} (y/n): `);
    return answer.toLowerCase() === 'y';
  }

  async promptSelect(message: string, choices: string[], defaultValue?: string): Promise<string> {
    // 简化实现，直接输入选择
    this.appendOutput(message);
    this.appendOutput(choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n'));
    return await this.promptInput('Enter choice number: ');
  }

  async promptSelectMany(message: string, choices: string[], defaults?: string[]): Promise<string[]> {
    // 简化实现
    this.appendOutput(message);
    this.appendOutput(choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n'));
    const answer = await this.promptInput('Enter choice numbers (comma-separated): ');
    return answer.split(',').map(s => choices[parseInt(s.trim()) - 1]!);
  }

  async promptEditor(message: string, initial?: string): Promise<string> {
    // 简化实现，使用多行输入
    this.appendOutput(message);
    this.appendOutput('(Enter EOF on its own line to finish)');
    let lines: string[] = [];
    let capturing = true;
    
    return new Promise((resolve) => {
      const handler = (value: string) => {
        if (value === 'EOF') {
          capturing = false;
          this.inputText.off('submit', handler);
          resolve(lines.join('\n'));
        } else {
          lines.push(value);
        }
      };
      
      this.inputText.on('submit', handler);
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
