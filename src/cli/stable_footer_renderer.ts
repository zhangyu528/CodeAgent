import * as readline from 'readline';

export class StableFooterRenderer {
  private lastLinesCount = 0;

  /**
   * Calculates the visual width of a string, accounting for CJK double-width characters.
   */
  private getVisualWidth(str: string): number {
    // Strip ANSI codes first
    const clean = str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    let width = 0;
    for (let i = 0; i < clean.length; i++) {
        const code = clean.charCodeAt(i);
        // Basic CJK range check (simplified but effective for common characters)
        if ((code >= 0x1100 && (code <= 0x115f || // Hangul Jamo
             code === 0x2329 || code === 0x232a ||
             (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) || // CJK Radicals Supplement .. Yi Radicals
             (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
             (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
             (code >= 0xfe10 && code <= 0xfe19) || // Vertical forms
             (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
             (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
             (code >= 0xffe0 && code <= 0xffe6)))) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
  }

  private lastRenderKey: string = '';

  render(rl: readline.Interface, hintLines: string[], hudLines: string[], opts?: { stayDown?: boolean }) {
    const term = process.stdout;
    if (!term.isTTY) return;

    const rlAny = rl as any;
    const prompt = rlAny._prompt || '';
    const line = rlAny.line || '';
    const cursor = rlAny.cursor || 0;

    // 1. Calculate visual dimensions
    const termWidth = term.columns || 80;
    
    // Width of prompt + input up to cursor
    const visualPromptWidth = this.getVisualWidth(prompt);
    const inputUpToCursor = line.substring(0, cursor);
    const visualInputTargetWidth = this.getVisualWidth(inputUpToCursor);
    const cursorOffset = visualPromptWidth + visualInputTargetWidth;
    
    // Total physical rows the input takes
    const visualFullInputWidth = visualPromptWidth + this.getVisualWidth(line);
    const inputRows = Math.ceil(visualFullInputWidth / termWidth) || 1;

    // 2. SURGICAL SKIP: If nothing meaningful changed, don't touch the terminal.
    // We track inputRows, line content, cursor position, and the prompt string 
    // because any change might trigger a readline refresh that clears the footer area.
    const allLines = [...hintLines, ...hudLines];
    const currentKey = `${inputRows}:${prompt}:${line}:${cursor}:${allLines.join('|')}`;
    const isFirstRender = this.lastRenderKey === '';
    
    if (currentKey === this.lastRenderKey && !opts?.stayDown && !isFirstRender) {
      return;
    }
    this.lastRenderKey = currentKey;
    
    // Current cursor physical position
    const cursorRow = Math.floor(cursorOffset / termWidth);
    const cursorCol = cursorOffset % termWidth;

    // 3. Hide cursor to prevent flicker
    term.write('\x1b[?25l');

    // 4. Move to the bottom of the input area
    const rowsToMoveDown = (inputRows - 1) - cursorRow;
    if (rowsToMoveDown > 0) {
      readline.moveCursor(term, 0, rowsToMoveDown);
    }
    
    // Move to end of wrapped line
    readline.cursorTo(term, visualFullInputWidth % termWidth);

    // 5. Update Content
    term.write('\n');
    readline.cursorTo(term, 0);
    readline.clearScreenDown(term);

    if (allLines.length > 0) {
      term.write(allLines.join('\n') + '\n');
    }

    // 6. Restore Position & Cursor 
    if (!opts?.stayDown) {
      const footerLinesWritten = allLines.length + 1;
      readline.moveCursor(term, 0, -footerLinesWritten - rowsToMoveDown);
      readline.cursorTo(term, cursorCol);
    }
    
    // Restore cursor visibility
    term.write('\x1b[?25h');
    
    this.lastLinesCount = allLines.length;
  }

  clear(rl: readline.Interface, opts?: { stayDown?: boolean }) {
    this.lastRenderKey = ''; // Force redraw
    this.render(rl, [], [], opts);
  }
}
