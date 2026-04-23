// Must be before any pi-coding-agent imports
process.env.PI_CODING_AGENT_DIR = join(homedir(), '.codeagent');

import React from 'react';
import { render } from 'ink';
import { App } from './ink/App.js';
import { EscapeApp } from './escape/EscapeApp.js';
import { useAppStore } from './ink/store/uiStore.js';
import { parseFlags } from './json/flags.js';
import { runJsonCli } from './json/cli.js';
import { ensureAgentInitialized, logger } from '@codeagent/core';
import { join } from 'path';
import { homedir } from 'os';

// ─── Global exception handlers ───────────────────────────────────────────────

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', { err });
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled rejection', { reason });
});

/**
 * Interactive TUI mode
 * - Init page: Ink renders <InitPage />
 * - Non-init pages: EscapeApp renders escape sequences directly
 */
async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.error('Error: Interactive mode requires a TTY terminal.');
    console.error('Please run this command in a local terminal session.');
    process.exit(1);
  }

  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l'); // hide cursor

  const initPromise = ensureAgentInitialized();

  let escapeApp: EscapeApp | null = null;

  const { waitUntilExit } = render(<App initPromise={initPromise} />, {
    exitOnCtrlC: false,
  });

  // Drive EscapeApp based on page changes from ink store
  let currentPage = useAppStore.getState().page;
  useAppStore.subscribe(() => {
    const page = useAppStore.getState().page;
    if (page === currentPage) return;
    currentPage = page;

    if (page === 'init') {
      escapeApp?.stop();
      escapeApp = null;
      return;
    }

    if (!escapeApp) {
      escapeApp = new EscapeApp({
        onSubmit: (prompt) => {
          useAppStore.getState().setPendingPrompt?.(prompt);
          useAppStore.getState().setPage('chat');
        },
      });
      escapeApp.start();
    }

    if (page === 'welcome') {
      escapeApp.setPage('welcome');
    } else if (page === 'chat') {
      escapeApp.setPage('chat');
    }
  });

  await waitUntilExit();

  escapeApp?.stop();

  // Restore terminal state
  process.stdout.write('\u001b[?25h'); // show cursor
  process.stdout.write('\u001b[?1049l'); // exit alternate screen
}

// Main entry - check for --json flag first
const flags = parseFlags(process.argv.slice(2));

if (flags.json) {
  // JSON output mode (non-interactive)
  runJsonCli({ prompt: flags.prompt, session: flags.session }).catch((err: Error) => {
    logger.error('Fatal error during JSON mode', { err });
    process.exit(1);
  });
} else {
  // Interactive TUI mode
  bootstrap().catch((err: Error) => {
    logger.error('Fatal error during bootstrap', { err });
    process.exit(1);
  });
}
