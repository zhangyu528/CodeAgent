import React from 'react';
import { render, Box, Text } from 'ink';
import { App } from './ink/App.js';
import * as dotenv from 'dotenv';
import { useAppStore } from './ink/store/uiStore.js';

dotenv.config({ quiet: true });

// Initialize currentModel from saved environment variables
function initializeSavedModel() {
  const defaultProvider = process.env.DEFAULT_PROVIDER;
  if (!defaultProvider) return;

  const modelKey = `${defaultProvider.toUpperCase().replace(/-/g, '_')}_MODEL`;
  const savedModel = process.env[modelKey];
  if (savedModel) {
    useAppStore.getState().setCurrentModel(savedModel);
  }
}

export async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.log('Error: Interactive mode requires a TTY terminal.');
    console.log('Please run this command in a local terminal session.');
    process.exit(1);
  }

  // Initialize saved model from environment before rendering
  initializeSavedModel();

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
