import * as dotenv from 'dotenv';
import { logger, TelemetryMonitor } from './utils/logger';
import { TerminalManager } from './cli/terminal_manager';
import { createAgent } from './cli/factory';
import { getDefaultSlashCommands } from './cli/slash_commands';
import { REPL } from './cli/repl';
import { attachKeybindings } from './cli/keybindings';
import { buildCompleter } from './cli/readline_completer';

// 1. Initial Setup
dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

async function bootstrap() {
  // 2. Initialize UI & Factory
  const terminal = new TerminalManager();
  await terminal.init();

  const { controller, engine } = await createAgent(terminal.getUIAdapter());
  const commands = getDefaultSlashCommands();

  // 3. Initialize REPL
  const completer = buildCompleter({
    cwd: process.cwd(),
    slashCommands: commands.map(c => c.name),
    getModelProviders: () => engine.listProviders(),
  });

  const repl = new REPL(controller, engine, terminal, commands, telemetry, {
    completer,
  });
  const { rl, refreshPrompt, handleSlash } = await repl.start();

  // 4. Wire Keybindings
  const keybindings = attachKeybindings({
    rl,
    isTTY: Boolean(process.stdin.isTTY),
    getMode: () => terminal.getHUD().getMode() as any,
    isInputSuspended: () => terminal.isInputSuspended(),
    isCapturing: () => repl.isCapturing(),
    cancelCapture: () => {
      repl.cancelCapture();
      terminal.getHUD().setMode('IDLE');
      terminal.render();
      refreshPrompt();
      rl.prompt(true);
    },
    abortCurrent: () => repl.abortCurrent(),
    onClearScreen: () => {
      console.clear();
      terminal.render();
      rl.prompt(true);
    },
    onExit: () => {
      logger.info('Goodbye!');
      keybindings.detach();
      process.exit(0);
    },
    onHint: (text) => logger.info(text),
    onSlash: () => {
      terminal.suspendInput(async () => {
        const { select } = require('@inquirer/prompts');
        const choices = commands.map(c => ({
          name: `${require('chalk').yellow(c.name.padEnd(10))} ${require('chalk').dim(c.description)}`,
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
            // If it's just a command with no params needed, we might want to execute it.
            // But for now, just write it to rl as requested.
            rl?.write(selected);
          }
        } catch {
          // User cancelled
        }
      });
    }
  });

  // 5. Final UI Touch
  terminal.showWelcome(engine.listProviders(), controller.getProviderName());
  terminal.updateStatus(controller, telemetry);
  rl.prompt();
}

bootstrap().catch(err => {
  logger.error('Fatal error during bootstrap: ' + (err?.message || String(err)));
  process.exit(1);
});
