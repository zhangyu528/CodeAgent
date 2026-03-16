import * as readline from 'readline';
import * as path from 'path';
import chalk = require('chalk');
import { HUD } from './hud';
import { ToolBubbles } from './tool_bubbles';
import { StableFooterRenderer } from './stable_footer_renderer';
import { SlashHintManager } from './slash_hint_manager';
import { TelemetryMonitor } from '../../../utils/logger';
import { AgentController } from '../../../core/controller/agent_controller';
import { getCliVersion, renderWelcomeCard } from './welcome_card';

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
  private rl: readline.Interface | null = null;
  private inputSuspended = false;
  private exclusiveMode: boolean = false;

  constructor() {
    this.hud = new HUD();
    const bubblesEnabled = Boolean(process.stdout.isTTY) && envEnabled('TOOL_BUBBLES', true);
    this.bubbles = new ToolBubbles({ maxItems: 8, enabled: bubblesEnabled });
    this.footer = new StableFooterRenderer();
    this.hints = new SlashHintManager();
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

  setExclusiveMode(on: boolean) {
    this.exclusiveMode = on;
  }

  clearAllFooters(opts?: { stayDown?: boolean }) {
    this.hints.clear();
    this.footer.clear(this.rl!, opts);
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

  getHUD(): HUD {
    return this.hud;
  }

  getBubbles(): ToolBubbles {
    return this.bubbles;
  }

  isInputSuspended(): boolean {
    return this.inputSuspended || this.exclusiveMode;
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

  moveHintSelection(delta: number) {
    this.hints.moveSelection(delta);
    this.render();
  }

  getSelectedHint(): string | null {
    return this.hints.getSelectedCommand()?.name || null;
  }

  hasHints(): boolean {
    return this.hints.getLines().length > 0;
  }

  render() {
    if (!this.rl || this.exclusiveMode) return;

    // Collect all footer lines in specific order:
    // 1. Hints (Closest to input)
    const hintLines = this.hints.getLines();
    
    // 2. Tool Bubbles (Process feedback)
    const bubbleLines = this.bubbles.getLines();
    
    // 3. Status Bar (Global state, always at bottom)
    const hudLines = this.hud.getLines();

    // Render EVERYTHING below the prompt in one stable surgical move
    const allLines = [...hintLines, ...bubbleLines, ...hudLines];
    this.footer.render(this.rl, [], allLines); // Pass all combined lines to footer renderer
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

  updateStatus(controller: AgentController, opts?: { render?: boolean }) {
    this.hints.clear();
    this.hud.setProvider(controller.getProviderName());
    this.hud.setModel(controller.getModelName());
    this.hud.setFolder(path.basename(process.cwd()));
    this.hud.setAuthPath(controller.getAuthorizedPath());
    
    if (opts?.render !== false) {
      this.render();
    }
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

  renderInputHeader(_modelName: string) {
    const mode = this.hud.getMode();
    if (mode !== 'CAPTURE') return;
    
    const recIcon = '⏺️';

    let line = chalk.dim(' ╭─ ') + 
               chalk.yellow(`${recIcon} 多行录制中`) + chalk.dim(' | ') +
               chalk.dim(`输入 ${chalk.bold('EOF')} 提交，${chalk.bold('Ctrl+C')} 取消`);
    
    console.log(line);
  }
}
