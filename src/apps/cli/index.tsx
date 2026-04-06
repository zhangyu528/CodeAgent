import React from 'react';
import { render, Box, Text } from 'ink';
import { App } from './ink/App.js';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.log('Error: Interactive mode requires a TTY terminal.');
    console.log('Please run this command in a local terminal session.');
    process.exit(1);
  }

  // Terminal setup before render
  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l');    // hide cursor

  const { waitUntilExit } = render(
    <App />,
    { exitOnCtrlC: false }
  );
  
  await waitUntilExit();
  
  // Restore terminal state
  process.stdout.write('\u001b[2J\u001b[H'); // clear screen
  process.stdout.write('\u001b[?25h');         // show cursor
  process.stdout.write('\u001b[?1049l');       // main screen
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
