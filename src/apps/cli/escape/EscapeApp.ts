/**
 * EscapeApp — Pure JS escape sequence renderer, zero React/Ink dependencies
 *
 * Architecture: state is pushed in from outside via setPage/setModel/updateMessages.
 * EscapeApp does not read from any shared store.
 *
 * Usage:
 *   import { EscapeApp } from './EscapeApp.js';
 *   const app = new EscapeApp({
 *     onPageChange: (page) => { /* update ink store *\/ },
 *     onSubmit: (prompt) => { /* handle prompt *\/ },
 *   });
 *   app.start();
 *   app.setPage('welcome');
 *   app.setPage('chat');
 *   app.stop();
 */

import { InputController } from './InputController.js';

import {
  T,
  write,
  clearScreen,
  cursorTo,
  getTerminalSize,
  hideCursor,
  showCursor,
} from './core/Terminal.js';

export type EscapePage = 'welcome' | 'chat';

export interface EscapeAppOptions {
  onPageChange?: (page: EscapePage) => void;
  onSubmit?: (prompt: string) => void;
}

export class EscapeApp {
  private page: EscapePage | null = null;
  private model: string = 'unknown';
  private messageCount: number = 0;
  private inputCtrl: InputController | null = null;
  private opts: EscapeAppOptions;

  constructor(opts: EscapeAppOptions = {}) {
    this.opts = opts;
  }

  start(): void {}

  stop(): void {
    this.inputCtrl?.stop();
    write(showCursor());
  }

  setPage(page: EscapePage): void {
    if (page === this.page) return;
    this.page = page;

    const { rows, cols } = getTerminalSize();

    if (page === 'welcome') {
      this.inputCtrl?.stop();
      this.inputCtrl = null;
      this.renderWelcome(rows, cols);
      this.inputCtrl = new InputController({
        rows,
        cols,
        onSubmit: (value: string) => {
          this.opts.onSubmit?.(value);
        },
      });
      this.inputCtrl.start();
    } else if (page === 'chat') {
      this.inputCtrl?.stop();
      this.inputCtrl = null;
      this.renderChat(rows, cols);
    }
  }

  setModel(model: string): void {
    this.model = model;
    if (this.page === 'chat') {
      const { rows } = getTerminalSize();
      write(cursorTo(1, 1));
      write(`${T.bold}${T.fg.cyan}CodeAgent${T.reset}  `);
      write(`${T.dim}${this.model}${T.reset}  ${T.dim}${this.messageCount} msgs${T.reset}`);
    }
  }

  setMessageCount(count: number): void {
    this.messageCount = count;
    if (this.page === 'chat') {
      const { rows } = getTerminalSize();
      write(cursorTo(1, 1));
      write(`${T.bold}${T.fg.cyan}CodeAgent${T.reset}  `);
      write(`${T.dim}${this.model}${T.reset}  ${T.dim}${this.messageCount} msgs${T.reset}`);
    }
  }

  private renderWelcome(rows: number, cols: number): void {
    write(hideCursor());
    write(clearScreen());

    // ASCII logo
    const logoLines = [
      '  ██████╗██╗  ██╗███████╗███╗   ██╗',
      ' ██╔════╝██║  ██║██╔════╝████╗  ██║',
      ' ██║     ███████║█████╗  ██╔██╗ ██║',
      ' ██║     ██╔══██║██╔══╝  ██║╚██╗██║',
      ' ╚██████╗██║  ██║███████╗██║ ╚████║',
      '  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝',
      '       C O D E   A G E N T',
    ];
    const logoWidth = logoLines[0].length;
    const logoLeft = Math.floor((cols - logoWidth) / 2);
    const logoStart = Math.floor((rows - 7) / 2);

    for (let i = 0; i < logoLines.length; i++) {
      write(cursorTo(logoStart + i, logoLeft));
      write(`${T.fg.cyan}${logoLines[i]}${T.reset}`);
    }

    const vRow = logoStart + logoLines.length + 2;
    write(cursorTo(vRow, Math.floor((cols - 20) / 2)));
    write(`${T.bold}${T.fg.blue}CodeAgent${T.reset} ${T.dim}v0.1.0${T.reset}`);

    write(cursorTo(vRow + 3, Math.floor((cols - 30) / 2)));
    write(`${T.dim}Type a message to start${T.reset}`);

    const inputRow = rows - 4;
    write(cursorTo(inputRow, Math.floor((cols - 40) / 2)));
    write(`${T.fg.cyan} CHAT ${T.reset} `);
    write(`${T.dim}Your message...${T.reset}`);

    write(cursorTo(inputRow, Math.floor((cols - 40) / 2) + 8));

    write(cursorTo(rows, 1));
    write(`${T.dim}Ctrl+C to exit${T.reset}`);
  }

  private renderChat(rows: number, cols: number): void {
    write(hideCursor());
    write(clearScreen());

    write(cursorTo(1, 1));
    write(`${T.bold}${T.fg.cyan}CodeAgent${T.reset}  `);
    write(`${T.dim}${this.model}${T.reset}  ${T.dim}${this.messageCount} msgs${T.reset}`);

    write(cursorTo(2, 1));
    write(`${T.dim}${'─'.repeat(cols)}${T.reset}`);

    write(cursorTo(3, 1));
    write(`${' '.repeat(cols)}`);

    const inputRow = rows - 4;
    write(cursorTo(inputRow, 1));
    write(`${T.fg.cyan} CHAT ${T.reset} `);

    write(cursorTo(rows, 1));
    write(`${T.dim}Ctrl+C=exit${' '.repeat(Math.max(1, cols - 20))}${process.cwd()}${T.reset}`);

    write(cursorTo(inputRow, 8));
  }
}
