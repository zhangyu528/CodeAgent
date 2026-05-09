// Must be before any pi-coding-agent imports
process.env.PI_CODING_AGENT_DIR = join(homedir(), '.codeagent');

import React from 'react';
import { render } from 'ink';
import { App } from './ink/App.js';
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

// ─── Interactive TUI mode ──────────────────────────────────────────────────

async function bootstrap() {
  if (!process.stdin.isTTY) {
    console.error('Error: Interactive mode requires a TTY terminal.');
    console.error('Please run this command in a local terminal session.');
    process.exit(1);
  }

  process.stdout.write('\u001b[?1049h'); // alternate screen
  process.stdout.write('\u001b[?25l'); // hide cursor

  const initPromise = ensureAgentInitialized();

  const { waitUntilExit } = render(<App initPromise={initPromise} />, {
    exitOnCtrlC: false,
  });

  await waitUntilExit();

  // Restore terminal state
  process.stdout.write('\u001b[?25h'); // show cursor
  process.stdout.write('\u001b[?1049l'); // exit alternate screen
}

// ─── Main entry ────────────────────────────────────────────────────────────

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
