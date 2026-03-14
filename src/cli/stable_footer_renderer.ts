import * as readline from 'readline';
import chalk from 'chalk';

export class StableFooterRenderer {
  private lastLinesCount = 0;

  render(rl: readline.Interface, hintLines: string[], hudLines: string[]) {
    const term = process.stdout;
    if (!term.isTTY) return;

    const rlAny = rl as any;
    const cursor = rlAny.cursor || 0;
    const line = rlAny.line || '';
    const prompt = rlAny._prompt || '';

    // 1. Calculate how many lines the current wrapped input takes
    const termWidth = term.columns || 80;
    const fullLine = prompt + line;
    const inputRows = Math.ceil(fullLine.length / termWidth) || 1;
    const cursorOffset = prompt.length + cursor;
    const cursorRow = Math.floor(cursorOffset / termWidth);
    const cursorCol = cursorOffset % termWidth;

    // 2. Move to the very end of the input area (last row of wrapped input)
    const rowsToMoveDown = (inputRows - 1) - cursorRow;
    if (rowsToMoveDown > 0) {
      readline.moveCursor(term, 0, rowsToMoveDown);
    }
    readline.cursorTo(term, fullLine.length % termWidth);

    // 3. Move to the next line and clear everything below
    term.write('\n');
    readline.clearScreenDown(term);

    // 4. Draw Content
    const allLines = [...hintLines, ...hudLines];
    if (allLines.length > 0) {
      term.write(allLines.join('\n') + '\n');
    }

    // 5. Restore Cursor
    // We are now at the bottom of our footer. Move up by: 
    // allLines.length (the footer) + 1 (the initial newline) + rowsToMoveDown (input rows we crossed)
    const totalLinesWritten = allLines.length + 1;
    readline.moveCursor(term, 0, -totalLinesWritten - rowsToMoveDown);
    
    // Move back to original cursor column/row within input
    readline.cursorTo(term, cursorCol);
    
    this.lastLinesCount = allLines.length;
  }

  clear(rl: readline.Interface) {
    this.render(rl, [], []);
  }
}
