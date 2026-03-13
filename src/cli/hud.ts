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
  private enabled: boolean;
  private suspended: boolean = false;

  private mode: HUDMode = 'IDLE';
  private provider: string = 'unknown';
  private model: string = 'unknown';
  private contextTokens: number = 0;
  private telemetry: TelemetrySummary | null = null;
  private lastTool: string = '';
  private bubbleLines: string[] = [];

  private update: LogUpdateInstance | null = null;
  private stream: NodeJS.WritableStream;

  constructor(opts?: { enabled?: boolean; stream?: NodeJS.WritableStream }) {
    const tty = Boolean(process.stdout.isTTY);
    const onByDefault = tty && envEnabled('STATUS_BAR', true);
    this.enabled = opts?.enabled ?? onByDefault;
    this.stream = opts?.stream || process.stderr;
  }

  async init(): Promise<void> {
    if (!this.enabled) return;

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

    // If log-update isn't available/compatible, disable persistent HUD.
    this.enabled = false;
    this.update = null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
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

  setBubbleLines(lines: string[]) {
    this.bubbleLines = Array.isArray(lines) ? lines : [];
  }

  clear() {
    if (!this.enabled || !this.update) return;
    this.update.clear();
  }

  render(opts?: { includeBubbles?: boolean }) {
    if (!this.enabled || !this.update) return;
    if (this.suspended) return;

    const includeBubbles = opts?.includeBubbles ?? false;

    const lines = [this.formatStatusLine()];

    const showBubbles = includeBubbles && envEnabled('TOOL_BUBBLES', Boolean(process.stdout.isTTY));
    if (showBubbles) lines.push(...this.bubbleLines);

    this.update(lines.join('\n'));
  }

  done() {
    if (!this.enabled || !this.update) return;
    this.update.done();
  }

  private formatStatusLine(): string {
    const mode = chalk.cyan(this.mode);
    const providerStr = this.model !== 'unknown' ? `${this.provider}(${this.model})` : this.provider;
    const provider = chalk.yellow(providerStr);

    const ctx = chalk.white(String(this.contextTokens));
    const sessionTokens = this.telemetry ? chalk.white(String(this.telemetry.totalTokens)) : chalk.dim('-');
    const cost = this.telemetry ? chalk.white(`$${this.telemetry.estimatedCost}`) : chalk.dim('-');
    const lastTool = this.lastTool ? chalk.white(this.lastTool) : chalk.dim('-');

    const left = `Provider:${provider}  Mode:${mode}`;
    const mid = `Ctx:${ctx}  Session:${sessionTokens}  Cost:${cost}`;
    const right = `LastTool:${lastTool}`;

    return chalk.dim('[Status] ') + `${left}  |  ${mid}  |  ${right}`;
  }
}
