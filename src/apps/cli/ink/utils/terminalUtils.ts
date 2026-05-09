/**
 * terminalUtils.ts — Low-level ANSI/VT100 escape sequence helpers
 *
 * Used by the hybrid streaming renderer to manage:
 * - Alternate screen switching (already done in index.tsx)
 * - Scroll region (DECSTBM) for separating history from overlay
 * - Cursor visibility
 * - History region positioning
 */

/** Hide the terminal cursor */
export function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

/** Show the terminal cursor */
export function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

/**
 * DECSTBM — Set scrolling region (top, bottom inclusive, 1-indexed).
 * Lines outside the region stay fixed; only the region scrolls.
 *
 * Example: DECSTBM(2, 24) makes rows 2-24 scrollable, row 1 stays fixed.
 */
export function setScrollRegion(top: number, bottom: number): void {
  process.stdout.write(`\x1b[${top};${bottom}r`);
}

/** Reset scrolling region to full terminal */
export function resetScrollRegion(): void {
  process.stdout.write('\x1b[r');
}

/**
 * Move cursor to row, col (1-indexed)
 */
export function moveCursor(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

/** Get current cursor position (DM/DI queries) */
export function getCursorPosition(): Promise<{ row: number; col: number }> {
  return new Promise(resolve => {
    // CSI 6 n — Device Status Report: cursor position
    process.stdout.write('\x1b[6n');

    const handler = (data: Buffer) => {
      const str = data.toString();
      const match = str.match(/\x1b\[(\d+);(\d+)R/);
      if (match) {
        process.stdin.off('data', handler);
        resolve({ row: parseInt(match[1], 10), col: parseInt(match[2], 10) });
      }
    };

    process.stdin.on('data', handler);
    // Timeout fallback
    setTimeout(() => {
      process.stdin.off('data', handler);
      resolve({ row: 1, col: 1 });
    }, 500);
  });
}

/** Clear from cursor to end of line */
export function clearEOL(): void {
  process.stdout.write('\x1b[K');
}

/** Clear from cursor to end of screen */
export function clearEOS(): void {
  process.stdout.write('\x1b[J');
}

/** Clear the entire screen */
export function clearScreen(): void {
  process.stdout.write('\x1b[2J');
}

/**
 * Erase N lines below current cursor position (inclusive).
 * Used to redraw the overlay area.
 */
export function eraseLinesBelow(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[J'); // clear from cursor to end of screen
    if (i < count - 1) {
      process.stdout.write('\x1b[1A'); // move up one line
    }
  }
}

/**
 * Save current cursor position (DECSC)
 */
export function saveCursor(): void {
  process.stdout.write('\x1b[s');
}

/**
 * Restore cursor position (DECRC)
 */
export function restoreCursor(): void {
  process.stdout.write('\x1b[u');
}

/**
 * Query terminal size (DA2 — Secondary Device Attributes).
 * Returns { rows, cols } via a promise.
 */
export function queryTerminalSize(): Promise<{ rows: number; cols: number }> {
  return new Promise(resolve => {
    // CSI 18 t — Report terminal size in cells
    process.stdout.write('\x1b[18t');

    const handler = (data: Buffer) => {
      const str = data.toString();
      // \x1b[8;rows;colst
      const match = str.match(/\x1b\[8;(\d+);(\d+)t/);
      if (match) {
        process.stdin.off('data', handler);
        resolve({ rows: parseInt(match[1], 10), cols: parseInt(match[2], 10) });
      }
    };

    process.stdin.on('data', handler);
    setTimeout(() => {
      process.stdin.off('data', handler);
      resolve({ rows: process.stdout.rows || 24, cols: process.stdout.columns || 80 });
    }, 500);
  });
}

/**
 * Move cursor up N lines (CUU)
 */
export function cursorUp(n: number): void {
  if (n > 0) process.stdout.write(`\x1b[${n}A`);
}

/**
 * Move cursor down N lines (CUD)
 */
export function cursorDown(n: number): void {
  if (n > 0) process.stdout.write(`\x1b[${n}B`);
}

/**
 * Move cursor forward (right) N columns (CUF)
 */
export function cursorForward(n: number): void {
  if (n > 0) process.stdout.write(`\x1b[${n}C`);
}

/**
 * Move cursor back (left) N columns (CUB)
 */
export function cursorBack(n: number): void {
  if (n > 0) process.stdout.write(`\x1b[${n}D`);
}

/**
 * Bell — audible/visual alert
 */
export function bell(): void {
  process.stdout.write('\x07');
}

/**
 * Carriage return — move cursor to beginning of line
 */
export function cr(): void {
  process.stdout.write('\r');
}

/**
 * Newline — move cursor down one line
 */
export function newline(): void {
  process.stdout.write('\n');
}
