/**
 * EscapeApp — Pure JS escape sequence renderer, zero React/Ink dependencies
 *
 * Usage:
 *   import { EscapeApp } from './EscapeApp.js';
 *   const app = new EscapeApp({ initPromise });
 *   app.start();
 *   // later: app.stop()
 */

import { checkApiKeyConfigured, getModels, ensureProvidersLoaded } from '@codeagent/core';
import type { AgentSession } from '@codeagent/core';
import { useAppStore } from '../ink/store/uiStore.js';
import {
  T,
  write,
  clearScreen,
  cursorTo,
  getTerminalSize,
  hideCursor,
  showCursor,
} from './core/Terminal.js';
import { ASCII_LOGO } from '../ink/pages/welcome/constants.js';
import { InputController } from './InputController.js';

export interface EscapeAppOptions {
  initPromise?: Promise<AgentSession>;
}

export class EscapeApp {
  private inputCtrl: InputController | null = null;
  private page: 'init' | 'welcome' | 'chat' = 'init';
  private initPromise?: Promise<AgentSession>;

  constructor(options: EscapeAppOptions = {}) {
    this.initPromise = options.initPromise;
    // Subscribe to store changes
    useAppStore.subscribe(() => {
      const newPage = useAppStore.getState().page;
      if (newPage !== this.page) {
        this.page = newPage;
        this.onPageChange(newPage);
      }
    });
  }

  start(): void {
    this.page = useAppStore.getState().page;
    this.onPageChange(this.page);
  }

  stop(): void {
    this.inputCtrl?.stop();
    write(showCursor());
  }

  private onPageChange(page: string): void {
    if (page === 'init') return;

    const { rows, cols } = getTerminalSize();

    if (page === 'welcome') {
      this.inputCtrl?.stop();
      this.inputCtrl = null;
      this.renderWelcome(rows, cols);
      this.inputCtrl = new InputController({
        rows,
        cols,
        onSubmit: (value: string) => {
          useAppStore.getState().setPendingPrompt?.(value);
          useAppStore.getState().setPage('chat');
        },
      });
      this.inputCtrl.start();
    } else if (page === 'chat') {
      this.inputCtrl?.stop();
      this.inputCtrl = null;
      this.renderChat(rows, cols);
    }
  }

  private renderWelcome(rows: number, cols: number): void {
    write(hideCursor());
    write(clearScreen());

    const logoWidth = ASCII_LOGO[0].length;
    const logoLeft = Math.floor((cols - logoWidth) / 2);
    const logoStart = Math.floor((rows - 7) / 2);

    for (let i = 0; i < ASCII_LOGO.length; i++) {
      write(cursorTo(logoStart + i, logoLeft));
      write(`${T.fg.cyan}${ASCII_LOGO[i]}${T.reset}`);
    }

    const vRow = logoStart + ASCII_LOGO.length + 1;
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
    write(`${T.dim}chat${T.reset}  ${T.dim}0 msgs${T.reset}`);

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
