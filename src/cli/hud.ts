import chalk from 'chalk';

if (process.env.NO_COLOR) (chalk as any).level = 0;

export type HUDMode = 'IDLE' | 'THINKING' | 'STREAMING' | 'CAPTURE' | 'CONFIRM';

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
  private folder: string = '';
  private authPath: string = '';

  private update: LogUpdateInstance | null = null;
  private stream: NodeJS.WritableStream;

  constructor(opts?: { enabled?: boolean; stream?: NodeJS.WritableStream }) {
    const tty = Boolean(process.stdout.isTTY);
    const onByDefault = tty && envEnabled('STATUS_BAR', true);
    this.statusBarEnabled = opts?.enabled ?? onByDefault;
    this.stream = opts?.stream || process.stderr;
  }

  async init(): Promise<void> {
    if (!process.stdout.isTTY && !this.statusBarEnabled) return;
    try {
      const mod = (await import('log-update')) as unknown as LogUpdateModule;
      if (typeof mod.createLogUpdate === 'function') {
        this.update = mod.createLogUpdate(this.stream);
        return;
      }
      if (mod.logUpdateStderr) {
        this.update = mod.logUpdateStderr;
        return;
      }
    } catch { /* ignore */ }
    this.statusBarEnabled = false;
    this.update = null;
  }

  isEnabled(): boolean { return this.statusBarEnabled; }
  setEnabled(on: boolean) { this.statusBarEnabled = on; }
  isReady(): boolean { return Boolean(this.update); }

  suspend(on: boolean) {
    this.suspended = on;
    if (on) this.clear();
  }

  setMode(mode: HUDMode) { this.mode = mode; }
  getMode(): HUDMode { return this.mode; }

  setProvider(provider: string) { this.provider = (provider || 'unknown').toLowerCase(); }
  setModel(model: string) { this.model = (model || 'unknown').toLowerCase(); }
  setFolder(folder: string) { this.folder = folder; }
  setAuthPath(authPath: string) { this.authPath = authPath; }

  clear() {
    if (!this.statusBarEnabled || !this.update) return;
    this.update.clear();
  }

  getLines(): string[] {
    const lines: string[] = [];
    if (this.statusBarEnabled) {
      // Add a dimmed separator line
      const width = process.stdout.columns || 80;
      lines.push(chalk.dim('─'.repeat(width)));
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
    // Identity: provider/model
    const modelShort = this.model !== 'unknown' ? this.model : '';
    const identity = chalk.cyan(`${this.provider}${modelShort ? '/' + modelShort : ''}`);
    
    // Paths: Current Folder and Authorized Root
    const folderStr = this.folder ? chalk.dim(` | 📁 ${this.folder}`) : '';
    const authPathStr = this.authPath ? chalk.dim(` | 🛡️ ${this.authPath}`) : '';

    return ` ${identity}${folderStr}${authPathStr}`;
  }
}
