import chalk from 'chalk';

if (process.env.NO_COLOR) (chalk as any).level = 0;

export type HUDMode = 'IDLE' | 'THINKING' | 'STREAMING' | 'CAPTURE' | 'CONFIRM';

export type TelemetrySummary = {
  totalTokens: number;
  estimatedCost: string;
  byProvider?: { provider: string; totalTokens: number; estimatedCost: string }[];
};

function envEnabled(name: string, defaultOn: boolean) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return defaultOn;
  if (raw === '0' || raw.toLowerCase() === 'false' || raw.toLowerCase() === 'off') return false;
  if (raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'on') return true;
  return defaultOn;
}

type LogUpdateInstance = ((text: string) => void) & { clear: () => void; done: () => void };

type LogUpdateModule = {
  createLogUpdate: (stream: NodeJS.WritableStream) => LogUpdateInstance;
  logUpdateStderr?: LogUpdateInstance;
  default?: ((text: string) => void) & { clear?: () => void; done?: () => void };
};

export class HUD {
  private statusBarEnabled: boolean;
  private suspended: boolean = false;

  private mode: HUDMode = 'IDLE';
  private provider: string = 'unknown';
  private model: string = 'unknown';
  private contextTokens: number = 0;
  private telemetry: TelemetrySummary | null = null;
  private lastTool: string = '';
  private folder: string = '';
  private helpHint: string = '';

  private update: LogUpdateInstance | null = null;
  private stream: NodeJS.WritableStream;

  constructor(opts?: { enabled?: boolean; stream?: NodeJS.WritableStream }) {
    const tty = Boolean(process.stdout.isTTY);
    const onByDefault = tty && envEnabled('STATUS_BAR', true);
    this.statusBarEnabled = opts?.enabled ?? onByDefault;
    this.stream = opts?.stream || process.stderr;
  }

  async init(): Promise<void> {
    // Always try to init log-update for hints if TTY, even if status bar is off
    if (!process.stdout.isTTY && !this.statusBarEnabled) return;

    try {
      const mod = (await import('log-update')) as unknown as LogUpdateModule;
      if (typeof mod.createLogUpdate === 'function') {
        this.update = mod.createLogUpdate(this.stream);
        return;
      }

      // Fallback: use stderr updater if present
      if (mod.logUpdateStderr) {
        this.update = mod.logUpdateStderr;
        return;
      }
    } catch {
      // ignore
    }

    // If log-update isn't available/compatible, disable.
    this.statusBarEnabled = false;
    this.update = null;
  }

  isEnabled(): boolean {
    return this.statusBarEnabled;
  }

  setEnabled(on: boolean) {
    this.statusBarEnabled = on;
  }

  isReady(): boolean {
    return Boolean(this.update);
  }

  suspend(on: boolean) {
    this.suspended = on;
    if (on) this.clear();
  }

  setMode(mode: HUDMode) {
    this.mode = mode;
  }

  getMode(): HUDMode {
    return this.mode;
  }

  setProvider(provider: string) {
    this.provider = (provider || 'unknown').toLowerCase();
  }

  setModel(model: string) {
    this.model = (model || 'unknown').toLowerCase();
  }

  setContextTokens(tokens: number) {
    this.contextTokens = Number.isFinite(tokens) ? tokens : 0;
  }

  setTelemetry(summary: TelemetrySummary | null) {
    this.telemetry = summary;
  }

  setLastTool(label: string) {
    this.lastTool = String(label || '');
  }

  setFolder(folder: string) {
    this.folder = folder;
  }

  setHelpHint(hint: string) {
    this.helpHint = hint;
  }

  clear() {
    if (!this.statusBarEnabled || !this.update) return;
    this.update.clear();
  }

  getLines(): string[] {
    const lines: string[] = [];

    if (this.statusBarEnabled) {
      lines.push(this.formatStatusLine());
    }

    return lines;
  }

  render() {
    if (!this.update || this.suspended) return;
    this.update(this.getLines().join('\n'));
  }

  updateRaw(text: string) {
    if (!this.update || this.suspended) return;
    this.update(text);
  }

  done() {
    if (!this.statusBarEnabled || !this.update) return;
    this.update.done();
  }

  private formatStatusLine(): string {
    const mode = chalk.cyan.bold(this.mode);
    const modelStr = this.model !== 'unknown' ? ` ${chalk.blue(this.model)}` : '';
    const providerStr = chalk.yellow(this.provider);
    
    // Core Identity
    const identity = `🤖 ${providerStr}${modelStr}`;
    
    // Context Info
    const folderStr = this.folder ? ` | 📁 ${chalk.blue(this.folder)}` : '';
    const helpStr = this.helpHint ? ` | 💡 ${chalk.dim(this.helpHint)}` : '';
    
    // Stats
    const ctx = chalk.white(String(this.contextTokens));
    const sessionTokens = this.telemetry ? chalk.white(String(this.telemetry.totalTokens)) : chalk.dim('-');
    const cost = this.telemetry ? chalk.white(`$${this.telemetry.estimatedCost}`) : chalk.dim('-');
    const lastToolStr = this.lastTool ? ` | ⚒️  ${chalk.white(this.lastTool)}` : '';

    const left = `${identity}${folderStr}${helpStr}`;
    const right = `Mode:${mode} | Ctx:${ctx} | Ses:${sessionTokens} | Cost:${cost}${lastToolStr}`;

    return chalk.dim('── ') + left + chalk.dim(' ── ') + right;
  }
}
