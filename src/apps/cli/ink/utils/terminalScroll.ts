/**
 * Terminal Scroll Region Controller
 * Uses ANSI escape sequences to create a scrollable region in the terminal.
 *
 * Layout:
 *   Row 0: Header (fixed)
 *   Row 1: Separator
 *   Row 2 to (terminalRows - footerRows - 2): Scroll region (messages)
 *   Row (terminalRows - footerRows - 1): Separator
 *   Row (terminalRows - footerRows) to terminalRows: Footer (Input)
 */

import { EOL } from 'os';

const ESC = '\x1b';
const CSI = `${ESC}[`;

// ANSI escape sequences
export const ansi = {
  // Cursor positioning (1-indexed)
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,

  // Clear operations
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  clearLineToEnd: () => `${CSI}0K`,
  clearLineToStart: () => `${CSI}1K`,

  // Scroll region (DECSTBMS)
  // top and bottom are 1-indexed
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,

  // Scroll within region
  scrollUp: (lines: number = 1) => `${CSI}${lines}S`,
  scrollDown: (lines: number = 1) => `${CSI}${lines}T`,

  // Save/restore cursor
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,

  // Hide/show cursor
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,

  // Alternate screen
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,

  // Reset
  reset: () => `${ESC}c`,
};

export interface TerminalRegion {
  top: number;
  bottom: number;
}

export class TerminalScrollRegion {
  private rows: number;
  private cols: number;
  private headerRows: number;
  private footerRows: number;
  private scrollTop: number;
  private scrollBottom: number;
  private currentLine: number = 0;

  constructor(options: {
    totalRows: number;
    totalCols: number;
    headerRows: number;
    footerRows: number;
  }) {
    this.rows = options.totalRows || process.stdout.rows || 24;
    this.cols = options.totalCols || process.stdout.columns || 80;
    this.headerRows = options.headerRows;
    this.footerRows = options.footerRows;

    // Scroll region: after header + 1 separator
    this.scrollTop = this.headerRows + 1;
    // Footer area: last footerRows lines
    this.scrollBottom = this.rows - this.footerRows - 1;
  }

  /**
   * Resize the terminal region (e.g., on terminal resize)
   */
  resize(totalRows: number, totalCols: number): void {
    this.rows = totalRows;
    this.cols = totalCols;
    this.scrollTop = this.headerRows + 1;
    this.scrollBottom = this.rows - this.footerRows - 1;
  }

  /**
   * Get the scroll region boundaries
   */
  getRegion(): TerminalRegion {
    return { top: this.scrollTop, bottom: this.scrollBottom };
  }

  /**
   * Get header region
   */
  getHeaderRegion(): TerminalRegion {
    return { top: 1, bottom: this.headerRows };
  }

  /**
   * Get footer/input region
   */
  getFooterRegion(): TerminalRegion {
    return { top: this.rows - this.footerRows + 1, bottom: this.rows };
  }

  /**
   * Initialize the terminal: enter alt screen, setup scroll region
   */
  init(): void {
    process.stdout.write(ansi.enterAltScreen());
    process.stdout.write(ansi.clearScreen());
    this.enableScrollRegion();
  }

  /**
   * Cleanup: exit alt screen, show cursor
   */
  cleanup(): void {
    process.stdout.write(ansi.exitAltScreen());
    process.stdout.write(ansi.showCursor());
  }

  /**
   * Enable scroll region for the messages area
   */
  enableScrollRegion(): void {
    process.stdout.write(ansi.setScrollRegion(this.scrollTop, this.scrollBottom));
  }

  /**
   * Disable scroll region (full terminal scroll)
   */
  disableScrollRegion(): void {
    process.stdout.write(ansi.setScrollRegion(1, this.rows));
  }

  /**
   * Write a line to the scroll region (appends at bottom, scrolls up if needed)
   */
  writeLine(text: string): void {
    // Move cursor to end of scroll region
    process.stdout.write(ansi.cursorTo(this.scrollBottom));
    // Scroll up to make room
    process.stdout.write(ansi.scrollUp(1));
    // Clear the line that will be pushed out (already in scrollback)
    // Actually we need to write at the new last line
    // The scroll moved content up, so row scrollBottom-1 is now free
    // But wait - after scrollUp, the cursor position... let me think
    // After CSI n S, cursor stays in place or moves up? It stays in place.
    // So cursor is now at scrollBottom - 1 row.
    // We need to move to scrollBottom and write there.

    // Actually let me re-check: CSI n S scrolls n lines UP from the TOP of
    // the scroll region. Content at top goes into scrollback.
    // The cursor position is UNCHANGED by scroll commands.

    // So after scrollUp(1), cursor is still where we last positioned it.
    // We want to write at the last line of the scroll region.
    process.stdout.write(ansi.cursorTo(this.scrollBottom, 1));
    process.stdout.write(ansi.clearLine());
    process.stdout.write(text);
    process.stdout.write(ansi.clearLineToEnd());
  }

  /**
   * Write multiple lines at once
   */
  writeLines(lines: string[]): void {
    for (const line of lines) {
      this.writeLine(line);
    }
  }

  /**
   * Clear the scroll region
   */
  clearScrollRegion(): void {
    // Move to start of scroll region
    for (let i = this.scrollTop; i <= this.scrollBottom; i++) {
      process.stdout.write(ansi.cursorTo(i, 1));
      process.stdout.write(ansi.clearLine());
    }
    // Reset cursor to top of scroll region
    process.stdout.write(ansi.cursorTo(this.scrollTop, 1));
  }

  /**
   * Render header at fixed position
   */
  renderHeader(lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const row = i + 1;
      if (row > this.headerRows) break;
      process.stdout.write(ansi.cursorTo(row, 1));
      process.stdout.write(ansi.clearLine());
      process.stdout.write(lines[i]);
    }
  }

  /**
   * Render footer at fixed position (before scroll region)
   */
  renderFooter(lines: string[]): void {
    const footerStart = this.scrollTop - 1;
    for (let i = 0; i < lines.length; i++) {
      const row = footerStart - lines.length + i + 1;
      if (row < this.scrollTop) break;
      process.stdout.write(ansi.cursorTo(row, 1));
      process.stdout.write(ansi.clearLine());
      process.stdout.write(lines[i]);
    }
  }

  /**
   * Get the height available for messages
   */
  getScrollRegionHeight(): number {
    return this.scrollBottom - this.scrollTop + 1;
  }

  /**
   * Get footer height
   */
  getFooterHeight(): number {
    return this.footerRows;
  }

  /**
   * Get header height
   */
  getHeaderHeight(): number {
    return this.headerRows;
  }
}

// Singleton instance
let instance: TerminalScrollRegion | null = null;

export function getTerminalScrollRegion(): TerminalScrollRegion {
  if (!instance) {
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    instance = new TerminalScrollRegion({
      totalRows: rows,
      totalCols: cols,
      headerRows: 2,
      footerRows: 4,
    });
  }
  return instance;
}

export function createTerminalScrollRegion(options: {
  totalRows: number;
  totalCols: number;
  headerRows: number;
  footerRows: number;
}): TerminalScrollRegion {
  instance = new TerminalScrollRegion(options);
  return instance;
}
