/**
 * InputController — 纯 JS 按键捕获，替代 Ink useInput
 *
 * 工作方式：
 * 1. setRawMode(true) 让 stdin 按字符而非行模式工作
 * 2. 'readable' 事件读取字符
 * 3. ANSI escape 序列解析方向键等特殊键
 * 4. 渲染直接写 stdout，光标用 escape sequence 定位
 */

import {
  write,
  cursorTo,
  clearLine,
  getTerminalSize,
  T,
} from './core/Terminal.js';

export interface InputControllerOptions {
  rows: number;
  cols: number;
  prompt?: string;
  onSubmit: (value: string) => void;
  onKey?: (key: string, special: KeyInfo) => void;
}

export interface KeyInfo {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  backspace?: boolean;
  delete?: boolean;
  return?: boolean;
  escape?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export class InputController {
  private value = '';
  private cursorPos = 0;
  private opts: InputControllerOptions;
  private isRunning = false;
  private origRawMode: boolean | null = null;
  private history: string[] = [];
  private historyIndex = -1;

  constructor(opts: InputControllerOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isRaw = true;

    // Enter raw mode
    if (process.stdin.isTTY) {
      this.origRawMode = (process.stdin as any)._rawMode;
      (process.stdin as any).setRawMode?.(true);
    }

    // Render initial input line
    this.render();

    // Attach listener
    process.stdin.on('readable', this.onReadable);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    process.stdin.off('readable', this.onReadable);

    if (process.stdin.isTTY && this.origRawMode !== null) {
      (process.stdin as any).setRawMode?.(this.origRawMode);
    }

    this.value = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
  }

  private get isRaw(): boolean {
    return (process.stdin as any)._rawMode === true;
  }

  private set isRaw(v: boolean) {
    if (process.stdin.isTTY) {
      (process.stdin as any)._rawMode = v;
    }
  }

  private onReadable = (): void => {
    let chunk: Buffer | string;
    while ((chunk = process.stdin.read()) !== null) {
      const input = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      for (const char of input) {
        this.handleChar(char);
      }
    }
  };

  private handleChar(char: string): void {
    const code = char.charCodeAt(0);

    // ESC followed by [ or O → special key
    if (code === 0x1b) {
      // Will be followed by more chars
      return;
    }

    // CR or LF → submit
    if (code === 13 || code === 10) {
      this.submit();
      return;
    }

    // Ctrl+C
    if (code === 3) {
      this.value = '';
      this.cursorPos = 0;
      this.render();
      return;
    }

    // Backspace
    if (code === 127 || code === 8) {
      if (this.cursorPos > 0) {
        this.value = this.value.slice(0, this.cursorPos - 1) + this.value.slice(this.cursorPos);
        this.cursorPos--;
        this.render();
      }
      return;
    }

    // Other control chars ignored
    if (code < 32) return;

    // Regular char
    this.value = this.value.slice(0, this.cursorPos) + char + this.value.slice(this.cursorPos);
    this.cursorPos++;
    this.render();
  }

  private submit(): void {
    const v = this.value.trim();
    if (!v) return;

    // Add to history
    this.history.unshift(v);
    if (this.history.length > 100) this.history.pop();

    // Clear input line
    this.value = '';
    this.cursorPos = 0;
    this.render();

    // Callback
    this.opts.onSubmit(v);
  }

  private render(): void {
    const { rows, cols } = getTerminalSize();
    const inputRow = rows - 4;
    const prompt = this.opts.prompt || ' CHAT ';
    const promptLen = prompt.length;

    // Line 1: prompt + value + cursor
    write(cursorTo(inputRow, 1));
    write(clearLine());
    write(`${T.fg.cyan}${T.bold}${prompt}${T.reset} `);
    write(this.value);

    // Cursor position
    const cursorCol = promptLen + 2 + this.cursorPos + 1;
    write(cursorTo(inputRow, cursorCol));
    write(`${T.fg.cyan}▌${T.reset}`);

    // Clear rest of line
    write(clearLine());
  }
}
