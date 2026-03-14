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
  onLineChange?: (line: string) => void;
  onCommandHints?: (hints: { name: string; description: string }[]) => void;
  slashCommands?: { name: string; description: string }[];
  stdin?: NodeJS.ReadableStream;
}) {
  const input = opts.stdin || process.stdin;
  if (!opts.isTTY) return { detach() {} };

  let lastCtrlC = 0;

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

    // Detect '/' at the beginning of an empty line - disabled automatic popup as per Requirement 3 revision
    /*
    if (str === '/' && opts.getMode() === 'IDLE' && opts.onSlash) {
      const line = (opts.rl as any).line || '';
      if (!line || line === '/') {
        opts.onSlash();
        return;
      }
    }
    */

    // After any keypress, check for hints
    setImmediate(() => {
      if (opts.isInputSuspended()) return;
      const rl = opts.rl as any;
      const line = rl.line || '';
      
      opts.onLineChange?.(line);

      if (line.startsWith('/') && opts.onCommandHints && opts.slashCommands) {
        const cmdPart = line.split(/\s+/)[0] || '/';
        const matches = opts.slashCommands.filter(c => c.name.startsWith(cmdPart));
        opts.onCommandHints(matches);
      } else {
        opts.onCommandHints?.([]);
      }
    });

    // Ctrl+L: clear screen but keep session
    if (key.ctrl && key.name === 'l') {
      opts.onClearScreen();
      return;
    }

    // Ctrl+C: Smart Interruption / Exit
    if (key.ctrl && key.name === 'c') {
      if (opts.isCapturing()) {
        opts.cancelCapture();
        opts.onHint('Capture canceled.');
        return;
      }

      // Try aborting a running task first
      const aborted = opts.abortCurrent();
      if (aborted) return;

      // If IDLE, require double Ctrl+C within 2 seconds
      const now = Date.now();
      if (now - lastCtrlC < 2000) {
        opts.onExit();
      } else {
        lastCtrlC = now;
        opts.onHint('(To exit, press Ctrl+C again or Ctrl+D or type /exit)');
      }
      return;
    }

    // Ctrl+D: Exit only if line is empty (EOF standard)
    if (key.ctrl && key.name === 'd') {
      const line = (opts.rl as any).line || '';
      if (!line) {
        opts.onExit();
      }
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
