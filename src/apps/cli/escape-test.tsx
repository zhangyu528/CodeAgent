/**
 * Escape Chat Test - Standalone test for escape sequence rendering
 * Run with: bun run src/apps/cli/escape-test.tsx
 * 
 * This tests the escape sequence rendering without needing the full app.
 */

const ESC = '\x1b';
const CSI = `${ESC}[`;

// ANSI escape sequences
const ansi = {
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  cursorForward: (n = 1) => `${CSI}${n}C`,
  cursorBack: (n = 1) => `${CSI}${n}D`,
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  clearLineToEnd: () => `${CSI}0K`,
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (n = 1) => `${CSI}${n}S`,
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,
};

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renderHeader(rows: number, cols: number, sessionName?: string): Promise<void> {
  const border = '─'.repeat(Math.min(cols - 4, 60));

  process.stdout.write(ansi.cursorTo(1, 1));
  process.stdout.write(`${c.blue}${c.bold}┌${border}┐${c.reset}`);

  process.stdout.write(ansi.cursorTo(2, 1));
  const title = sessionName ? ` Chat - ${sessionName} ` : ' CodeAgent ';
  const padding = Math.floor((cols - title.length - 4) / 2);
  process.stdout.write(`${c.blue}│${c.reset}${' '.repeat(padding)}${c.bold}${c.white}${title}${c.reset}${' '.repeat(Math.max(0, cols - padding - title.length - 6))}${c.blue}│${c.reset}`);

  process.stdout.write(ansi.cursorTo(3, 1));
  process.stdout.write(`${c.blue}${c.bold}└${border}┘${c.reset}`);
}

async function renderInputArea(rows: number, cols: number, inputText: string, cursorPos: number): Promise<void> {
  const border = '─'.repeat(Math.min(cols - 4, 60));
  const inputTop = rows - 2;
  const scrollBottom = inputTop - 2;

  // Separator
  process.stdout.write(ansi.cursorTo(scrollBottom + 1, 1));
  process.stdout.write(`${c.cyan}├${border}┤${c.reset}`);

  // Input line
  const prompt = `${c.cyan}>${c.reset} `;
  process.stdout.write(ansi.cursorTo(inputTop, 1));
  process.stdout.write(ansi.clearLine());
  process.stdout.write(prompt);

  // Input text with cursor
  const displayText = inputText;
  const textBeforeCursor = displayText.slice(0, cursorPos);
  const textAfterCursor = displayText.slice(cursorPos);

  process.stdout.write(textBeforeCursor);
  process.stdout.write(`${c.yellow}${c.bold}_${c.reset}`);
  process.stdout.write(textAfterCursor);
  process.stdout.write(ansi.clearLineToEnd());

  // Hint
  process.stdout.write(ansi.cursorTo(inputTop + 1, 1));
  process.stdout.write(ansi.clearLine());
  process.stdout.write(`${c.dim}Press Enter to submit, Ctrl+C to exit${c.reset}`);

  // Bottom border
  process.stdout.write(ansi.cursorTo(rows, 1));
  process.stdout.write(`${c.cyan}└${border}┘${c.reset}`);
}

async function writeMessage(row: number, text: string, color: string): Promise<void> {
  process.stdout.write(ansi.cursorTo(row, 1));
  process.stdout.write(ansi.clearLine());
  process.stdout.write(`${c.dim}│${c.reset} ${color}${c.bold}${text}${c.reset}`);
  await sleep(50);
}

