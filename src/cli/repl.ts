import * as readline from 'readline';
import { AgentController } from '../controller/agent_controller';
import { TerminalManager } from './terminal_manager';
import { SlashCommandDef, dispatchSlash, parseSlash, getBestMatch } from './slash_commands';
import { logger, TelemetryMonitor } from '../utils/logger';
import { LLMEngine } from '../llm/engine';

export class REPL {
  private capturing = false;
  private captureLines: string[] = [];
  private processing = false;
  private currentAbort: AbortController | null = null;

  constructor(
    private controller: AgentController,
    private engine: LLMEngine,
    private terminal: TerminalManager,
    private commands: SlashCommandDef[],
    private telemetry: TelemetryMonitor,
    private opts?: {
      completer?: (line: string, callback: (err: any, result: [string[], string]) => void) => void;
      onSlash?: (rl: readline.Interface) => void;
    }
  ) {}

  private getPromptString(): string {
    const rlAny = (this as any).rl || (this.terminal as any).rl;
    if (rlAny?._prompt) return rlAny._prompt;
    return require('chalk').cyan.bold('❯ ');
  }

  async start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: this.opts?.completer,
    });

    this.terminal.setReadline(rl);

    const refreshInputArea = () => {
      const mode = this.terminal.getHUD().getMode();
      
      if (mode === 'CAPTURE') {
        rl.setPrompt(require('chalk').dim('  │ '));
      } else {
        rl.setPrompt(require('chalk').cyan.bold('❯ '));
      }
    };

    const handleSlash = async (line: string) => {
      return await dispatchSlash(
        {
          controller: this.controller,
          engine: this.engine,
          ui: this.terminal.getUIAdapter(),
          bubbles: this.terminal.getBubbles(),
          hud: this.terminal.getHUD(),
          onCommandHints: (hints: { name: string; description: string }[]) => this.terminal.setCommandHints(hints),
          onMoveSelection: (delta: number) => this.terminal.moveHintSelection(delta),
          hasHints: () => this.terminal.hasHints(),
          commands: this.commands,
          terminal: this.terminal,
          telemetry: this.telemetry,
          print: (m: string) => console.log(m),
          clearScreen: (showWelcome?: boolean) => {
             process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // Deep clear + scrollback + cursor to top
             if (showWelcome) {
               this.terminal.showWelcome(this.engine.listProviders(), this.controller.getProviderName());
             }
             this.terminal.render();
          },
          info: (m: string) => logger.info(m),
          error: (m: string) => logger.error(m),
          handleUserPrompt: (p: string) => this.handleUserPrompt(p, rl, refreshInputArea),
        },
        line,
        this.commands,
        this.terminal.getSelectedHint()
      );
    };

    rl.on('line', async (line) => {
      if (this.processing || this.terminal.isInputSuspended()) return;

      const trimmed = line.trim();

      // 1. Capture Logic
      if (trimmed === '<<EOF') {
        this.capturing = true;
        this.terminal.getHUD().setMode('CAPTURE');
        this.terminal.render();
        refreshInputArea();
        rl.prompt();
        return;
      }

      if (this.capturing) {
        if (trimmed === 'EOF') {
          this.capturing = false;
          const fullPrompt = this.captureLines.join('\n');
          this.captureLines.length = 0;
          this.terminal.getHUD().setMode('IDLE');
          this.terminal.render();
          if (fullPrompt.trim()) {
            await this.handleUserPrompt(fullPrompt, rl, refreshInputArea);
          } else {
            refreshInputArea();
            rl.prompt();
          }
        } else {
          this.captureLines.push(line);
          refreshInputArea();
          rl.prompt();
          this.terminal.render();
        }
        return;
      }

      const executeCommand = async (action: () => Promise<void>) => {
        this.processing = true;
        this.terminal.setExclusiveMode(true);
        this.terminal.clearAllFooters({ stayDown: true });
        try {
          await action();
        } finally {
          this.terminal.setExclusiveMode(false);
          this.processing = false;
          refreshInputArea();
          rl.prompt();
          this.terminal.render(); // Restore visibility after prompt is stable
        }
      };

      // 2. Slash Commands
      if (trimmed.startsWith('/')) {
        // Resolve expansion
        const selectedHint = this.terminal.getSelectedHint();
        const bestName = getBestMatch(line, this.commands, selectedHint);
        const parsed = parseSlash(line);
        const argsStr = parsed?.args.length ? ' ' + parsed.args.join(' ') : '';
        const expandedLine = bestName + argsStr;

        const rlAny = rl as any;
        const prompt = rlAny._prompt || this.getPromptString();
        
        // CRITICAL: After Enter, cursor is on the line BELOW the prompt.
        // Move back to prompt line to stabilize state for renderer.
        process.stdout.write('\x1b[1F'); 

        if (expandedLine !== line) {
          process.stdout.write('\x1b[2K'); // Clear prompt line
          process.stdout.write(prompt + expandedLine); // Rewrite it with prompt included
          rlAny.line = expandedLine;
          rlAny.cursor = expandedLine.length;
          
          const history = rlAny.history || [];
          if (history.length > 0 && history[0] === line) {
            history[0] = expandedLine;
          }
        } else {
          // Just move cursor to the end of the line to match internal state
          const visualFullLine = prompt + line;
          const termWidth = process.stdout.columns || 80;
          readline.cursorTo(process.stdout, visualFullLine.length % termWidth);
          rlAny.cursor = line.length;
        }

        await executeCommand(async () => {
          const handled = await handleSlash(expandedLine);
          if (handled) {
            // Clear the line buffer so it doesn't leak into the next prompt
            rlAny.line = '';
            rlAny.cursor = 0;
            // Note: executeCommand's finally will handle prompt and render
          }
        });
        return;
      }

      // 3. Normal Prompt
      if (trimmed) {
        await executeCommand(async () => {
          await this.handleUserPrompt(line, rl, refreshInputArea);
        });
      } else {
        // Surgical Overwrite for empty Enter: Move up 1 line and clear it
        process.stdout.write('\x1b[1F\x1b[2K');
        refreshInputArea();
        rl.prompt();
        this.terminal.render();
      }
    });

    return { rl, refreshPrompt: refreshInputArea, handleSlash };
  }

  private async handleUserPrompt(prompt: string, rl: readline.Interface, refreshPrompt: () => void) {
    this.processing = true;
    this.currentAbort = new AbortController();
    this.terminal.getHUD().setMode('THINKING');
    this.terminal.render();

    try {
      let fullResponse = '';
      await this.controller.askStream(
        prompt,
        (chunk) => {
          if (this.terminal.getHUD().getMode() !== 'STREAMING') {
            this.terminal.getHUD().setMode('STREAMING');
            this.terminal.render();
          }
          fullResponse += chunk;
          process.stdout.write(chunk);
        },
        { signal: this.currentAbort.signal },
      );

      this.terminal.renderFormattedOutput(fullResponse);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('\n[Interrupted]');
      } else {
        logger.error('Error: ' + err.message);
      }
    } finally {
      this.currentAbort = null;
      this.terminal.getHUD().setMode('IDLE');
      this.terminal.updateStatus(this.controller);
      refreshPrompt();
      rl.prompt();
      this.terminal.render();
    }
  }

  async showSlashMenu(rl: readline.Interface) {
    await this.terminal.suspendInput(async () => {
      const { select, Separator } = require('@inquirer/prompts');
      const chalk = require('chalk');

      // Group commands by category
      const categories: Record<string, SlashCommandDef[]> = {};
      for (const cmd of this.commands) {
        if (!categories[cmd.category]) categories[cmd.category] = [];
        categories[cmd.category]!.push(cmd);
      }

      const choices: any[] = [];
      const order: Array<SlashCommandDef['category']> = ['Session', 'Model', 'Tools', 'General'];

      for (const cat of order) {
        if (categories[cat] && categories[cat]!.length > 0) {
          choices.push(new Separator(chalk.dim(`--- ${cat} ---`)));
          for (const cmd of categories[cat]!) {
            choices.push({
              name: chalk.yellow(cmd.name.padEnd(12)) + chalk.dim(cmd.description),
              value: cmd.name,
              description: chalk.cyan(`Usage: `) + chalk.white(cmd.usage) + `\n` + chalk.dim(cmd.description),
            });
          }
        }
      }

      try {
        const selected = await select({
          message: '选择命令:',
          choices,
          pageSize: 12,
        });

        if (selected) {
          // Clear current line if it contains '/'
          if ((rl as any).line === '/') {
            readline.moveCursor(process.stdout, -1, 0);
            readline.clearLine(process.stdout, 1);
            (rl as any).line = '';
            (rl as any).cursor = 0;
          }
          rl.write(selected);
        }
      } catch {
        // User cancelled
      }
    });
  }

  isCapturing() { return this.capturing; }
  cancelCapture() {
    this.capturing = false;
    this.captureLines.length = 0;
  }
  abortCurrent() {
    if (this.currentAbort) {
      this.currentAbort.abort();
      return true;
    }
    return false;
  }
}
