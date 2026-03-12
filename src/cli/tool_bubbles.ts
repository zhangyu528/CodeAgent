import chalk from 'chalk';

export type BubbleStatus = 'running' | 'ok' | 'err';

export type ToolBubbleItem = {
  id: number;
  toolName: string;
  argsPreview: string;
  status: BubbleStatus;
  startedAt: number;
  endedAt?: number;
  result?: any;
  args?: any;
};

function safeJsonPreview(obj: any, maxLen: number) {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '...';
  } catch {
    return String(obj);
  }
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function tryRequireLogUpdate(): any | null {
  try {
    // optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('log-update');
  } catch {
    return null;
  }
}

export class ToolBubbles {
  private items: ToolBubbleItem[] = [];
  private nextId = 1;
  private maxItems: number;
  private enabled: boolean;
  private logUpdate: any | null;

  constructor(opts?: { maxItems?: number; enabled?: boolean }) {
    this.maxItems = opts?.maxItems ?? 8;
    this.enabled = opts?.enabled ?? Boolean(process.stdout.isTTY);
    this.logUpdate = tryRequireLogUpdate();
  }

  reset() {
    this.items = [];
    this.nextId = 1;
    if (this.enabled && this.logUpdate) this.logUpdate.clear();
  }

  onToolStarted(toolName: string, args: any) {
    const item: ToolBubbleItem = {
      id: this.nextId++,
      toolName,
      argsPreview: safeJsonPreview(args, 80),
      status: 'running',
      startedAt: Date.now(),
      args,
    };

    this.items.push(item);
    if (this.items.length > this.maxItems) this.items.shift();
    this.render();
  }

  onToolFinished(toolName: string, result: any) {
    const item = [...this.items].reverse().find(i => i.toolName === toolName && i.status === 'running');
    if (item) {
      item.status = String(result || '').toLowerCase().includes('error') ? 'err' : 'ok';
      item.endedAt = Date.now();
      item.result = result;
    }
    this.render();
  }

  list(): ToolBubbleItem[] {
    return [...this.items];
  }

  getById(id: number): ToolBubbleItem | undefined {
    return this.items.find(i => i.id === id);
  }

  private formatItem(i: ToolBubbleItem): string {
    const duration = i.endedAt ? ` ${chalk.dim(formatMs(i.endedAt - i.startedAt))}` : '';
    const status =
      i.status === 'running' ? chalk.yellow('⏳') :
      i.status === 'ok' ? chalk.green('✅') :
      chalk.red('❌');

    return `${chalk.dim(String(i.id).padStart(2, '0'))} ${status} ${chalk.white(i.toolName)} ${chalk.dim(i.argsPreview)}${duration}`;
  }

  render() {
    if (!this.enabled) return;

    const content = this.items.map(i => this.formatItem(i)).join('\n');

    if (this.logUpdate) {
      this.logUpdate(content);
      return;
    }

    const last = this.items[this.items.length - 1];
    if (last) console.log(this.formatItem(last));
  }
}
