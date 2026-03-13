import * as readline from 'readline';
import { AgentController } from '../controller/agent_controller';
import { TerminalManager } from './terminal_manager';
import { SlashCommandDef, dispatchSlash } from './slash_commands';
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
      this.terminal.printSeparator();
      this.terminal.renderInputHeader(this.controller.getModelName());
      
      if (mode === 'CAPTURE') {
        rl.setPrompt(require('chalk').dim(' │  '));
      } else {
        rl.setPrompt(require('chalk').dim(' ╰─> '));
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
          commands: this.commands,
          print: (m: string) => console.log(m),
          info: (m: string) => logger.info(m),
          error: (m: string) => logger.error(m),
          handleUserPrompt: (p: string) => this.handleUserPrompt(p, rl, refreshInputArea),
        },
        line,
        this.commands,
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
        }
        return;
      }

      // 2. Slash Commands
      if (trimmed.startsWith('/')) {
        const handled = await handleSlash(line);
        if (handled) {
          refreshInputArea();
          rl.prompt();
          return;
        }
      }

      // 3. Normal Prompt
      if (trimmed) {
        await this.handleUserPrompt(line, rl, refreshInputArea);
      } else {
        refreshInputArea();
        rl.prompt();
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
      this.processing = false;
      this.currentAbort = null;
      this.terminal.updateStatus(this.controller, this.telemetry);
      this.terminal.getHUD().setMode('IDLE');
      this.terminal.render();
      refreshPrompt();
      rl.prompt();
    }
  }

  async showSlashMenu(rl: readline.Interface) {
    await this.terminal.suspendInput(async () => {
      const { select } = require('@inquirer/prompts');
      const chalk = require('chalk');
      const choices = this.commands.map(c => ({
        name: `${chalk.yellow(c.name.padEnd(10))} ${chalk.dim(c.description)}`,
        value: c.name,
      }));

      try {
        const selected = await select({
          message: '选择命令:',
          choices,
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
