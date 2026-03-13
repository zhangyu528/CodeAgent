import * as readline from 'readline';
import chalk = require('chalk');
import { HUD } from './hud';
import { ToolBubbles } from './tool_bubbles';
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
  private uiAdapter: DefaultUIAdapter;
  private rl: readline.Interface | null = null;
  private inputSuspended = false;

  constructor() {
    this.hud = new HUD();
    const bubblesEnabled = Boolean(process.stdout.isTTY) && envEnabled('TOOL_BUBBLES', true);
    this.bubbles = new ToolBubbles({ maxItems: 8, enabled: bubblesEnabled });
    
    this.uiAdapter = new DefaultUIAdapter({
      suspendInput: async (fn) => this.suspendInput(fn),
    });
  }

  async init(): Promise<void> {
    await this.hud.init();
  }

  setReadline(rl: readline.Interface) {
    this.rl = rl;
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

  render() {
    this.hud.setBubbleLines(this.bubbles.getLines());
    this.hud.setLastTool(this.bubbles.getLastLabel());
    this.hud.render({ includeBubbles: true });
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
}
