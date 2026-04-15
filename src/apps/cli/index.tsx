import React from 'react';
import { render, Box, Text } from 'ink';
import { App } from './ink/App.js';
import * as dotenv from 'dotenv';
import { useAppStore } from './ink/store/uiStore.js';
import { parseFlags } from './json/flags.js';
import { initJsonMode, handleAgentEvent } from './json/JsonMode.js';
import { getAgent } from '../../agent/agent.js';
import { runCompatibilityCheckOrExit } from '../../agent/compatibilityCheck.js';

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

/**
 * JSON output mode - non-interactive NDJSON output
 */
async function runJsonMode(flags: { prompt?: string; session?: string }): Promise<void> {
  // Skip TTY check for JSON mode
  process.stdout.write(''); // Ensure stdout is writable

  // Run compatibility checks
  runCompatibilityCheckOrExit();

  // Initialize JSON mode
  initJsonMode();

  // Subscribe to agent events and emit NDJSON
  const agent = getAgent();
  const unsubscribe = agent.subscribe(event => {
    handleAgentEvent(event);
  });

  // If a session ID is provided, restore it
  if (flags.session) {
    const { useChatStore } = await import('./ink/store/chatStore.js');
    await useChatStore.getState().restoreSessionById(flags.session);
  }

  // Send prompt
  if (flags.prompt) {
    const sessionId = await import('./ink/store/chatStore.js').then(m =>
      m.useChatStore.getState().ensureSessionForPrompt(flags.prompt!)
    );
    agent.sessionId = sessionId;
    try {
      await agent.prompt(flags.prompt);
    } catch (err) {
      const { emit } = await import('./json/emitter.js');
      const { emit: emitError } = await import('./json/emitter.js');
      emit({
        type: 'error',
        code: 'PROMPT_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Wait for agent to finish
  await agent.waitForIdle?.();

  unsubscribe();
}

/**
 * Interactive TUI mode (original behavior)
 */
async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.error('Error: Interactive mode requires a TTY terminal.');
    console.error('Please run this command in a local terminal session.');
    process.exit(1);
  }

  // Initialize saved model from environment before rendering
  initializeSavedModel();

  // Terminal setup before render
  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l'); // hide cursor

  const { waitUntilExit } = render(<App />, { exitOnCtrlC: false });

  await waitUntilExit();

  // Restore terminal state
  process.stdout.write('\u001b[2J\u001b['); // clear screen
  process.stdout.write('\u001b[?25h'); // show cursor
  process.stdout.write('\u001b[?1049l'); // main screen
}

// Main entry - check for --json flag first
const flags = parseFlags(process.argv.slice(2));

if (flags.json) {
  // JSON output mode (non-interactive)
  runJsonMode(flags).catch(err => {
    console.error('Fatal error during JSON mode:', err);
    process.exit(1);
  });
} else {
  // Interactive TUI mode
  bootstrap().catch(err => {
    console.error('Fatal error during bootstrap:', err);
    process.exit(1);
  });
}
