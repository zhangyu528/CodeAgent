import * as readline from 'readline';

export type KeybindingMode = 'IDLE' | 'THINKING' | 'STREAMING' | 'CAPTURE' | 'CONFIRM';

export function attachKeybindings(opts: {
  rl: readline.Interface;
  isTTY: boolean;
  getMode: () => KeybindingMode;
  isInputSuspended: () => boolean;
  isCapturing: () => boolean;
  cancelCapture: () => void;
  abortCurrent: () => boolean;
  onClearScreen: () => void;
  onExit: () => void;
  onHint: (text: string) => void;
  onSlash?: () => void;
  onToggleHUD?: () => void;
  stdin?: NodeJS.ReadableStream;
}) {
  const input = opts.stdin || process.stdin;
  if (!opts.isTTY) return { detach() {} };

  readline.emitKeypressEvents(input as any);
  if (input === process.stdin) {
    try {
      (process.stdin as any).setRawMode?.(true);
    } catch {
      // ignore
    }
  }

  const onKeypress = (str: string, key: any) => {
    if (opts.isInputSuspended()) return;
    if (!key) return;

    // F9: Toggle HUD
    if (key.name === 'f9') {
      opts.onToggleHUD?.();
      return;
    }

    // ESC: Cancel capture, abort process, or clear current line
    if (key.name === 'escape') {
      if (opts.isCapturing()) {
        opts.cancelCapture();
        opts.onHint('Capture canceled.');
        return;
      }

      const aborted = opts.abortCurrent();
      if (aborted) return;

      // Clear current line
      const rl = opts.rl as any;
      if (rl.line) {
        readline.moveCursor(process.stdout, -rl.cursor, 0);
        readline.clearLine(process.stdout, 1);
        rl.line = '';
        rl.cursor = 0;
      }
      return;
    }

    // Detect '/' at the beginning of an empty line
    if (str === '/' && opts.getMode() === 'IDLE' && opts.onSlash) {
      const line = (opts.rl as any).line || '';
      // If line is empty or already contains just '/', trigger menu
      if (!line || line === '/') {
        opts.onSlash();
        return;
      }
    }

    // Ctrl+L: clear screen but keep session
    if (key.ctrl && key.name === 'l') {
      opts.onClearScreen();
      return;
    }

    // Ctrl+C or Ctrl+D: exit
    if ((key.ctrl && key.name === 'c') || (key.ctrl && key.name === 'd')) {
      opts.onExit();
      return;
    }
  };

  (input as any).on('keypress', onKeypress);

  return {
    detach() {
      (input as any).off('keypress', onKeypress);
      if (input === process.stdin) {
        try {
          (process.stdin as any).setRawMode?.(false);
        } catch {
          // ignore
        }
      }
    },
  };
}