async function test() {
  const rows = process.stdout.rows || 24;
  const cols = process.stdout.columns || 80;

  console.log(`Terminal: ${rows}x${cols}`);

  // Enter alternate screen
  process.stdout.write(ansi.enterAltScreen());
  process.stdout.write(ansi.hideCursor());
  process.stdout.write(ansi.clearScreen());

  const headerLines = 3;
  const footerLines = 3;
  const scrollTop = headerLines + 1;
  const scrollBottom = rows - footerLines;

  // Enable scroll region
  process.stdout.write(ansi.setScrollRegion(scrollTop, scrollBottom));

  // Render header
  await renderHeader(rows, cols, 'Test Session');

  // Demo messages
  const messages = [
    { role: 'user', text: 'Hello, how are you?' },
    { role: 'assistant', text: 'I am doing great! How can I help you today?' },
    { role: 'user', text: 'Show me a code example' },
    { role: 'assistant', text: 'Here is a simple function:\n\nfunction hello() {\n  console.log("Hello, World!");\n}' },
    { role: 'assistant', text: 'This prints a greeting to the console.' },
  ];

  // Render messages
  for (const msg of messages) {
    const color = msg.role === 'user' ? c.cyan : msg.role === 'assistant' ? c.blue : c.red;
    await writeMessage(scrollBottom, `${msg.role}:`, color);

    const lines = msg.text.split('\n');
    for (const line of lines) {
      // Scroll up and write
      process.stdout.write(ansi.cursorTo(scrollBottom, 1));
      process.stdout.write(ansi.scrollUp(1));
      process.stdout.write(ansi.cursorTo(scrollBottom, 1));
      process.stdout.write(ansi.clearLine());
      process.stdout.write(`${c.dim}│${c.reset} ${line}`);
      await sleep(30);
    }
    await sleep(200);
  }

  // Disable scroll region for input
  process.stdout.write(ansi.setScrollRegion(1, rows));

  // Render input area
  let inputText = '';
  let cursorPos = 0;
  await renderInputArea(rows, cols, inputText, cursorPos);

  // Move cursor to input position
  process.stdout.write(ansi.cursorTo(rows - 2, 3));

  // Input loop
  process.stdin.setRawMode?.(true);
  process.stdin.resume?.();
  process.stdin.setEncoding?.('utf-8');

  return new Promise<void>((resolve) => {
    const handler = (chunk: string, key?: { name?: string; ctrl?: boolean }) => {
      if (key?.ctrl && key.name === 'c') {
        cleanup();
        resolve();
        return;
      }

      if (key?.name === 'return' || key?.name === 'enter') {
        if (inputText.trim()) {
          // Show submitted text
          process.stdout.write(ansi.cursorTo(scrollBottom, 1));
          process.stdout.write(ansi.scrollUp(1));
          process.stdout.write(ansi.cursorTo(scrollBottom, 1));
          process.stdout.write(ansi.clearLine());
          process.stdout.write(`${c.dim}│${c.reset} ${c.cyan}${c.bold}You:${c.reset} ${inputText}`);
          inputText = '';
          cursorPos = 0;
          renderInputArea(rows, cols, inputText, cursorPos);
          process.stdout.write(ansi.cursorTo(rows - 2, 3));
        }
        return;
      }

      if (key?.name === 'backspace') {
        if (cursorPos > 0) {
          inputText = inputText.slice(0, cursorPos - 1) + inputText.slice(cursorPos);
          cursorPos--;
          renderInputArea(rows, cols, inputText, cursorPos);
          process.stdout.write(ansi.cursorTo(rows - 2, 3 + cursorPos));
        }
        return;
      }

      if (key?.name === 'leftArrow') {
        if (cursorPos > 0) {
          cursorPos--;
          process.stdout.write(ansi.cursorBack());
        }
        return;
      }

      if (key?.name === 'rightArrow') {
        if (cursorPos < inputText.length) {
          cursorPos++;
          process.stdout.write(ansi.cursorForward());
        }
        return;
      }

      // Regular character
      if (chunk && !key?.ctrl && !key?.meta && chunk.length === 1) {
        inputText = inputText.slice(0, cursorPos) + chunk + inputText.slice(cursorPos);
        cursorPos++;
        renderInputArea(rows, cols, inputText, cursorPos);
        process.stdout.write(ansi.cursorTo(rows - 2, 3 + cursorPos));
      }
    };

    process.stdin.on('data', handler);

    function cleanup() {
      process.stdin.off('data', handler);
      process.stdin.setRawMode?.(false);
      process.stdout.write(ansi.exitAltScreen());
      process.stdout.write(ansi.showCursor());
      process.stdout.write(ansi.clearScreen());
    }
  });
}

test().then(() => {
  console.log('\nTest complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
