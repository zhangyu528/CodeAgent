import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { logger, TelemetryMonitor } from '../../utils/logger';
import { TerminalManager } from './components/terminal_manager';
import { createAgent } from './components/factory';
import { getDefaultSlashCommands } from './components/slash_commands';
import { REPL } from './components/repl';
import { attachKeybindings } from './components/keybindings';
import { buildCompleter } from './components/readline_completer';
import { TTY_UIAdapter } from './adapter';

// 1. Initial Setup
dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

export async function bootstrap() {
  // 2. Initialize UI Components
  const terminal = new TerminalManager();
  await terminal.init();

  // 3. Create IUIAdapter for Core
  const uiAdapter = new TTY_UIAdapter({
    suspendInput: async (fn) => terminal.suspendInput(fn),
    onStatus: (status) => {
        if (status.type === 'think') {
            terminal.getHUD().setMode('THINKING');
            terminal.render();
        } else if (status.type === 'tool_start') {
            terminal.getBubbles().onToolStarted(status.name, status.input);
            terminal.render();
        } else if (status.type === 'tool_end') {
            terminal.getBubbles().onToolFinished(status.name, status.output);
            terminal.render();
        } else if (status.type === 'completion') {
            terminal.getHUD().setMode('STREAMING');
            terminal.render();
        } else if (status.type === 'final_answer') {
            terminal.getHUD().setMode('IDLE');
            terminal.updateStatus(null as any); // Refresh data
            terminal.render();
        }
    }
  });

  // 4. Initialize Core
  const { controller, engine } = await createAgent(uiAdapter);
  const commands = getDefaultSlashCommands();

  // 5. Initialize REPL
  const completer = buildCompleter({
    cwd: process.cwd(),
    slashCommands: commands.map(c => c.name),
    getModelProviders: () => engine.listProviders(),
  });

  const repl = new REPL(controller, engine, terminal, commands, telemetry, uiAdapter, {
    completer,
  });
  const { rl, refreshPrompt } = await repl.start();

  // 6. Wire Keybindings
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

  // 7. Final UI Touch
  terminal.showWelcome(engine.listProviders(), controller.getProviderName());
  terminal.updateStatus(controller, { render: false });
  refreshPrompt();
  rl.prompt();
  terminal.render();
}

if (require.main === module) {
    bootstrap().catch(err => {
        logger.error('Fatal error during bootstrap: ' + (err?.message || String(err)));
        process.exit(1);
    });
}
