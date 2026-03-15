import * as dotenv from 'dotenv';
import * as readline from 'readline';
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
  const { rl, refreshPrompt } = await repl.start();

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
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      terminal.showWelcome(engine.listProviders(), controller.getProviderName());
      terminal.render();
      rl.prompt(true);
    },
    onExit: () => {
      logger.info('Goodbye!');
      keybindings.detach();
      process.exit(0);
    },
    onHint: (text) => logger.info(text),
    onToggleHUD: () => terminal.toggleHUD(),
    onCommandHints: (hints) => terminal.setCommandHints(hints),
    onMoveSelection: (delta) => terminal.moveHintSelection(delta),
    hasHints: () => terminal.hasHints(),
    slashCommands: commands.map(c => ({ name: c.name, description: c.description })),
    onSlash: () => {
      repl.showSlashMenu(rl).catch(err => {
        logger.error('Slash menu error: ' + err.message);
      });
    }
  });

  // 5. Final UI Touch
  terminal.showWelcome(engine.listProviders(), controller.getProviderName());
  // Prepare HUD data without rendering yet
  terminal.updateStatus(controller, { render: false });
  refreshPrompt();
  rl.prompt();
  // Ensure footer is visible immediately AFTER the prompt
  terminal.render();
}

bootstrap().catch(err => {
  logger.error('Fatal error during bootstrap: ' + (err?.message || String(err)));
  process.exit(1);
});
