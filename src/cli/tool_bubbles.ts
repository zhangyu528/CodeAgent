import chalk from 'chalk';

if (process.env.NO_COLOR) (chalk as any).level = 0;

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

export class ToolBubbles {
  private items: ToolBubbleItem[] = [];
  private nextId = 1;
  private maxItems: number;
  private enabled: boolean;

  constructor(opts?: { maxItems?: number; enabled?: boolean }) {
    this.maxItems = opts?.maxItems ?? 8;
    this.enabled = opts?.enabled ?? Boolean(process.stdout.isTTY);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  reset() {
    this.items = [];
    this.nextId = 1;
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
  }

  onToolFinished(toolName: string, result: any) {
    const item = [...this.items].reverse().find(i => i.toolName === toolName && i.status === 'running');
    if (item) {
      item.status = String(result || '').toLowerCase().includes('error') ? 'err' : 'ok';
      item.endedAt = Date.now();
      item.result = result;
    }
  }

  list(): ToolBubbleItem[] {
    return [...this.items];
  }

  getById(id: number): ToolBubbleItem | undefined {
    return this.items.find(i => i.id === id);
  }

  getLastLabel(): string {
    const last = this.items[this.items.length - 1];
    if (!last) return '';
    return `${last.toolName}(${last.status})`;
  }

  getLines(): string[] {
    if (!this.enabled) return [];
    return this.items.map(i => this.formatItem(i));
  }

  private formatItem(i: ToolBubbleItem): string {
    const duration = i.endedAt ? ` ${chalk.dim(formatMs(i.endedAt - i.startedAt))}` : '';
    const status =
      i.status === 'running' ? chalk.yellow('⏳') :
      i.status === 'ok' ? chalk.green('✅') :
      chalk.red('❌');

    return `${chalk.dim(String(i.id).padStart(2, '0'))} ${status} ${chalk.white(i.toolName)} ${chalk.dim(i.argsPreview)}${duration}`;
  }
}
