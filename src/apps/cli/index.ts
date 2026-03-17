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
import { BlessedWelcome, isBlessedSupported } from './components/blessed_welcome';

// 1. Initial Setup
dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

export async function bootstrap() {
  // 检查是否支持blessed
  const useBlessed = isBlessedSupported();
  
  // 2. 初始化 Core
  const terminal = new TerminalManager();
  await terminal.init();

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
            terminal.updateStatus(null as any);
            terminal.render();
        }
    }
  });

  const { controller, engine } = await createAgent(uiAdapter);
  const commands = getDefaultSlashCommands();

  // 如果使用blessed，显示欢迎界面并等待用户输入
  let initialInput = '';
  if (useBlessed) {
    const blesseInstance = new BlessedWelcome();
    blesseInstance.render(
      {
        provider: controller.getProviderName(),
        providers: engine.listProviders(),
      },
      (input: string) => {
        initialInput = input;
      }
    );
    
    // 等待用户按下回车后启动REPL
    await new Promise<void>((resolve) => {
      const handler = (buffer: Buffer) => {
        blesseInstance.destroy();
        process.stdin.removeListener('data', handler);
        resolve();
      };
      process.stdin.on('data', handler);
    });
  }

  // 继续正常的REPL启动流程
  const completer = buildCompleter({
    cwd: process.cwd(),
    slashCommands: commands.map(c => c.name),
    getModelProviders: () => engine.listProviders(),
  });

  const repl = new REPL(controller, engine, terminal, commands, telemetry, uiAdapter, {
    completer,
  });
  const { rl, refreshPrompt } = await repl.start();

  // 如果用户已经在欢迎界面输入了命令，直接执行
  if (initialInput.trim()) {
    rl.emit('line', initialInput);
  }

  // blessed模式下跳过HUD显示，直接进入REPL
  if (useBlessed) {
    // 直接设置prompt，不渲染HUD
    refreshPrompt();
    rl.prompt();
    return;
  }

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

  if (!useBlessed) {
    terminal.showWelcome(engine.listProviders(), controller.getProviderName());
  }
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
