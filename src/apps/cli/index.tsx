// Must be before any pi-coding-agent imports
process.env.PI_CODING_AGENT_DIR = join(homedir(), '.codeagent');

import React from 'react';
import { render } from 'ink';
import { App } from './ink/App.js';
import { parseFlags } from './json/flags.js';
import { initJsonMode, handleAgentEvent } from './json/JsonMode.js';
import { ensureAgentInitialized, openLogViewer, closeLogViewer, logger } from '../core/index.js';
import { join } from 'path';
import { homedir } from 'os';

// ─── Global exception handlers ───────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  logger.fatal(err, 'Uncaught exception');
  closeLogViewer();
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(err, 'Unhandled rejection');
  // Don't exit for rejections — some may be recoverable
});

/**
 * JSON output mode - non-interactive NDJSON output
 */
async function runJsonMode(flags: { prompt?: string; session?: string }): Promise<void> {
  // Skip TTY check for JSON mode
  process.stdout.write(''); // Ensure stdout is writable

  // Initialize agent session
  const session = await ensureAgentInitialized();

  // Initialize JSON mode
  initJsonMode();

  // Subscribe to session events and emit NDJSON
  const unsubscribe = session.subscribe((event) => {
    handleAgentEvent(event);
  });

  // If a session ID is provided, restore it
  if (flags.session) {
    const { useChatStore } = await import('./ink/store/chatStore.js');
    await useChatStore.getState().restoreSessionById(flags.session);
  }

  // Send prompt
  if (flags.prompt) {
    await import('./ink/store/chatStore.js').then(m =>
      m.useChatStore.getState().ensureSessionForPrompt(flags.prompt!)
    );
    try {
      await session.prompt(flags.prompt);
    } catch (err) {
      const { emit } = await import('./json/emitter.js');
      emit({
        type: 'error',
        code: 'PROMPT_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

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

  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l'); // hide cursor

  openLogViewer();

  const initPromise = ensureAgentInitialized();

  const { waitUntilExit } = render(<App initPromise={initPromise} />, { exitOnCtrlC: false });

  await waitUntilExit();

  closeLogViewer();

  // Restore terminal state
  process.stdout.write('\u001b[2J\u001b['); // clear screen
  process.stdout.write('\u001b[?25h'); // show cursor
  process.stdout.write('\u001b[?1049l'); // main screen
}

// Main entry - check for --json flag first
const flags = parseFlags(process.argv.slice(2));

if (flags.json) {
  // JSON output mode (non-interactive)
  runJsonMode(flags).catch((err: Error) => {
    logger.fatal(err, 'Fatal error during JSON mode');
    process.exit(1);
  });
} else {
  // Interactive TUI mode
  bootstrap().catch((err: Error) => {
    logger.fatal(err, 'Fatal error during bootstrap');
    process.exit(1);
  });
}
