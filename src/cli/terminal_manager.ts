import * as readline from 'readline';
import * as path from 'path';
import chalk = require('chalk');
import { HUD } from './hud';
import { ToolBubbles } from './tool_bubbles';
import { StableFooterRenderer } from './stable_footer_renderer';
import { SlashHintManager } from './slash_hint_manager';
import { TelemetryMonitor } from '../utils/logger';
import { AgentController } from '../controller/agent_controller';
import { getCliVersion, renderWelcomeCard } from './welcome_card';
import { DefaultUIAdapter } from './default_ui_adapter';

function envEnabled(name: string, defaultOn: boolean) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return defaultOn;
  if (raw === '0' || raw.toLowerCase() === 'false' || raw.toLowerCase() === 'off') return false;
  if (raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'on') return true;
  return defaultOn;
}

export class TerminalManager {
  private hud: HUD;
  private bubbles: ToolBubbles;
  private footer: StableFooterRenderer;
  private hints: SlashHintManager;
  private uiAdapter: DefaultUIAdapter;
  private rl: readline.Interface | null = null;
  private inputSuspended = false;

  constructor() {
    this.hud = new HUD();
    const bubblesEnabled = Boolean(process.stdout.isTTY) && envEnabled('TOOL_BUBBLES', true);
    this.bubbles = new ToolBubbles({ maxItems: 8, enabled: bubblesEnabled });
    this.footer = new StableFooterRenderer();
    this.hints = new SlashHintManager();
    
    this.uiAdapter = new DefaultUIAdapter({
      suspendInput: async (fn) => this.suspendInput(fn),
    });
  }

  async init(): Promise<void> {
    await this.hud.init();
    
    // Auto-adjust on resize
    process.stdout.on('resize', () => {
      if (this.hud.isEnabled()) {
        this.render();
      }
    });
  }

  setReadline(rl: readline.Interface) {
    this.rl = rl;
  }

  toggleHUD() {
    const next = !this.hud.isEnabled();
    this.hud.setEnabled(next);
    if (!next) {
      this.hud.clear();
    } else {
      this.render();
    }
  }

  getUIAdapter(): DefaultUIAdapter {
    return this.uiAdapter;
  }

  getHUD(): HUD {
    return this.hud;
  }

  getBubbles(): ToolBubbles {
    return this.bubbles;
  }

  isInputSuspended(): boolean {
    return this.inputSuspended;
  }

  async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
    this.inputSuspended = true;
    const prevMode = this.hud.getMode();
    this.hud.setMode('CONFIRM');
    this.render();

    try {
      this.rl?.pause();
    } catch { /* ignore */ }
    
    if (process.stdin.isTTY) {
      try { (process.stdin as any).setRawMode?.(false); } catch { /* ignore */ }
    }

    try {
      return await fn();
    } finally {
      if (process.stdin.isTTY) {
        try { (process.stdin as any).setRawMode?.(true); } catch { /* ignore */ }
      }
      try { this.rl?.resume(); } catch { /* ignore */ }
      
      this.inputSuspended = false;
      this.hud.setMode(prevMode);
      this.render();
      try { this.rl?.prompt(true); } catch { /* ignore */ }
    }
  }

  setCommandHints(hints: { name: string; description: string }[]) {
    this.hints.setHints(hints);
    this.render();
  }

  render() {
    if (!this.rl) return;

    // Collect all footer lines
    const hintLines = this.hints.getLines();
    
    // Sync bubbles and tool labels to HUD
    this.hud.setBubbleLines(this.bubbles.getLines());
    this.hud.setLastTool(this.bubbles.getLastLabel());
    const hudLines = this.hud.getLines({ includeBubbles: true });

    // Render EVERYTHING below the prompt in one stable surgical move
    this.footer.render(this.rl, hintLines, hudLines);
  }

  showWelcome(providers: string[], currentProvider: string) {
    console.log(
      renderWelcomeCard({
        version: getCliVersion(),
        provider: currentProvider,
        providers,
      }),
    );
  }

  updateStatus(controller: AgentController, telemetry: TelemetryMonitor) {
    this.hints.clear();
    this.hud.setProvider(controller.getProviderName());
    this.hud.setModel(controller.getModelName());
    this.hud.setContextTokens(controller.getMemoryUsage());
    this.hud.setTelemetry(telemetry.getSummary() as any);
    this.render();
  }

  renderFormattedOutput(fullResponse: string) {
    try {
      const marked = require('marked');
      const TerminalRenderer = require('marked-terminal');
      marked.setOptions({ renderer: new TerminalRenderer() });
      console.log('\n\n' + chalk.dim('--- Formatted Output ---'));
      console.log(marked.parse(fullResponse));
    } catch {
      console.log();
    }
  }

  printSeparator() {
    const width = process.stdout.columns || 80;
    console.log('\n' + chalk.dim('─'.repeat(width)));
  }

  renderInputHeader(modelName: string) {
    const cwd = path.basename(process.cwd());
    const mode = this.hud.getMode();
    
    const modelIcon = '🤖';
    const folderIcon = '📁';
    const helpIcon = '💡';
    const recIcon = '⏺️';

    let line = '';
    if (mode === 'CAPTURE') {
      line = chalk.dim(' ╭─ ') + 
             chalk.yellow(`${recIcon} 多行录制中`) + chalk.dim(' | ') +
             chalk.dim(`输入 ${chalk.bold('EOF')} 提交，${chalk.bold('Ctrl+C')} 取消`);
    } else {
      line = chalk.dim(' ╭─ ') + 
             chalk.cyan(`${modelIcon} ${modelName}`) + chalk.dim(' | ') +
             chalk.blue(`${folderIcon} ${cwd}`) + chalk.dim(' | ') +
             chalk.yellow(`${helpIcon} 输入 / 获取帮助`);
    }
    
    console.log(line);
  }
}
