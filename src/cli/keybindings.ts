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
}) {
  if (!opts.isTTY) return { detach() {} };

  readline.emitKeypressEvents(process.stdin);
  try {
    process.stdin.setRawMode(true);
  } catch {
    // ignore
  }

  const onKeypress = (_str: string, key: any) => {
    if (opts.isInputSuspended()) return;
    if (!key) return;

    // Ctrl+L: clear screen but keep session
    if (key.ctrl && key.name === 'l') {
      opts.onClearScreen();
      return;
    }

    // Ctrl+D: exit
    if (key.ctrl && key.name === 'd') {
      opts.onExit();
      return;
    }

    // Ctrl+C: interrupt or cancel capture
    if (key.ctrl && key.name === 'c') {
      if (opts.isCapturing()) {
        opts.cancelCapture();
        opts.onHint('Capture canceled. Tip: use <<EOF ... EOF to submit multiline prompts.');
        return;
      }

      const mode = opts.getMode();
      const aborted = opts.abortCurrent();
      if (aborted) return;

      // If idle and no pending input, show a hint instead of exiting.
      if (mode === 'IDLE') {
        const line = (opts.rl as any).line || '';
        if (!String(line).trim()) {
          opts.onHint('Press Ctrl+D to exit.');
        }
      }
    }
  };

  process.stdin.on('keypress', onKeypress);

  return {
    detach() {
      process.stdin.off('keypress', onKeypress);
      try {
        process.stdin.setRawMode(false);
      } catch {
        // ignore
      }
    },
  };
}
