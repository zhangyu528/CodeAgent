import * as dotenv from 'dotenv';
import { logger, TelemetryMonitor } from '../../utils/logger';
import { TerminalManager } from './components/terminal_manager';
import { createAgent } from './components/factory';
import { getDefaultSlashCommands } from './components/slash_commands';
import { TTY_UIAdapter } from './adapter';
import { InputManager } from './components/input_manager';

// 1. Initial Setup
dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

export async function bootstrap() {
  try {
    // Blessed 支持检测逻辑（最简化版）
    // 只排除一种情况：TERM 环境变量明确设置为 "dumb"
    // 在其他所有情况下，都尝试使用 blessed
    const isDumb = process.env.TERM === 'dumb';
    
    // 检查是否强制启用 blessed（通过环境变量）
    const forceBlessed = process.env.FORCE_BLESSED === '1' || process.env.FORCE_BLESSED === 'true';
    
    // 简化的判断逻辑：只要不是 dumb 终端，就可以尝试使用 blessed
    // 或者用户强制启用
    const blessedSupported = !isDumb || forceBlessed;
    
    if (!blessedSupported) {
      console.error('Blessed is not supported in this terminal.');
      console.error('Requirement:');
      console.error('  - TERM environment variable must not be "dumb"');
      console.error('');
      console.error('Current status:');
      console.error(`  - TERM: ${process.env.TERM || 'not set'}`);
      console.error('');
      console.error('Solution:');
      console.error('  Set FORCE_BLESSED=1 to force enable blessed mode');
      process.exit(1);
    }
    
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
            terminal.render();
        }
      }
    });

    const { controller, engine } = await createAgent(uiAdapter);
    const commands = getDefaultSlashCommands();

    console.log('Creating InputManager...');

    // 3. 使用InputManager统一管理输入（纯Blessed模式）
    const inputManager = new InputManager({
      provider: controller.getProviderName(),
      providers: engine.listProviders(),
      onExit: () => {
        logger.info('Goodbye!');
        process.exit(0);
      },
      controller,
      engine,
      commands,
      telemetry,
      ui: uiAdapter,
      terminal,
    });

    console.log('Starting InputManager...');

    // 启动输入管理器（显示欢迎界面+输入框）
    inputManager.start();

    console.log('InputManager started successfully!');
    
    // 保持进程运行
    process.stdin.resume();
  } catch (err) {
    console.error('Bootstrap error:', err);
    throw err;
  }
}

if (require.main === module) {
    bootstrap().catch(err => {
        logger.error('Fatal error during bootstrap: ' + (err?.message || String(err)));
        process.exit(1);
    });
}
