/**
 * Escape Sequence Chat Test
 * 
 * Simple test to verify escape sequence chat rendering works.
 * Run with: bun run src/apps/cli/escape-test.tsx
 */

import { EscapeChatRenderer } from './utils/escapeChatRenderer.js';
import { ChatMessage } from './pages/types.js';

const ESC = '\x1b';
const CSI = `${ESC}[`;

// ANSI escape sequences
const ansi = {
  cursorTo: (row: number, col: number = 1) => `${CSI}${row};${col}H`,
  clearScreen: () => `${CSI}2J`,
  clearLine: () => `${CSI}2K`,
  setScrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  scrollUp: (lines: number = 1) => `${CSI}${lines}S`,
  scrollDown: (lines: number = 1) => `${CSI}${lines}T`,
  saveCursor: () => `${ESC}7`,
  restoreCursor: () => `${ESC}8`,
  hideCursor: () => `${CSI}?25l`,
  showCursor: () => `${CSI}?25h`,
  enterAltScreen: () => `${CSI}?1049h`,
  exitAltScreen: () => `${CSI}?1049l`,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEscapeChat() {
  console.log('Testing Escape Sequence Chat Renderer...');
  
  // Enter alternate screen
  process.stdout.write(ansi.enterAltScreen());
  process.stdout.write(ansi.hideCursor());
  process.stdout.write(ansi.clearScreen());
  
  const rows = process.stdout.rows || 24;
  const cols = process.stdout.columns || 80;
  const headerRows = 2;
  const footerRows = 3;
  const scrollTop = headerRows + 1;
  const scrollBottom = rows - footerRows;
  
  // Enable scroll region
  process.stdout.write(ansi.setScrollRegion(scrollTop, scrollBottom));
  
  // Render header
  const border = '─'.repeat(cols);
  process.stdout.write(`${ansi.cursorTo(1, 1)}`);
  process.stdout.write(`\x1b[34m\x1b[1m┌${border}┐\x1b[0m`);
  process.stdout.write(`${ansi.cursorTo(2, 1)}`);
  process.stdout.write(`\x1b[34m│\x1b[0m Chat Session \x1b[34m│\x1b[0m`);
  
  // Render footer separator
  process.stdout.write(`${ansi.cursorTo(rows - footerRows, 1)}`);
  process.stdout.write(`\x1b[36m\x1b[1m└${border}┘\x1b[0m`);
  process.stdout.write(`${ansi.cursorTo(rows - footerRows + 1, 1)}`);
  process.stdout.write(`\x1b[36m│\x1b[0m Type a message... \x1b[36m│\x1b[0m`);
  process.stdout.write(`${ansi.cursorTo(rows - footerRows + 2, 1)}`);
  process.stdout.write(`\x1b[36m\x1b[1m└${border}┘\x1b[0m`);
  
  // Test messages
  const testMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'user',
      title: 'You',
      createdAt: Date.now(),
      status: 'completed',
      blocks: [{ kind: 'text', text: 'Hello, how are you?' }],
    },
    {
      id: '2',
      role: 'assistant',
      title: 'Assistant',
      createdAt: Date.now() + 1000,
      status: 'completed',
      blocks: [{ kind: 'text', text: 'I am doing well! I can help you with coding, analysis, and many other tasks.' }],
    },
    {
      id: '3',
      role: 'user',
      title: 'You',
      createdAt: Date.now() + 2000,
      status: 'completed',
      blocks: [{ kind: 'text', text: 'Show me a code example' }],
    },
    {
      id: '4',
      role: 'assistant',
      title: 'Assistant',
      createdAt: Date.now() + 3000,
      status: 'streaming',
      blocks: [{ kind: 'text', text: 'Here is a simple JavaScript function:\n\n```javascript\nfunction hello() {\n  console.log("Hello, World!");\n}\n```\n\nThis function prints "Hello, World!" to the console.' }],
    },
  ];
  
  const colors: Record<string, string> = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  };
  
  const roleColor = (role: string): string => {
    switch (role) {
      case 'user': return colors.cyan;
      case 'assistant': return colors.blue;
      case 'error': return colors.red;
      default: return colors.yellow;
    }
  };
  
  // Render messages with delay to show streaming
  for (const msg of testMessages) {
    const color = roleColor(msg.role);
    
    // Role label
    process.stdout.write(`${ansi.cursorTo(scrollBottom, 1)}`);
    process.stdout.write(ansi.scrollUp(1));
    process.stdout.write(`${colors.dim}│${colors.reset} ${color}${colors.bold}${msg.role}${colors.reset}`);
    process.stdout.write(ansi.clearLineToEnd());
    
    for (const block of msg.blocks) {
      const lines = block.text.split('\n');
      for (const line of lines) {
        process.stdout.write(`${ansi.cursorTo(scrollBottom, 1)}`);
        process.stdout.write(ansi.scrollUp(1));
        process.stdout.write(`${colors.dim}│${colors.reset} ${line}`);
        process.stdout.write(ansi.clearLineToEnd());
        await sleep(100);
      }
    }
    
    await sleep(500);
  }
  
  // Cleanup hint
  process.stdout.write(`${ansi.cursorTo(rows, 1)}`);
  process.stdout.write(ansi.clearLine());
  console.log('\n\x1b[33mTest complete! Press any key to exit...\x1b[0m');
  
  // Wait for keypress
  await new Promise<void>((resolve) => {
    const handler = () => {
      process.stdin.off('data', handler);
      resolve();
    };
    process.stdin.on('data', handler);
  });
  
  // Exit alternate screen
  process.stdout.write(ansi.exitAltScreen());
  process.stdout.write(ansi.showCursor());
  process.stdout.write(ansi.clearScreen());
  
  console.log('Done!');
}

testEscapeChat().catch(console.error);
