import * as readline from 'readline';
import chalk from 'chalk';

export class StableFooterRenderer {
  private lastLinesCount = 0;

  render(rl: readline.Interface, hintLines: string[], hudLines: string[], opts?: { stayDown?: boolean }) {
    const term = process.stdout;
    if (!term.isTTY) return;

    const rlAny = rl as any;
    const cursor = rlAny.cursor || 0;
    const line = rlAny.line || '';
    const prompt = rlAny._prompt || '';

    // Strip ANSI for accurate visual length calculation
    const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const visualPrompt = stripAnsi(prompt);
    const visualLine = stripAnsi(line);
    const visualFullLine = visualPrompt + visualLine;

    // 1. Calculate how many lines the current wrapped input takes
    const termWidth = term.columns || 80;
    const inputRows = Math.ceil(visualFullLine.length / termWidth) || 1;
    const cursorOffset = visualPrompt.length + cursor; // rlAny.cursor is already visual
    const cursorRow = Math.floor(cursorOffset / termWidth);
    const cursorCol = cursorOffset % termWidth;

    // 2. Move to the very end of the input area (last row of wrapped input)
    const rowsToMoveDown = (inputRows - 1) - cursorRow;
    if (rowsToMoveDown > 0) {
      readline.moveCursor(term, 0, rowsToMoveDown);
    }
    readline.cursorTo(term, visualFullLine.length % termWidth);

    // 3. Move to the next line and clear everything below
    term.write('\n');
    readline.cursorTo(term, 0); // ENSURE we start clearing from column 0
    readline.clearScreenDown(term);

    // 4. Draw Content
    const allLines = [...hintLines, ...hudLines];
    if (allLines.length > 0) {
      term.write(allLines.join('\n') + '\n');
    }

    // 5. Restore Cursor (Skip if handing off to command)
    if (!opts?.stayDown) {
      const totalLinesWritten = allLines.length + 1;
      readline.moveCursor(term, 0, -totalLinesWritten - rowsToMoveDown);
      readline.cursorTo(term, cursorCol);
    }
    
    this.lastLinesCount = allLines.length;
  }

  clear(rl: readline.Interface, opts?: { stayDown?: boolean }) {
    this.render(rl, [], [], opts);
  }
}
